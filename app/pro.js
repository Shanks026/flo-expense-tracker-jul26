import { useState, useMemo } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { Check } from 'lucide-react-native';
import ScreenHeader, { LargeTitle, useHeaderScroll } from '../components/ledger/ScreenHeader';
import SectionHeader from '../components/ledger/SectionHeader';
import ListRow from '../components/ledger/ListRow';
import PinnedFooter, { PINNED_FOOTER_HEIGHT } from '../components/ledger/PinnedFooter';
import { Radio } from '../components/ledger/SelectMark';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius } from '../theme/ledger';
import { PRO_PRICING, PRO_BENEFITS } from '../lib/pro';
import useEntitlement from '../hooks/useEntitlement';
import { useToast } from '../components/Toast';
import { FLAGS } from '../lib/flags';

const PLAN_ORDER = ['monthly', 'annual', 'lifetime'];

// Doubles as the paywall placeholder (no payment integrated yet — see
// 14-subscription-pro.md); on the ledger kit since spec 49, ticket 10.
// Reached from the You tab's FLO Pro row and the upsell sheet's button.
//
// While billing is flagged off (lib/flags.js) the route itself is closed:
// every entry point is already hidden, and a stray deep link lands on Home
// instead of a price list.
export default function ProRoute() {
  if (!FLAGS.billing) return <Redirect href="/" />;
  return <Pro />;
}

function Pro() {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { scrollY, onScroll } = useHeaderScroll();
  const { isPro } = useEntitlement();
  const { showToast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState('annual');
  const chosen = PRO_PRICING[selectedPlan];

  // The placeholder: no payment yet.
  function handleUpgrade() {
    showToast({
      message: "Payments aren't live yet. You'll be the first to know when Pro launches.",
      variant: 'info',
      duration: 4000,
    });
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="FLO Pro" scrollY={scrollY} />
      <Animated.ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scroll, isPro && styles.scrollNoFooter]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <LargeTitle title="FLO Pro" scrollY={scrollY} />
        <Text style={styles.lede}>{isPro ? "You're on Pro. Thanks for being here early." : 'More room for every account, budget and split.'}</Text>

        <View style={styles.benefits}>
          {PRO_BENEFITS.map((b) => (
            <View key={b.title} style={styles.benefit}>
              <Check size={18} color={c.ink} strokeWidth={2.25} style={styles.check} />
              <View style={styles.flex}>
                <Text style={styles.benefitTitle}>{b.title}</Text>
                <Text style={styles.benefitBody}>{b.body}</Text>
              </View>
            </View>
          ))}
        </View>

        {!isPro && (
          <View style={styles.section}>
            <SectionHeader title="Choose a plan" />
            {PLAN_ORDER.map((key, i) => {
              const plan = PRO_PRICING[key];
              const selected = selectedPlan === key;
              return (
                <ListRow
                  key={key}
                  title={plan.label}
                  sub={plan.sub}
                  right={plan.price}
                  rightSub={plan.badge}
                  trailing={<View style={styles.radioGap}><Radio selected={selected} /></View>}
                  onPress={() => setSelectedPlan(key)}
                  divider={i < PLAN_ORDER.length - 1}
                  accessibilityLabel={`${plan.label}, ${plan.price}, ${plan.sub}${plan.badge ? `, ${plan.badge}` : ''}${selected ? ', selected' : ''}`}
                />
              );
            })}
          </View>
        )}
      </Animated.ScrollView>

      {!isPro && <PinnedFooter primary={{ title: `Get ${chosen.label} for ${chosen.price}`, onPress: handleUpgrade }} />}
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.canvas,
    },
    flex: {
      flex: 1,
    },
    scroll: {
      paddingHorizontal: ledgerSpace.gutter,
      paddingBottom: PINNED_FOOTER_HEIGHT + ledgerSpace.section * 2,
    },
    scrollNoFooter: {
      paddingBottom: ledgerSpace.section * 2,
    },
    lede: {
      ...ledgerType.body,
      color: c.muted,
      marginBottom: ledgerSpace.lg,
    },
    // The benefits as a checklist in one surface card with a hairline.
    benefits: {
      backgroundColor: c.surface,
      borderRadius: ledgerRadius.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      padding: ledgerSpace.lg,
      gap: ledgerSpace.md,
    },
    benefit: {
      flexDirection: 'row',
      gap: ledgerSpace.md,
    },
    check: {
      marginTop: 1,
    },
    benefitTitle: {
      ...ledgerType.rowTitle,
      color: c.ink,
    },
    benefitBody: {
      ...ledgerType.caption,
      color: c.muted,
      marginTop: 2,
    },
    section: {
      marginTop: ledgerSpace.section,
    },
    radioGap: {
      marginLeft: ledgerSpace.sm,
    },
  });
}
