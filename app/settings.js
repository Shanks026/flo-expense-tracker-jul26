import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, CircleDollarSign, Grid2x2, SunMedium, LogOut } from 'lucide-react-native';
import Card from '../components/Card';
import { colors, fontFamily, fontSize, spacing, radii } from '../theme/tokens';
import { useAuth } from '../lib/AuthContext';
import useProfile from '../hooks/useProfile';
import { useEditProfileSheet } from '../components/EditProfileSheet';

export default function Settings() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const { profile } = useProfile();
  const { openEditProfile } = useEditProfileSheet();

  const fullName = profile?.full_name ?? session?.user?.user_metadata?.full_name ?? '';
  const initial = fullName?.[0]?.toUpperCase() ?? '?';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={20} color={colors.ink} strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Pressable onPress={openEditProfile}>
          <Card dark style={styles.profileCard}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName} numberOfLines={1}>
                {fullName || 'Add your name'}
              </Text>
              <Text style={styles.profileEmail} numberOfLines={1}>
                {session?.user?.email}
              </Text>
            </View>
          </Card>
        </Pressable>

        <Card style={styles.rowsCard}>
          <View style={[styles.row, styles.rowBorder]}>
            <View style={styles.rowIcon}>
              <CircleDollarSign size={20} color={colors.ink} strokeWidth={2} />
            </View>
            <Text style={styles.rowTitle}>Currency</Text>
            <Text style={styles.rowValue}>₹ INR</Text>
          </View>

          <Pressable style={[styles.row, styles.rowBorder]} onPress={() => router.push('/manage-categories')}>
            <View style={styles.rowIcon}>
              <Grid2x2 size={20} color={colors.ink} strokeWidth={2} />
            </View>
            <Text style={styles.rowTitle}>Manage Categories</Text>
            <ChevronRight size={18} color={colors.chevron} strokeWidth={2.4} />
          </Pressable>

          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <SunMedium size={20} color={colors.ink} strokeWidth={2} />
            </View>
            <Text style={styles.rowTitle}>Appearance</Text>
            <Text style={styles.rowValue}>Light</Text>
          </View>
        </Card>

        <Pressable style={styles.logoutButton} onPress={signOut}>
          <LogOut size={19} color={colors.danger} strokeWidth={2.2} />
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>

        <Text style={styles.version}>FLO v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
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
  headerTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.title,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 60,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    borderRadius: radii.cardLg,
    padding: 22,
    marginBottom: spacing.xl,
  },
  avatarImage: {
    width: 62,
    height: 62,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: fontFamily.extrabold,
    fontSize: 24,
    color: colors.ink,
  },
  profileName: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.heading,
    color: colors.surface,
  },
  profileEmail: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
    color: colors.mutedMid,
    marginTop: 2,
  },
  rowsCard: {
    padding: 0,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 17,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.iconTileBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.ink,
  },
  rowValue: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.md,
    color: colors.muted,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    height: 56,
    borderRadius: radii.buttonSm + 4,
    borderWidth: 1.5,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.surface,
    marginTop: spacing.lg,
  },
  logoutText: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.lg,
    color: colors.danger,
  },
  version: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.mutedLight,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
