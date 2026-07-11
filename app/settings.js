import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Modal, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, CircleDollarSign, Grid2x2, SunMedium, Trash2, TriangleAlert } from 'lucide-react-native';
import Card from '../components/Card';
import { colors, fontFamily, fontSize, spacing, radii } from '../theme/tokens';
import { useAuth } from '../lib/AuthContext';
import useProfile from '../hooks/useProfile';
import { useEditProfileSheet } from '../components/EditProfileSheet';

export default function Settings() {
  const router = useRouter();
  const { session, deleteAccount } = useAuth();
  const { profile, avatarUrl } = useProfile();
  const { openEditProfile } = useEditProfileSheet();

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const fullName = profile?.full_name ?? session?.user?.user_metadata?.full_name ?? '';
  const initial = fullName?.[0]?.toUpperCase() ?? '?';

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      // On success, signOut inside deleteAccount flips the session to null and
      // the root navigator redirects to sign-in — nothing else to do here.
    } catch (err) {
      setDeleting(false);
      setDeleteError(err.message ?? 'Could not delete your account. Try again.');
    }
  }

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
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
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

        <Pressable style={styles.deleteButton} onPress={() => { setDeleteError(null); setConfirmVisible(true); }}>
          <Trash2 size={19} color={colors.danger} strokeWidth={2.2} />
          <Text style={styles.deleteText}>Delete Account</Text>
        </Pressable>

        <Text style={styles.version}>FLO v1.0.0</Text>
      </ScrollView>

      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!deleting) setConfirmVisible(false); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <TriangleAlert size={26} color={colors.danger} strokeWidth={2.2} />
            </View>
            <Text style={styles.modalTitle}>Delete Account?</Text>
            <Text style={styles.modalBody}>
              This permanently deletes your account and everything in it — all
              accounts, transactions, budgets, plans and your profile. This
              cannot be undone.
            </Text>

            {deleteError && <Text style={styles.modalError}>{deleteError}</Text>}

            <Pressable
              style={[styles.modalDelete, deleting && styles.modalDeleteDisabled]}
              onPress={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.modalDeleteText}>Delete Everything</Text>
              )}
            </Pressable>
            <Pressable
              style={styles.modalCancel}
              onPress={() => setConfirmVisible(false)}
              disabled={deleting}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  deleteButton: {
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
  deleteText: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.lg,
    color: colors.danger,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radii.cardLg,
    padding: spacing.xl,
    alignItems: 'center',
  },
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.title,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  modalBody: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  modalError: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    color: colors.dangerStrong,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  modalDelete: {
    width: '100%',
    height: 54,
    borderRadius: radii.buttonSm + 4,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDeleteDisabled: {
    opacity: 0.7,
  },
  modalDeleteText: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.lg,
    color: colors.surface,
  },
  modalCancel: {
    width: '100%',
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  modalCancelText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.muted,
  },
  version: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.mutedLight,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
