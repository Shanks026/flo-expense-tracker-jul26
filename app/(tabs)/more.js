import { useMemo } from 'react';
import { Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Wallet, Receipt, Users, Landmark, Grid2x2, Settings, Crown } from 'lucide-react-native';
import Screen from '../../components/Screen';
import Row, { RowGroup } from '../../components/Row';
import { fontFamily, fontSize, spacing } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { FLAGS } from '../../lib/flags';
import { useAccountSwitcherSheet } from '../../components/AccountSwitcherSheet';

// The More tab (38-home-insights-more.md): the secondary features, one tap
// from anywhere, so Home stays about this month. Replaces the old Menu sheet.
export default function More() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { openAccountSwitcher } = useAccountSwitcherSheet();

  return (
    <Screen>
      <Text style={styles.title} accessibilityRole="header">
        More
      </Text>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <RowGroup title="Money">
          <Row icon={Wallet} title="Budgets" onPress={() => router.push('/budgets')} />
          <Row icon={Receipt} title="Bills" onPress={() => router.push('/bills')} />
          <Row icon={Users} title="Splits" onPress={() => router.push('/splits')} />
        </RowGroup>

        <RowGroup title="Set up">
          <Row icon={Landmark} title="Accounts" onPress={openAccountSwitcher} />
          <Row icon={Grid2x2} title="Categories" onPress={() => router.push('/manage-categories')} />
        </RowGroup>

        <RowGroup>
          {/* Pro only once Play Billing is live (lib/flags.js billing). */}
          {FLAGS.billing && <Row icon={Crown} title="FLO Pro" onPress={() => router.push('/pro')} />}
          <Row icon={Settings} title="Settings" onPress={() => router.push('/settings')} />
        </RowGroup>
      </ScrollView>
    </Screen>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    title: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.display,
      letterSpacing: -0.3,
      color: colors.ink,
      paddingTop: spacing.sm,
      marginBottom: spacing.md,
    },
    scroll: {
      paddingBottom: 120,
    },
  });
}
