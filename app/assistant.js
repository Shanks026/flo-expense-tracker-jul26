import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Keyboard,
  Dimensions,
  Platform,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  FadeInDown,
  LinearTransition,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolateColor,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowUp, History, Mic, SquarePen } from 'lucide-react-native';
import ArrowMark from '../components/ArrowMark';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import ShimmerText from '../components/ShimmerText';
import RichText from '../components/RichText';
import BreakdownTable, { breakdownsFrom } from '../components/BreakdownTable';
import ProposalCard from '../components/ProposalCard';
import { fontFamily, spacing, radii, radius, type, hitTarget } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import useAssistantConversation from '../hooks/useAssistantConversation';
import { useAccount } from '../lib/AccountContext';
import { aiChat } from '../lib/ai';
import { FLAGS } from '../lib/flags';
import { voiceSupported, micPermission, startListening } from '../lib/voice';
import useVoiceLanguage from '../hooks/useVoiceLanguage';

const MAX_MESSAGE = 500;
const FAIL_TEXT = {
  cap: "That's today's limit for questions. Try again tomorrow.",
  error: "Couldn't answer that. Check your connection and try again.",
  unheard: "Couldn't hear that. Hold the mic and speak.",
};
// What the thinking line says while a turn runs, in order. The last one
// stays until the answer arrives. Generic on purpose: the screen doesn't
// know which tool the function is running.
const THINKING_STEPS = ['Thinking', 'Reading your transactions', 'Adding it up', 'Almost there'];
const STEP_MS = 1600;
// Starter chips on the empty chat (spec §3.3): the label shown, and the
// question a tap sends.
const STARTERS = [
  { label: 'This month so far', question: 'How much have I spent this month so far?' },
  { label: 'Biggest categories', question: 'What are my biggest spending categories this month?' },
  { label: 'Am I over a budget?', question: 'Am I over any budget?' },
  { label: 'Bills this week', question: 'What bills are due this week?' },
];
const REVEAL_WORD_MS = 28;

// Motion shared by every bubble: a short rise and fade in, and a spring when
// the list around it shifts. Reanimated drops both under reduce-motion.
const ENTER = FadeInDown.duration(260).easing(Easing.out(Easing.cubic));
const SHIFT = LinearTransition.springify().damping(20).stiffness(180);

// Ask FLO (44-ai-assistant.md, phase 3): a read-only chat over the person's
// own money. Every number in an answer comes from a tool the ai-assistant
// function ran; the function also writes both sides of each turn, so this
// screen only sends and reads back. A turn that fails writes nothing, and
// the question goes back into the composer.
//
// Ticket 08: `id` (a route param) opens a past chat, from Past chats
// (app/assistant/history.js); `at` makes a repeat pick land. The mic in the
// composer works like the quick-add mic: hold, speak, let go, and the words
// are sent as if typed.
export default function Assistant() {
  if (!FLAGS.ai) return <Redirect href="/more" />;
  return <AssistantChat />;
}

function AssistantChat() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { activeAccountId } = useAccount();
  const [conversationId, setConversationId] = useState(params.id || null);
  const { messages, loading, loadedId, refetch } = useAssistantConversation(conversationId);
  const [list, setList] = useState([]);
  const [text, setText] = useState('');
  const [pending, setPending] = useState(null); // { key, text } of the question being answered
  const [failure, setFailure] = useState(null);
  const [freshReplyId, setFreshReplyId] = useState(null); // the answer to reveal word by word
  const scrollRef = useRef(null);
  const turnRef = useRef(0);
  // A stored row's id → the key its bubble was first drawn with, so the
  // question doesn't animate in a second time when the refetch replaces it.
  const keysRef = useRef(new Map());
  // Bumped whenever another chat is opened, so an answer to the old one that
  // arrives later isn't drawn into the new one. The function stored it anyway.
  const chatRef = useRef(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Voice (ticket 08): only where the build and phone support it, and gone
  // for good once the permission is denied with no way to ask again.
  const { language } = useVoiceLanguage();
  const [micAllowed, setMicAllowed] = useState(() => voiceSupported());
  const [listening, setListening] = useState(false);
  const sessionRef = useRef(null);
  const heldRef = useRef(false);

  useEffect(() => {
    if (micAllowed) {
      micPermission().then(({ granted, canAskAgain }) => {
        if (!granted && !canAskAgain) setMicAllowed(false);
      });
    }
    return () => sessionRef.current?.stop();
  }, []);

  function openChat(id) {
    chatRef.current += 1;
    keysRef.current = new Map();
    setConversationId(id || null);
    setList([]);
    setPending(null);
    setFailure(null);
    setFreshReplyId(null);
  }

  // A pick from Past chats (or New chat there).
  useEffect(() => {
    if (params.at) openChat(params.id);
  }, [params.id, params.at]);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    // From the keyboard's top edge to the bottom of the screen: the reported
    // height alone leaves out the navigation bar, which the screen draws under.
    const show = Keyboard.addListener('keyboardDidShow', (e) =>
      setKeyboardHeight(Math.max(0, Dimensions.get('screen').height - e.endCoordinates.screenY))
    );
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // The stored conversation is the truth; `list` also holds a just-answered
  // turn until the refetch brings it back. Only rows loaded for this very id
  // count (`loadedId`), so switching chats never shows the old one's rows.
  useEffect(() => {
    if (!conversationId || loadedId !== conversationId) return;
    // Loaded and empty: it was deleted from Past chats. Start a new one.
    if (messages.length) setList(messages);
    else if (!pending) openChat(null);
  }, [messages, loadedId, conversationId]);

  // Sends a starter chip's `question`, or what's typed when there's none.
  async function send(question) {
    const message = (question ?? text).trim();
    if (!message || pending) return;
    const chat = chatRef.current;
    turnRef.current += 1;
    const key = `turn-${turnRef.current}`;
    setFailure(null);
    setPending({ key, text: message });
    setText('');
    const result = await aiChat({ conversationId, message, accountId: activeAccountId });
    if (chat !== chatRef.current) return;
    if (result.ok) {
      const question = result.question ?? { id: key, role: 'user', content: message };
      keysRef.current.set(question.id, key);
      setList((prev) => [...prev, question, result.reply]);
      setFreshReplyId(result.reply.id);
      // A first turn sets the id, and the hook refetches for it; a later one
      // keeps the same id, so refetch here. Chat rows feed no other screen,
      // so there's no notifyChanged().
      if (result.conversationId === conversationId) refetch();
      else setConversationId(result.conversationId);
    } else {
      setFailure(FAIL_TEXT[result.reason] ?? FAIL_TEXT.error);
      setText((current) => current || message);
    }
    setPending(null);
  }

  async function handleMicIn() {
    if (listening || pending) return;
    heldRef.current = true;
    const { granted } = await micPermission();
    if (!granted) {
      // The first press only asks; the next hold talks.
      const asked = await micPermission({ ask: true });
      if (!asked.granted && !asked.canAskAgain) setMicAllowed(false);
      return;
    }
    if (!heldRef.current) return;
    Keyboard.dismiss();
    setFailure(null);
    setListening(true);
    const session = await startListening({
      lang: language,
      continuous: true,
      onText: setText,
      onEnd: ({ text: heard, error }) => {
        sessionRef.current = null;
        setListening(false);
        if (error === 'not-allowed') {
          setMicAllowed(false);
          return;
        }
        if (!heard) {
          setFailure(FAIL_TEXT.unheard);
          return;
        }
        // Sent exactly as if typed. This callback was made in an older
        // render, so it goes through the ref to the latest send().
        sendRef.current(heard);
      },
    });
    sessionRef.current = session;
    // Let go before the recognizer was ready.
    if (!heldRef.current) session.stop();
  }

  function handleMicOut() {
    heldRef.current = false;
    sessionRef.current?.stop();
  }

  const sendRef = useRef(send);
  sendRef.current = send;

  const canSend = text.trim().length > 0 && !pending && !listening;
  // The mic takes the send button's place while the composer is empty, as
  // in messaging apps, and stays while it listens.
  const showMic = micAllowed && !pending && (listening || text.trim().length === 0);
  const showEmpty = !loading && list.length === 0 && !pending;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, Platform.OS === 'android' && { paddingBottom: keyboardHeight }]}
      // Android 16 is edge-to-edge, so the window doesn't resize for the
      // keyboard; the screen pads itself by the keyboard's height instead.
      // KeyboardAvoidingView's 'height' mode overshot there and stuck after
      // the keyboard closed.
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerButtons}>
              {list.length > 0 ? (
                <HeaderButton icon={SquarePen} label="New chat" onPress={() => openChat(null)} colors={colors} styles={styles} />
              ) : null}
              <HeaderButton
                icon={History}
                label="Past chats"
                onPress={() => router.push('/assistant/history')}
                colors={colors}
                styles={styles}
              />
            </View>
          ),
        }}
      />
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {showEmpty ? (
          <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(150)}>
            <EmptyState
              pose="report"
              title="Ask about your money"
              body="Try “How much did I spend on food this month?”"
            />
            <View style={styles.chips}>
              {STARTERS.map((s) => (
                <Pressable
                  key={s.label}
                  style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                  onPress={() => send(s.question)}
                  accessibilityRole="button"
                  accessibilityHint={s.question}
                >
                  <Text style={styles.chipText}>{s.label}</Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        ) : null}
        {/* One flat list, so the question being answered keeps its bubble
            (same key, same array) when it becomes the stored question. */}
        {[
          ...list.map((m) => ({ ...m, key: keysRef.current.get(m.id) ?? m.id })),
          ...(pending
            ? [
                { key: pending.key, role: 'user', content: pending.text },
                { key: `${pending.key}-thinking`, role: 'thinking' },
              ]
            : []),
        ].map((m) => {
          if (m.role === 'user') return <UserBubble key={m.key} text={m.content} styles={styles} />;
          if (m.role === 'thinking') return <Thinking key={m.key} colors={colors} styles={styles} />;
          return (
            <Answer
              key={m.key}
              id={m.id}
              text={m.content}
              toolCalls={m.tool_calls}
              proposal={m.proposal}
              reveal={m.id === freshReplyId}
              onRevealed={() => setFreshReplyId(null)}
              styles={styles}
            />
          );
        })}
        {failure ? (
          <Animated.Text entering={FadeIn} style={styles.failure} accessibilityLiveRegion="polite">
            {failure}
          </Animated.Text>
        ) : null}
      </ScrollView>

      <View style={[styles.composer, { paddingBottom: keyboardHeight ? spacing.md : Math.max(insets.bottom, spacing.md) }]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={listening ? 'Listening…' : 'Ask about your spending'}
          placeholderTextColor={colors.muted}
          multiline
          maxLength={MAX_MESSAGE}
          editable={!pending && !listening}
          accessibilityLabel="Your question"
        />
        {showMic ? (
          <Pressable
            onPressIn={handleMicIn}
            onPressOut={handleMicOut}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={listening ? 'Listening. Let go to send' : 'Hold to speak'}
          >
            <View style={[styles.send, listening ? styles.micListening : styles.mic]}>
              <Mic size={20} color={listening ? colors.brandText : colors.ink} strokeWidth={2.4} />
            </View>
          </Pressable>
        ) : (
          <SendButton enabled={canSend} onPress={() => send()} colors={colors} styles={styles} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function HeaderButton({ icon: Icon, label, onPress, colors, styles }) {
  return (
    <Pressable onPress={onPress} style={styles.headerButton} hitSlop={4} accessibilityRole="button" accessibilityLabel={label}>
      <Icon size={20} color={colors.ink} strokeWidth={2} />
    </Pressable>
  );
}

function UserBubble({ text, styles }) {
  return (
    <Animated.View style={styles.userRow} entering={ENTER} layout={SHIFT}>
      <View style={styles.userBubble}>
        <Text style={styles.userText} selectable>
          {text}
        </Text>
      </View>
    </Animated.View>
  );
}

// An answer, on the page with no bubble. A fresh one writes itself out a
// word at a time, the way chat replies stream in; stored ones and
// reduce-motion show the whole text. Stopping the reveal for any reason (a
// new answer arriving, reduce-motion turning on) shows it whole at once.
// A draft (phase 4) shows as a ProposalCard under the words, once they're out.
function Answer({ id, text, toolCalls, proposal, reveal, onRevealed, styles }) {
  const reduce = useReducedMotion();
  const words = useMemo(() => text.split(/(\s+)/), [text]);
  const tables = useMemo(() => breakdownsFrom(toolCalls), [toolCalls]);
  const animate = reveal && !reduce;
  const [shown, setShown] = useState(animate ? 0 : words.length);

  const done = !animate || shown >= words.length;
  useEffect(() => {
    if (!animate || done) return undefined;
    const timer = setInterval(() => {
      // A word and the space after it.
      setShown((n) => Math.min(n + 2, words.length));
    }, REVEAL_WORD_MS);
    return () => clearInterval(timer);
  }, [animate, done, words.length]);

  // Done: tell the screen once, outside the state update.
  useEffect(() => {
    if (animate && shown >= words.length) onRevealed?.();
  }, [animate, shown >= words.length]);

  // Mid-reveal, a last line that is only a list or heading marker so far
  // ("-", "1.", "###") waits for its first word instead of showing raw.
  const partial = done
    ? text
    : words
        .slice(0, shown)
        .join('')
        .replace(/\n\s*(#{1,6}|[-*•]|\d{1,2}[.)])\s*$/, '\n');

  // No layout spring here: the answer grows every few milliseconds while it
  // reveals, and a spring per step would pile up.
  return (
    <Animated.View style={styles.answer} entering={ENTER}>
      <RichText text={partial} />
      {done
        ? tables.map((t, i) => (
            <Animated.View key={i} entering={animate ? FadeIn.duration(260) : undefined}>
              <Card style={styles.tableCard}>
                <BreakdownTable table={t} />
              </Card>
            </Animated.View>
          ))
        : null}
      {done && proposal ? (
        <Animated.View entering={animate ? FadeIn.duration(260) : undefined}>
          <ProposalCard messageId={id} proposal={proposal} />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

// The answer-to-be: FLO's arrow mark, still, beside a shimmering line that
// steps through THINKING_STEPS while the turn runs. The shimmer is the only
// motion (the person's call, 2026-11-09: no bouncing AI icon).
function Thinking({ colors, styles }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      () => setStep((s) => Math.min(s + 1, THINKING_STEPS.length - 1)),
      STEP_MS
    );
    return () => clearInterval(timer);
  }, []);

  const label = `${THINKING_STEPS[step]}…`;
  return (
    <Animated.View
      style={styles.thinking}
      entering={ENTER}
      exiting={FadeOut.duration(120)}
      layout={SHIFT}
      accessibilityLiveRegion="polite"
      accessibilityLabel={label}
    >
      <ArrowMark size={18} color={colors.ink} />
      <Animated.View key={step} entering={FadeIn.duration(220)} exiting={FadeOut.duration(120)}>
        <ShimmerText
          text={label}
          style={styles.thinkingText}
          baseColor={colors.muted}
          highlightColor={colors.ink}
        />
      </Animated.View>
    </Animated.View>
  );
}

// Send: springs down under the finger, and fades between its on and off
// colours as the composer fills or empties.
function SendButton({ enabled, onPress, colors, styles }) {
  const press = useSharedValue(1);
  const on = useSharedValue(enabled ? 1 : 0);

  useEffect(() => {
    on.value = withTiming(enabled ? 1 : 0, { duration: 180 });
  }, [enabled]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }],
    backgroundColor: interpolateColor(on.value, [0, 1], [colors.chipBg, colors.brand]),
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        press.value = withSpring(0.86, { damping: 15, stiffness: 400 });
      }}
      onPressOut={() => {
        press.value = withSpring(1, { damping: 12, stiffness: 300 });
      }}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel="Send"
      accessibilityState={{ disabled: !enabled }}
      hitSlop={8}
    >
      <Animated.View style={[styles.send, animated]}>
        <ArrowUp size={20} color={enabled ? colors.brandText : colors.muted} strokeWidth={2.6} />
      </Animated.View>
    </Pressable>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    flex: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    list: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
      gap: spacing.md,
    },
    userRow: {
      alignItems: 'flex-end',
    },
    userBubble: {
      maxWidth: '85%',
      backgroundColor: colors.brand,
      borderRadius: radii.button,
      borderBottomRightRadius: radius.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    userText: {
      fontFamily: fontFamily.semibold,
      fontSize: type.body,
      lineHeight: 20,
      color: colors.brandText,
    },
    // Answers sit on the page, full width, with no bubble, as in other AI
    // chats; only the person's questions are bubbles. A little side room
    // lines the text up with the bubbles' own text.
    answer: {
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xs,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    chip: {
      backgroundColor: colors.surface,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    chipPressed: {
      backgroundColor: colors.chipBg,
    },
    chipText: {
      fontFamily: fontFamily.semibold,
      fontSize: type.body,
      color: colors.ink,
    },
    tableCard: {
      marginTop: spacing.md,
      paddingVertical: spacing.sm,
    },
    thinking: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.sm,
    },
    thinkingText: {
      fontFamily: fontFamily.semibold,
      fontSize: type.body,
    },
    failure: {
      fontFamily: fontFamily.semibold,
      fontSize: type.caption,
      color: colors.danger,
      textAlign: 'center',
    },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      backgroundColor: colors.bg,
    },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 120,
      backgroundColor: colors.surface,
      borderRadius: radii.button,
      paddingHorizontal: spacing.lg,
      paddingTop: 12,
      paddingBottom: 12,
      fontFamily: fontFamily.semibold,
      fontSize: type.body,
      color: colors.ink,
    },
    mic: {
      backgroundColor: colors.chipBg,
    },
    micListening: {
      backgroundColor: colors.brand,
    },
    headerButtons: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerButton: {
      width: hitTarget,
      height: hitTarget,
      alignItems: 'center',
      justifyContent: 'center',
    },
    send: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
