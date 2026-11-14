import { useMemo, useRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, List, ChartColumn, Ellipsis, Plus } from 'lucide-react-native';
import { hitTarget } from '../theme/tokens';
import { useLedger, inter, ledgerRadius } from '../theme/ledger';
import { useAddTransactionSheet } from './AddTransactionSheet';
import CoachMark from './CoachMark';
import * as Haptics from 'expo-haptics';
import { voiceSupported } from '../lib/voice';

const ICONS = { index: Home, transactions: List, insights: ChartColumn, more: Ellipsis };
// Route names stay; only the labels changed (spec 46, ticket 08).
const LABELS = { index: 'Home', transactions: 'Activity', insights: 'Insights', more: 'You' };

// Home · Activity · (+) · Insights · You (spec 46; was 38-home-insights-more.md).
// Quiet Ledger look: the canvas with a hairline on top, ink for the open
// tab and muted for the rest, and an ink + in the middle.
// The centre + is an action (opens the Add sheet), not a route, so it isn't
// part of `state.routes`; it's rendered between the two halves.
export default function TabBar({ state, navigation }) {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { openAdd } = useAddTransactionSheet();
  const addButtonRef = useRef(null);

  function renderItem(route, index) {
    const isFocused = state.index === index;
    const Icon = ICONS[route.name] ?? Home;
    const color = isFocused ? c.ink : c.muted;

    function onPress() {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    }

    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        style={styles.item}
        accessibilityRole="tab"
        accessibilityLabel={LABELS[route.name]}
        accessibilityState={{ selected: isFocused }}
      >
        <Icon size={22} color={color} strokeWidth={isFocused ? 2 : 1.75} />
        <Text
          style={[styles.label, { color, fontFamily: isFocused ? inter.semibold : inter.medium }]}
          numberOfLines={1}
        >
          {LABELS[route.name]}
        </Text>
      </Pressable>
    );
  }

  const firstHalf = state.routes.slice(0, 2);
  const secondHalf = state.routes.slice(2);

  return (
    /* Base height 72 (was 96) + the device's real bottom safe-area inset. The
       base is the bar's own content height; items are top-aligned under
       paddingTop:14, so base − (icon+label ≈ 56) is the gap BELOW the labels,
       and 96 left ~40px of dead space there. 72 lands that gap at ~14px — a
       comfortable breathing room, not a chasm — while paddingBottom:insets.bottom
       still carries the safe area on top of it, so gesture-nav and 3-button-nav
       devices (and zero-inset screens) each keep the correct clearance. */
    <View style={[styles.bar, { height: 72 + insets.bottom, paddingBottom: insets.bottom }]}>
      {firstHalf.map((route, i) => renderItem(route, i))}
      <Pressable
        ref={addButtonRef}
        style={styles.addButton}
        // quickAdd: the one opener that gets the quick-add line
        // (44-ai-assistant.md, Phase 1).
        onPress={() => openAdd({ quickAdd: true })}
        // Long-press: the sheet opens already listening (44-ai-assistant.md,
        // Phase 2, ticket 05). Checked at press time, not render: on a cold
        // start the speech module may not answer yet when the bar first
        // renders. Without voice, a long-press opens it as a tap does.
        onLongPress={() => {
          const listen = voiceSupported();
          if (listen) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          openAdd({ quickAdd: true, listen });
        }}
        delayLongPress={400}
        accessibilityRole="button"
        accessibilityLabel="Add a transaction"
      >
        {/* Ink fill with the on-ink colour, so it inverts with the mode. */}
        <Plus size={26} color={c.inkOnInk} strokeWidth={2.25} />
      </Pressable>
      {secondHalf.map((route, i) => renderItem(route, i + 2))}
      {/* First Home after onboarding (35-onboarding-v3.md). Lives here, next
          to the button it points at; shown only while Home is the open tab. */}
      <CoachMark
        id="add"
        targetRef={addButtonRef}
        text="Tap + to log what you spend. It takes a few seconds."
        active={state.routes[state.index]?.name === 'index'}
      />
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      backgroundColor: c.canvas,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.hairline,
      paddingTop: 12,
      paddingHorizontal: 10,
    },
    item: {
      alignItems: 'center',
      gap: 4,
      width: 72,
      minHeight: hitTarget,
    },
    label: {
      fontSize: 11,
      lineHeight: 14,
    },
    addButton: {
      width: 56,
      height: 56,
      borderRadius: ledgerRadius.full,
      backgroundColor: c.ink,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: -16,
      shadowColor: c.shadow,
      shadowOpacity: 0.18,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
  });
}
