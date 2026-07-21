import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { ZoomIn, FadeInDown } from 'react-native-reanimated';
import Button from './Button';
import Confetti from './Confetti';
import CardThemeSurface from './CardThemeSurface';
import useRewards from '../hooks/useRewards';
import useProfile from '../hooks/useProfile';
import { useAuth } from '../lib/AuthContext';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { RANKS, RANK_BADGE_ART, RANK_FLAVOR, rankFromXp } from '../lib/rewards';
import { claimRank } from '../lib/rewardsMutations';
import { getTheme } from '../lib/cardThemes';
import { colors, fontFamily, fontSize, spacing, radii } from '../theme/tokens';

// A root-mounted celebration for crossing a Rank threshold
// (18-gamification-ritual-and-ledger.md Phase 5). Full-screen, pinned-dark
// takeover (per direct feedback, "like Duolingo") — switched from a centered
// dialog to the same full-screen shape StreakCelebration already uses
// (pinned to the STATIC theme/tokens colors, not useTheme(), so it doesn't
// adapt to the user's active theme — same "always this look" precedent).
// Confetti kept from the dialog version; StreakCelebration doesn't use it
// (its own celebration leans on the streak-day calendar reveal instead), but
// nothing here says every full-screen celebration must look identical.
//
// "Highest rank seen" lives in profiles.highest_rank_seen (DB), not
// AsyncStorage — it used to be device-local, which had two real problems: a
// fire-and-forget AsyncStorage.setItem() issued right before showing the
// dialog, never awaited, so a reload/kill shortly after a real celebration
// could lose the write and replay it next launch; and being device-local at
// all meant a reinstall (or a second device) could never remember a rank
// already celebrated. Both are closed by making this account-scoped and
// durable — the same fix already applied to theme_accent/theme_mode
// (app/_layout.js's ThemeProfileSync) for the identical class of bug.
export default function RankUpCelebration() {
  const styles = useMemo(() => makeStyles(), []);
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { xp, loading } = useRewards();
  const { profile, loading: profileLoading, updateProfile } = useProfile();
  const { notifyChanged } = useDataRefresh();
  const [visible, setVisible] = useState(false);
  const contentRef = useRef(null);
  // Tracks which rank.id this component has already resolved a check for, so
  // the effect below doesn't re-run on every XP tick within the SAME rank —
  // only when rank.id itself actually changes.
  const checkedRankRef = useRef(null);

  const userId = session?.user?.id ?? null;
  const { current: rank } = rankFromXp(xp);

  useEffect(() => {
    if (!session || !userId || loading || profileLoading || !profile) return;
    if (checkedRankRef.current === rank.id) return;
    checkedRankRef.current = rank.id;

    const lastSeenId = profile.highest_rank_seen;

    (async () => {
      // First-ever check for this user (no stored rank at all) — everyone
      // starts at Saver by construction (minXp: 0), so this is "welcome",
      // not a rank-UP. Record it silently and move on; nothing to celebrate.
      if (!lastSeenId) {
        await updateProfile({ highest_rank_seen: rank.id }, { silent: true });
        return;
      }
      if (lastSeenId === rank.id) return;

      const lastIndex = RANKS.findIndex((r) => r.id === lastSeenId);
      const newIndex = RANKS.findIndex((r) => r.id === rank.id);
      // Awaited, and written BEFORE the dialog shows — the write this
      // replaces raced showing the dialog against persisting "seen", which
      // is exactly how a rank-up could replay. Confirming the record landed
      // first closes that gap.
      await updateProfile({ highest_rank_seen: rank.id }, { silent: true });
      // XP only ever rises (it's never spent — lib/rewards.js), so a rank
      // moving backward shouldn't be reachable in practice; guarded anyway
      // rather than trusted, since this reads from the DB, not a value this
      // component fully controls.
      if (newIndex <= lastIndex) return;

      // Rank theme grant (27-rank-ladder-rework.md Phase 2). Runs BEFORE the
      // dialog shows so the reveal can't display a theme the grant then failed
      // to write. claimRank is idempotent on (user_id,'rank',rankId) and a
      // no-op for the six ranks with no theme, so calling it unconditionally
      // here is safe. notifyChanged() only on a genuine first grant — that's
      // what makes useCardThemes pick the new theme up without a refetch of
      // the whole app on every re-render of this component.
      const { themeId } = await claimRank(rank.id);
      if (themeId) notifyChanged();

      contentRef.current = { ...rank, themeId: themeId ?? null };
      setVisible(true);
    })();
    // updateProfile is a fresh function reference every render (useProfile
    // isn't memoized) — omitted deliberately, same precedent as
    // ThemeProfileSync's reconciliation effect in app/_layout.js. The
    // checkedRankRef guard above is what actually controls re-entry, not
    // this dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, userId, loading, profileLoading, profile, rank.id]);

  if (!visible || !contentRef.current) return null;

  const shownRank = contentRef.current;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={() => setVisible(false)}>
      <View style={styles.screen}>
        <Confetti />
        {/* Content centers in the space ABOVE the button (per direct
            feedback, "place the button at the bottom of the screen") — the
            button itself lives in its own non-flex footer below, so it pins
            to the bottom edge instead of flowing right after the body text. */}
        <View style={styles.content}>
          {/* Leads the screen now (per direct feedback — "it feels random,
              add context") — states plainly what just happened BEFORE the
              badge reveal, instead of a bare badge/confetti popping up with
              no announcement first. Plain large text now, not a pill/chip
              (per direct feedback, "apple-esque") — source string is
              lowercase, textTransform:'capitalize' title-cases each word
              rather than a literal ALL-CAPS string or an uppercase
              transform. */}
          <Animated.Text entering={FadeInDown.duration(300)} style={styles.eyebrowText}>
            new rank unlocked!
          </Animated.Text>
          <Animated.View entering={ZoomIn.delay(150).duration(400)} style={styles.badgeWrap}>
            <Image source={RANK_BADGE_ART[shownRank.id]} style={styles.badgeArt} resizeMode="contain" />
          </Animated.View>
          <Animated.Text entering={FadeInDown.delay(300).duration(400)} style={styles.title}>
            {shownRank.title}
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(400).duration(400)} style={styles.body}>
            {RANK_FLAVOR[shownRank.id]}
          </Animated.Text>
          {/* Rank card-theme reveal (27-rank-ladder-rework.md Phase 2) — only
              three of the nine ranks carry one, so this block is absent
              entirely for the other six and the screen is exactly as it was.
              Enters last (delay 600, after the flavor line) so the beat order
              reads announcement → badge → title → why it matters → and here's
              what you got. Mirrors app/shop.js's own bought-dialog preview
              (CardThemeSurface + a "Flo" label in the theme's own textColor)
              rather than inventing a second way to show a card. */}
          {shownRank.themeId && (
            <Animated.View entering={FadeInDown.delay(600).duration(400)} style={styles.themeWrap}>
              <Text style={styles.themeLabel}>Card unlocked</Text>
              <CardThemeSurface theme={getTheme(shownRank.themeId)} style={styles.themePreview}>
                <View style={styles.themePreviewContent}>
                  <Text style={[styles.themePreviewName, { color: getTheme(shownRank.themeId).textColor }]}>Flo</Text>
                </View>
              </CardThemeSurface>
              <Text style={styles.themeName}>{getTheme(shownRank.themeId).name}</Text>
            </Animated.View>
          )}
        </View>
        <Animated.View entering={FadeInDown.delay(500).duration(400)} style={[styles.buttonWrap, { paddingBottom: insets.bottom + spacing.lg }]}>
          {/* Ghost, not primary — same reasoning as StreakCelebration's own
              dismiss button: a plain acknowledge, not a decision. */}
          <Button variant="ghost" title="Nice" onPress={() => setVisible(false)} />
        </Animated.View>
      </View>
    </Modal>
  );
}

function makeStyles() {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.ink,
      paddingHorizontal: spacing.xl,
    },
    // Takes all the space ABOVE the pinned button, centering its own content
    // within that remaining area — the button (styles.buttonWrap, a sibling
    // below this, not inside it) then sits at the screen's true bottom edge
    // instead of flowing right after the body text.
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeWrap: {
      width: 140,
      height: 140,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xl,
    },
    badgeArt: {
      width: 140,
      height: 140,
    },
    // No pill/chip anymore (per direct feedback, "apple-esque") — large
    // plain white text instead of a small kicker on a tinted background.
    // textTransform:'capitalize' (not a literal ALL-CAPS string, and not
    // 'uppercase') title-cases the lowercase source string word-by-word.
    eyebrowText: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.title,
      letterSpacing: -0.3,
      textTransform: 'capitalize',
      color: colors.surface,
      textAlign: 'center',
      marginBottom: spacing.md,
    },
    title: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.hero,
      lineHeight: 36,
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
      lineHeight: 22,
      marginBottom: spacing.xxl,
    },
    buttonWrap: {
      width: '100%',
    },
    // Rank theme reveal (27-rank-ladder-rework.md Phase 2). Sized well under
    // the Shop dialog's 110px preview — this sits below an already-tall stack
    // (eyebrow, badge art, title, flavor) on the shortest supported screen,
    // where a full-size card would push the flavor line into the button.
    themeWrap: {
      width: '100%',
      alignItems: 'center',
    },
    themeLabel: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.xs,
      color: colors.mutedDarker,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: spacing.sm,
    },
    themePreview: {
      width: '78%',
      height: 84,
    },
    themePreviewContent: {
      flex: 1,
      padding: spacing.md,
    },
    themePreviewName: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.md,
    },
    themeName: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.sm,
      // colors.surface, not a literal white — this screen is pinned dark, and
      // `title` above already uses surface as its on-ink foreground.
      color: colors.surface,
      marginTop: spacing.sm,
    },
  });
}
