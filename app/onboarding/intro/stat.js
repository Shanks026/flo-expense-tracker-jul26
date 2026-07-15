import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingScreen from '../../../components/OnboardingScreen';
import CountUp from '../../../components/CountUp';
import { colors, radii, fontFamily, fontSize, spacing } from '../../../theme/tokens';
import { getIntroNext } from '../../../lib/onboarding';
import { getDraft } from '../../../lib/onboardingDraft';

// Screen 7 — the aha. Light screen (no dark background anywhere in
// onboarding — a user's explicit call), big deep-lime count-up number doing
// the dramatic work instead. Framed around the INVISIBILITY of spending,
// never savings-shame (FLO's Koban voice rule: never shame for spending, only
// for not knowing).
//
// REAL, CITED NUMBER (2026-07-15) — replacing the earlier invented "N per day
// per age" placeholder. NPCI reported 23.2 billion UPI transactions in India in
// May 2026 (₹29.9 trillion) — a real, verifiable NATIONAL aggregate, sourced via
// NPCI's own released data as reported by ANI/IBEF (npci.org.in's statistics
// page itself blocks automated fetches with a 403; this is secondary reporting
// of NPCI's own figures, not independently re-verified against the primary page
// — worth a manual spot-check before this ships).
//
// Deliberately NOT a per-user or per-age daily count. That number was tried and
// rejected: NPCI doesn't publish per-user-by-age data at all, and the only
// honest way to derive one (23.2B ÷ an estimated ~450-500M active users ÷ days
// in the month) lands around 1.5-3 transactions per person per day — accurate,
// but far too small to be the "aha," and any age split on top of that would be
// pure invention. The NATIONAL number is genuinely dramatic on its own and needs
// no shaky per-user division, so the hook became "how many of YOUR share of
// this can you actually remember" rather than a fabricated personal count.
//
// Age still tailors the qualitative LINE below (no numeric claim, so no
// sourcing problem) — unchanged mechanism, just no longer paired with a
// per-age number.
const NATIONAL_STAT = { value: 23, decimal: '.2', unit: 'Billion' };

const AGE_LINE = {
  '18-24': 'The habits you build now tend to stick for decades. Most people don’t notice where it’s going until it’s already a habit.',
  '25-34': 'This is usually the decade people mean to get a handle on money, right before the small stuff quietly wins anyway.',
  '35-44': 'More coming in usually just means more slipping out, unnoticed.',
  '45+': 'You’ve earned a lot over the years. The question worth asking now is where it actually went.',
};

const FALLBACK_LINE = AGE_LINE['25-34'];

// The gender-tailored EMPOWERING turn — its own titled callout card below the
// spending stat (so it's clearly a separate "for you" note, not blended into
// the age line). Deliberately empowering STATEMENTS, not fabricated numeric
// stats: the only hard number on this screen is the real, cited national UPI
// figure above, and inventing a per-gender figure would break the feature's
// honesty rule. So these carry no citation — they claim no statistic.
//
// Each has its OWN eyebrow rather than one shared "Fun fact" label: a
// trivia/fact framing fits the female line (a real historical fact) but reads
// wrong on the male insight and especially the trans affirmation (which isn't
// a "fact" at all). The label always matches what the line actually is.
//
//   male   — reframes "break the stereotype" WITHOUT shaming spending or
//            restating the stereotype (Koban's rule: never shame for spending).
//            The quiet tracker wins, not the flashy earner/spender.
//   female — the historical-agency angle: money control is a recently- and
//            unevenly-won freedom, and she's exercising it. Claim kept general
//            (true across cultures — coverture, credit/property limits within
//            living memory), not a specific unverified year; solidarity, not
//            finger-pointing at her own home.
//   transgender — warmth, agency, belonging. NO statistic (real trans-finance
//            data is about hardship — the opposite of empowering, and a
//            fabricated one would be dishonest), no tokenizing, no politics.
//   prefer_not / missing — no card; falls back to the age line below.
const GENDER_NOTE = {
  male: {
    emoji: '📈',
    eyebrow: 'Good to know',
    text: 'The ones who get ahead with money aren’t the biggest earners or the biggest spenders. They’re the ones who quietly keep track. That’s a skill, not a personality, and it’s yours to build.',
  },
  female: {
    emoji: '💪',
    eyebrow: 'Did you know',
    text: 'For most of history, women weren’t allowed to control their own money. In some homes that’s still true today. You’re here, doing it on your own terms, and we’re proud to help you own it.',
  },
  transgender: {
    emoji: '💛',
    eyebrow: 'A note for you',
    text: 'Taking charge of your money is one of the most freeing things you can do for yourself. We’re so glad you’re here. Let’s make it simple, and make it yours.',
  },
};

export default function Stat() {
  const router = useRouter();
  const [ageLine, setAgeLine] = useState(FALLBACK_LINE);
  const [genderNote, setGenderNote] = useState(null);

  useEffect(() => {
    getDraft().then((d) => {
      setAgeLine(AGE_LINE[d.age_range] ?? FALLBACK_LINE);
      setGenderNote(GENDER_NOTE[d.gender] ?? null);
    });
  }, []);

  return (
    <OnboardingScreen
      bg="light"
      scrollable
      primaryLabel="Okay, that’s a lot"
      onPrimary={() => router.replace(getIntroNext('stat'))}
    >
      <Text style={styles.lead}>Last month alone,</Text>
      <View style={styles.numberRow}>
        <CountUp value={NATIONAL_STAT.value} format={(n) => `${n}${NATIONAL_STAT.decimal}`} style={styles.number} />
        <Text style={styles.unit}>{NATIONAL_STAT.unit}</Text>
      </View>
      <Text style={styles.small}>UPI payments happened across India.</Text>
      <Text style={styles.tonight}>How many of yours could you actually list from memory?</Text>

      {/* Age reflection only when there's no gender card (keeps the citation
          the last line of the number's own block). */}
      {!genderNote ? <Text style={styles.line}>{ageLine}</Text> : null}

      {/* Citation scopes to the NUMBER only — sits above the gender card so it
          never reads as sourcing the card (which claims no statistic). */}
      <Text style={styles.cite}>Source: NPCI, May 2026 — 23.2 billion transactions worth ₹29.9 trillion.</Text>

      {genderNote ? (
        <View style={styles.genderCard}>
          <Text style={styles.genderEmoji}>{genderNote.emoji}</Text>
          <Text style={styles.genderEyebrow}>{genderNote.eyebrow}</Text>
          <Text style={styles.genderText}>{genderNote.text}</Text>
        </View>
      ) : null}
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  lead: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.muted,
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.xs,
  },
  // Matches the design's 104px hero number — deep lime, since raw brand lime
  // fails contrast on this screen's light background.
  number: {
    fontFamily: fontFamily.extrabold,
    fontSize: 100,
    letterSpacing: -2,
    // Must exceed fontSize, not equal it — a 1:1 ratio clips the glyph's own
    // descender/ascender box at this size (the exact bug fixed on the
    // opener's "Hey.").
    lineHeight: 122,
    color: colors.income,
  },
  unit: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.hero,
    color: colors.income,
    marginTop: spacing.md,
    marginLeft: spacing.xs,
  },
  small: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.display,
    color: colors.ink,
    marginTop: 2,
  },
  tonight: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.lg,
    color: colors.mutedDarker,
    marginTop: spacing.lg,
  },
  line: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.lg,
    lineHeight: 23,
    color: colors.muted,
    marginTop: spacing.xl,
  },
  cite: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.mutedLight,
    marginTop: spacing.xl,
  },
  // The gender note's own highlighted callout — a pale-lime card so it reads
  // as a distinct "for you" block, clearly separate from the spending stat.
  genderCard: {
    backgroundColor: colors.incomeBg,
    borderRadius: radii.card,
    padding: spacing.xl,
    // Extra gap (not just spacing.xxl) so the callout reads as a SEPARATE
    // second piece of information, not a continuation of the spending stat.
    marginTop: spacing.xxl * 2,
  },
  genderEmoji: {
    fontSize: 26,
    marginBottom: spacing.sm,
  },
  genderEyebrow: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xs,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.income,
    marginBottom: spacing.sm,
  },
  genderText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.lg,
    lineHeight: 23,
    color: colors.ink,
  },
});
