import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Users, ChevronLeft } from 'lucide-react-native';
import { format, parseISO } from 'date-fns';
import Card from '../../components/Card';
import IconTile from '../../components/IconTile';
import CategoryIcon from '../../components/CategoryIcon';
import Button from '../../components/Button';
import { fontFamily, fontSize, spacing, radii } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../lib/AuthContext';
import { useDataRefresh } from '../../lib/DataRefreshContext';
import { useToast } from '../../components/Toast';
import { previewInvite, joinSplit } from '../../lib/splits';
import { setPendingInvite, clearPendingInvite } from '../../lib/pendingInvite';

// Deep-link target for `flo://join/<code>` (expo-router resolves the scheme from
// app.json, so no manual Linking listener is needed).
//
// Deliberately NOT under app/split/ — a `split/join/CODE` path would sit
// alongside `split/[id]/…` and rely on static-beats-dynamic segment precedence.
// A top-level /join has no such ambiguity.
export default function JoinSplit() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { code } = useLocalSearchParams();
  const router = useRouter();
  const { session } = useAuth();
  const { notifyChanged } = useDataRefresh();
  const { showToast } = useToast();

  const [preview, setPreview] = useState(undefined); // undefined = loading, null = invalid
  const [joining, setJoining] = useState(false);

  // Park the code the moment we arrive, BEFORE anything can redirect. The common
  // path for a shared split is the worst case for routing: a friend taps the
  // link in WhatsApp, doesn't have FLO, installs it, and lands in onboarding —
  // by which point the deep link is long gone. PendingInviteHandler brings them
  // back here once there's a session.
  useEffect(() => {
    if (code) setPendingInvite(String(code));
  }, [code]);

  useEffect(() => {
    if (!session || !code) return;
    previewInvite(String(code)).then(({ preview: p }) => setPreview(p ?? null));
  }, [session, code]);

  async function handleJoin(claimMemberId) {
    setJoining(true);
    const { splitId, error } = await joinSplit({ code: String(code), claimMemberId });
    setJoining(false);
    if (error) {
      showToast({ message: error.message, variant: 'error' });
      return;
    }
    await clearPendingInvite();
    notifyChanged();
    router.replace(`/split/${splitId}`);
  }

  // Signed out: the code is already parked, so say what happens next rather
  // than bouncing them somewhere confusing.
  if (!session) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <IconTile tone="brand" size={56} radius={18}>
            <Users size={26} color={colors.brand} strokeWidth={2.2} />
          </IconTile>
          <Text style={styles.title}>You've been invited to a split</Text>
          <Text style={styles.body}>
            Sign in or create an account and we'll take you straight to it.
          </Text>
          <Button title="Continue" onPress={() => router.replace('/sign-in')} style={styles.cta} />
        </View>
      </SafeAreaView>
    );
  }

  if (preview === undefined) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.ink} />
        </View>
      </SafeAreaView>
    );
  }

  if (preview === null) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.title}>This link has expired</Text>
          <Text style={styles.body}>
            Invite links last {'14'} days and can be turned off by whoever created the split. Ask
            them for a fresh one.
          </Text>
          <Button
            title="Go to FLO"
            variant="outline"
            onPress={async () => {
              await clearPendingInvite();
              router.replace('/');
            }}
            style={styles.cta}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (preview.already_member) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.title}>You're already in {preview.name}</Text>
          <Button
            title="Open it"
            onPress={async () => {
              await clearPendingInvite();
              router.replace(`/split/${preview.split_id}`);
            }}
            style={styles.cta}
          />
        </View>
      </SafeAreaView>
    );
  }

  const claimable = preview.claimable ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.replace('/')}>
          <ChevronLeft size={20} color={colors.ink} strokeWidth={2.4} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <Card>
          <View style={styles.splitRow}>
            <IconTile tone="brandSolid" size={44} radius={13}>
              <CategoryIcon icon={preview.icon ?? 'travel'} size={21} color={colors.brandText} strokeWidth={2} />
            </IconTile>
            <View style={{ flex: 1 }}>
              <Text style={styles.splitName} numberOfLines={1}>
                {preview.name}
              </Text>
              <Text style={styles.splitSub}>
                {preview.occurred_on ? `${format(parseISO(preview.occurred_on), 'd MMM')} · ` : ''}
                {preview.member_count} {preview.member_count === 1 ? 'person' : 'people'}
              </Text>
            </View>
          </View>
        </Card>

        {/* What joining actually means, stated plainly. A link holder can see
            the split's spending and who owes whom — that's the point of it —
            but nothing of anyone's wider ledger. */}
        <Text style={styles.explain}>
          Joining lets you see what everyone spent on this split and add your own entries. It
          doesn't give anyone access to the rest of your FLO.
        </Text>

        {claimable.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Which one are you?</Text>
            {claimable.map((c) => (
              <Pressable
                key={c.member_id}
                style={styles.claimRow}
                disabled={joining}
                onPress={() => handleJoin(c.member_id)}
              >
                <Text style={styles.claimName}>{c.name}</Text>
                <Text style={styles.claimHint}>That's me</Text>
              </Pressable>
            ))}
            {/* Nobody in the list is them — a sixth person joining a group of
                five, rather than a ghost becoming real. */}
            <Pressable style={styles.claimRow} disabled={joining} onPress={() => handleJoin(null)}>
              <Text style={styles.claimName}>None of these</Text>
              <Text style={styles.claimHint}>Join as someone new</Text>
            </Pressable>
          </>
        ) : (
          <Button
            title="Join this split"
            onPress={() => handleJoin(null)}
            loading={joining}
            style={styles.cta}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      paddingTop: spacing.sm,
      paddingHorizontal: spacing.xl,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      gap: spacing.md,
    },
    content: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xl,
      gap: spacing.md,
    },
    title: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.display,
      letterSpacing: -0.3,
      color: colors.ink,
      textAlign: 'center',
    },
    body: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.md,
      color: colors.muted,
      textAlign: 'center',
      lineHeight: 21,
    },
    cta: {
      marginTop: spacing.md,
      alignSelf: 'stretch',
    },
    splitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
    },
    splitName: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.xxl,
      color: colors.ink,
    },
    splitSub: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.sm,
      color: colors.mutedMid,
      marginTop: 1,
    },
    explain: {
      fontFamily: fontFamily.medium,
      fontSize: fontSize.sm,
      color: colors.mutedMid,
      lineHeight: 19,
    },
    sectionLabel: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.sm,
      color: colors.mutedMid,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: spacing.sm,
    },
    claimRow: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.card,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    claimName: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.xl,
      color: colors.ink,
    },
    claimHint: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.base,
      color: colors.brand,
    },
  });
}
