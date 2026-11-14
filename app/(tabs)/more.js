import { useMemo, Children, isValidElement, cloneElement } from 'react';
import { View, Text, Image, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Wallet, Receipt, Users, Landmark, Grid2x2, Settings, Crown, Sparkles, Palette } from 'lucide-react-native';
import { LargeTitle } from '../../components/ledger/ScreenHeader';
import SectionHeader from '../../components/ledger/SectionHeader';
import ListRow from '../../components/ledger/ListRow';
import { useEditProfileSheet } from '../../components/EditProfileSheet';
import { useAuth } from '../../lib/AuthContext';
import useProfile from '../../hooks/useProfile';
import { profileInitial, profileLines } from '../../lib/profileHeader';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius, inter } from '../../theme/ledger';
import { FLAGS } from '../../lib/flags';

const AVATAR = 56;

// The You tab (38-home-insights-more.md; on the ledger kit since spec 49,
// ticket 09): the person's photo or initial, name and email (a tap edits
// them), then flat rows to everything that isn't Home, Activity or
// Insights. Cards leads, as the signature feature. Routes are unchanged.
export default function You() {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const { session } = useAuth();
  const { profile, avatarUrl } = useProfile();
  const { openEditProfile } = useEditProfileSheet();

  const fullName = profile?.full_name ?? session?.user?.user_metadata?.full_name ?? '';
  const email = session?.user?.email ?? '';
  const initial = profileInitial({ fullName, email });
  const { title, caption } = profileLines({ fullName, email });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <LargeTitle title="You" />

        <Pressable
          style={({ pressed }) => [styles.header, pressed && styles.pressed]}
          onPress={openEditProfile}
          accessibilityRole="button"
          accessibilityLabel={[title, caption].filter(Boolean).join(', ') || 'Your profile'}
          accessibilityHint="Edit your profile"
        >
          <View style={styles.avatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.initial}>{initial}</Text>
            )}
          </View>
          <View style={styles.flex}>
            <Text style={styles.name} numberOfLines={1}>
              {title}
            </Text>
            {!!caption && (
              <Text style={styles.email} numberOfLines={1}>
                {caption}
              </Text>
            )}
          </View>
        </Pressable>

        <Group>
          {FLAGS.themes && <ListRow icon={Palette} title="Cards" trailing="chevron" onPress={() => router.push('/personalize')} />}
          {/* Ask FLO (44-ai-assistant.md), hidden with the AI flag. */}
          {FLAGS.ai && <ListRow icon={Sparkles} title="Ask FLO" trailing="chevron" onPress={() => router.push('/assistant')} />}
        </Group>

        <Group title="Money">
          <ListRow icon={Wallet} title="Budgets" trailing="chevron" onPress={() => router.push('/budgets')} />
          <ListRow icon={Receipt} title="Bills" trailing="chevron" onPress={() => router.push('/bills')} />
          <ListRow icon={Users} title="Splits" trailing="chevron" onPress={() => router.push('/splits')} />
        </Group>

        <Group title="Set up">
          <ListRow icon={Landmark} title="Accounts" trailing="chevron" onPress={() => router.push('/accounts')} />
          <ListRow icon={Grid2x2} title="Categories" trailing="chevron" onPress={() => router.push('/manage-categories')} />
        </Group>

        <Group>
          {/* Pro only once Play Billing is live (lib/flags.js billing). */}
          {FLAGS.billing && <ListRow icon={Crown} title="FLO Pro" trailing="chevron" onPress={() => router.push('/pro')} />}
          <ListRow icon={Settings} title="Settings" trailing="chevron" onPress={() => router.push('/settings')} />
        </Group>
      </ScrollView>
    </SafeAreaView>
  );
}

// A run of rows under an optional section header; the last row has no
// divider. Flagged-off rows (false) are dropped first.
function Group({ title, children }) {
  const rows = Children.toArray(children).filter(isValidElement);
  if (rows.length === 0) return null;
  return (
    <View style={{ marginTop: ledgerSpace.section }}>
      {!!title && <SectionHeader title={title} />}
      {rows.map((row, i) => (i === rows.length - 1 ? cloneElement(row, { divider: false }) : row))}
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: c.canvas,
    },
    flex: {
      flex: 1,
      minWidth: 0,
    },
    scroll: {
      paddingHorizontal: ledgerSpace.gutter,
      paddingTop: ledgerSpace.sm,
      // Clears the floating tab bar and its ⊕.
      paddingBottom: 120,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ledgerSpace.lg,
      marginTop: ledgerSpace.md,
      paddingVertical: ledgerSpace.xs,
    },
    pressed: {
      opacity: 0.7,
    },
    avatar: {
      width: AVATAR,
      height: AVATAR,
      borderRadius: ledgerRadius.full,
      backgroundColor: c.surfaceSunk,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: {
      width: AVATAR,
      height: AVATAR,
    },
    initial: {
      fontFamily: inter.semibold,
      fontSize: 22,
      color: c.ink,
    },
    name: {
      ...ledgerType.title,
      color: c.ink,
    },
    email: {
      ...ledgerType.caption,
      color: c.muted,
      marginTop: 2,
    },
  });
}
