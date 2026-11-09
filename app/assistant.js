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
import { Redirect } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowUp } from 'lucide-react-native';
import ArrowMark from '../components/ArrowMark';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import ShimmerText from '../components/ShimmerText';
import { fontFamily, spacing, radii, radius, type } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import useAssistantConversation from '../hooks/useAssistantConversation';
import { useAccount } from '../lib/AccountContext';
import { aiChat } from '../lib/ai';
import { FLAGS } from '../lib/flags';

const MAX_MESSAGE = 500;
const FAIL_TEXT = {
  cap: "That's today's limit for questions. Try again tomorrow.",
  error: "Couldn't answer that. Check your connection and try again.",
};
// What the thinking line says while a turn runs, in order. The last one
// stays until the answer arrives. Generic on purpose: the screen doesn't
// know which tool the function is running.
const THINKING_STEPS = ['Thinking', 'Reading your transactions', 'Adding it up', 'Almost there'];
const STEP_MS = 1600;
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
export default function Assistant() {
  if (!FLAGS.ai) return <Redirect href="/more" />;
  return <AssistantChat />;
}

function AssistantChat() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { activeAccountId } = useAccount();
  const [conversationId, setConversationId] = useState(null);
  const { messages, loading, refetch } = useAssistantConversation(conversationId);
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
  const [keyboardHeight, setKeyboardHeight] = useState(0);

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
  // turn until the refetch brings it back. A stored conversation is never
  // empty, so an empty `messages` is the previous id's, not yet refetched.
  useEffect(() => {
    if (conversationId && messages.length) setList(messages);
  }, [messages, conversationId]);

  async function send() {
    const message = text.trim();
    if (!message || pending) return;
    turnRef.current += 1;
    const key = `turn-${turnRef.current}`;
    setFailure(null);
    setPending({ key, text: message });
    setText('');
    const result = await aiChat({ conversationId, message, accountId: activeAccountId });
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

  const canSend = text.trim().length > 0 && !pending;
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
            <AnswerBubble
              key={m.key}
              text={m.content}
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
          placeholder="Ask about your spending"
          placeholderTextColor={colors.muted}
          multiline
          maxLength={MAX_MESSAGE}
          editable={!pending}
          accessibilityLabel="Your question"
        />
        <SendButton enabled={canSend} onPress={send} colors={colors} styles={styles} />
      </View>
    </KeyboardAvoidingView>
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

// An answer. A fresh one writes itself out a word at a time, the way chat
// replies stream in; stored ones and reduce-motion show the whole text.
function AnswerBubble({ text, reveal, onRevealed, styles }) {
  const reduce = useReducedMotion();
  const words = useMemo(() => text.split(/(\s+)/), [text]);
  const animate = reveal && !reduce;
  const [shown, setShown] = useState(animate ? 0 : words.length);

  const done = shown >= words.length;
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
    if (animate && done) onRevealed?.();
  }, [animate, done]);

  return (
    <Animated.View style={styles.answerWrap} entering={ENTER} layout={SHIFT}>
      <Card style={styles.answer}>
        <Text style={styles.answerText} selectable accessibilityLabel={text}>
          {done ? text : words.slice(0, shown).join('')}
        </Text>
      </Card>
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
      style={styles.answerWrap}
      entering={ENTER}
      exiting={FadeOut.duration(120)}
      layout={SHIFT}
      accessibilityLiveRegion="polite"
      accessibilityLabel={label}
    >
      <Card style={[styles.answer, styles.thinking]}>
        <ArrowMark size={18} color={colors.ink} />
        <Animated.View key={step} entering={FadeIn.duration(220)} exiting={FadeOut.duration(120)}>
          <ShimmerText
            text={label}
            style={styles.thinkingText}
            baseColor={colors.muted}
            highlightColor={colors.ink}
          />
        </Animated.View>
      </Card>
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
    answerWrap: {
      alignItems: 'flex-start',
    },
    answer: {
      maxWidth: '92%',
      borderBottomLeftRadius: radius.sm,
    },
    answerText: {
      fontFamily: fontFamily.semibold,
      fontSize: type.body,
      lineHeight: 21,
      color: colors.ink,
    },
    thinking: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
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
    send: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
