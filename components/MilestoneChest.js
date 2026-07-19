import { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ActivityIndicator } from 'react-native';
import Animated, { ZoomIn, FadeInDown } from 'react-native-reanimated';
import { Gift, CircleDollarSign, Snowflake } from 'lucide-react-native';
import CardThemeSurface from './CardThemeSurface';
import Button from './Button';
import { getTheme } from '../lib/cardThemes';
import { claimChestPick } from '../lib/rewardsMutations';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { colors, fontFamily, fontSize, spacing, radii } from '../theme/tokens';

// 19-card-themes.md Phase 2 — the deterministic "pick 1 of 3, no gacha"
// chest from IDEAS-gamification.md's Chests section. Fixed pools, same for
// every user, no randomness. Day 100's Gold Foil is NOT here — it's a
// Legendary theme, auto-granted directly (see MILESTONE_THEME_GRANTS in
// lib/rewards.js), not offered as one of a choice.
const CHEST_POOLS = {
  30: [
    { id: 'coins', kind: 'coins', label: '300 coins', coins: 300, freezes: 0, themeId: null },
    { id: 'freezes', kind: 'freezes', label: '2 freezes', coins: 0, freezes: 2, themeId: null },
    { id: 'holographic', kind: 'theme', label: 'Holographic', coins: 0, freezes: 0, themeId: 'holographic' },
  ],
  50: [
    { id: 'coins', kind: 'coins', label: '500 coins', coins: 500, freezes: 0, themeId: null },
    { id: 'freezes', kind: 'freezes', label: '2 freezes', coins: 0, freezes: 2, themeId: null },
    // Swapped with Velvet per direct feedback (2026-07-20) — Aurora is now
    // the chest-exclusive at day 50; Velvet moved to legendary (day 500).
    { id: 'aurora', kind: 'theme', label: 'Aurora', coins: 0, freezes: 0, themeId: 'aurora' },
  ],
};

// Which streak days have a chest — StreakCelebration checks this to decide
// whether to chain into MilestoneChest after its own screen is dismissed.
export function chestPoolFor(day) {
  return CHEST_POOLS[day] ?? null;
}

export default function MilestoneChest({ day, visible, onDone }) {
  const { notifyChanged } = useDataRefresh();
  const [pickedId, setPickedId] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const pool = CHEST_POOLS[day] ?? [];

  async function handlePick(choice) {
    if (claiming || pickedId) return;
    setPickedId(choice.id);
    setClaiming(true);
    await claimChestPick(day, choice);
    setClaiming(false);
    notifyChanged();
  }

  function handleDone() {
    setPickedId(null);
    onDone();
  }

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={() => {}}>
      <View style={styles.screen}>
        <Animated.View entering={ZoomIn.duration(400)} style={styles.iconTile}>
          <Gift size={38} color={colors.coinGold} strokeWidth={2} />
        </Animated.View>
        <Animated.Text entering={FadeInDown.delay(100).duration(400)} style={styles.title}>
          Day {day} chest
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(180).duration(400)} style={styles.body}>
          Pick one to keep.
        </Animated.Text>

        <Animated.View entering={FadeInDown.delay(280).duration(400)} style={styles.options}>
          {pool.map((choice) => {
            const selected = pickedId === choice.id;
            return (
              <Pressable
                key={choice.id}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => handlePick(choice)}
                disabled={!!pickedId}
              >
                {choice.kind === 'theme' ? (
                  <CardThemeSurface theme={getTheme(choice.themeId)} style={styles.optionSwatch} />
                ) : (
                  <View style={styles.optionIconTile}>
                    {choice.kind === 'coins' ? (
                      <CircleDollarSign size={22} color={colors.coinGold} fill={colors.coinGold} strokeWidth={1.5} />
                    ) : (
                      <Snowflake size={22} color={colors.iceBlue} fill={colors.iceBlue} strokeWidth={2.2} />
                    )}
                  </View>
                )}
                <Text style={styles.optionLabel}>{choice.label}</Text>
                {selected && claiming && <ActivityIndicator size="small" color={colors.surface} style={styles.optionSpinner} />}
              </Pressable>
            );
          })}
        </Animated.View>

        {pickedId && !claiming && (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.buttonWrap}>
            <Button variant="primary" title="Nice" onPress={handleDone} />
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  iconTile: {
    width: 80,
    height: 80,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(224,169,48,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.hero,
    letterSpacing: -0.5,
    color: colors.surface,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  body: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.mutedMid,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  options: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  option: {
    width: 96,
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radii.card,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  optionSelected: {
    borderColor: colors.brand,
    backgroundColor: 'rgba(187,220,18,0.08)',
  },
  optionSwatch: {
    width: '100%',
    height: 50,
  },
  optionIconTile: {
    width: '100%',
    height: 50,
    borderRadius: radii.card,
    backgroundColor: colors.inkCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    color: colors.surface,
    textAlign: 'center',
    marginTop: 8,
  },
  optionSpinner: {
    marginTop: 6,
  },
  buttonWrap: {
    width: '100%',
  },
});
