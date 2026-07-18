import { forwardRef, useImperativeHandle, useRef, useState, useMemo, useCallback, createContext, useContext } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Image } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import * as ImagePicker from 'expo-image-picker';
import { X, Camera } from 'lucide-react-native';
import Button from './Button';
import { colors as staticColors, radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import useProfile from '../hooks/useProfile';
import { useToast } from './Toast';
import useSheetBackHandler from '../hooks/useSheetBackHandler';

const EditProfileSheetContext = createContext(null);

export function EditProfileSheetProvider({ children }) {
  const sheetRef = useRef(null);
  const openEditProfile = useCallback(() => sheetRef.current?.open(), []);

  return (
    <EditProfileSheetContext.Provider value={{ openEditProfile }}>
      {children}
      <EditProfileSheet ref={sheetRef} />
    </EditProfileSheetContext.Provider>
  );
}

export function useEditProfileSheet() {
  const ctx = useContext(EditProfileSheetContext);
  if (!ctx) throw new Error('useEditProfileSheet must be used within EditProfileSheetProvider');
  return ctx;
}

const EditProfileSheet = forwardRef(function EditProfileSheet(_props, ref) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const modalRef = useRef(null);
  const handleSheetChange = useSheetBackHandler(modalRef);
  const { session } = useAuth();
  const { profile, avatarUrl, updateProfile } = useProfile();
  const { showToast } = useToast();

  const [fullName, setFullName] = useState('');
  const [localImageUri, setLocalImageUri] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const initial = fullName?.[0]?.toUpperCase() ?? '?';
  const avatarSource = localImageUri ?? avatarUrl;

  useImperativeHandle(ref, () => ({
    open() {
      setError(null);
      setLocalImageUri(null);
      setFullName(profile?.full_name ?? '');
      modalRef.current?.present();
    },
  }));

  async function handlePickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast({ message: 'Photo library permission is required', variant: 'error' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]) {
      setLocalImageUri(result.assets[0].uri);
    }
  }

  async function handleSave() {
    if (!fullName.trim()) {
      setError('Enter your name');
      return;
    }
    setSaving(true);
    setError(null);

    // avatar_url stores the object PATH; the bucket is private and the display
    // URL is signed on read in useProfile.
    let avatarPath = profile?.avatar_url ?? null;

    if (localImageUri) {
      try {
        const arraybuffer = await fetch(localImageUri).then((res) => res.arrayBuffer());
        const path = `${session.user.id}/avatar.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, arraybuffer, { contentType: 'image/jpeg', upsert: true });
        if (uploadError) throw uploadError;
        avatarPath = path;
      } catch (err) {
        setSaving(false);
        showToast({ message: err.message, variant: 'error' });
        return;
      }
    }

    const { error: saveError } = await updateProfile({ full_name: fullName.trim(), avatar_url: avatarPath });
    setSaving(false);
    if (saveError) {
      showToast({ message: saveError.message, variant: 'error' });
      return;
    }
    modalRef.current?.dismiss();
    showToast({ message: 'Profile updated', variant: 'success' });
  }

  const renderBackdrop = useCallback(
    (props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
    []
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      onChange={handleSheetChange}
      snapPoints={useMemo(() => ['92%'], [])}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: staticColors.ink, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet }}
      handleIndicatorStyle={{ backgroundColor: '#3a3a3a', width: 44 }}
    >
      <BottomSheetScrollView style={{ flex: 1 }} contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <Pressable style={styles.closeButton} onPress={() => modalRef.current?.dismiss()}>
            <X size={16} color={staticColors.surface} strokeWidth={2.6} />
          </Pressable>
        </View>

        <Pressable style={styles.avatarWrap} onPress={handlePickImage}>
          {avatarSource ? (
            <Image source={{ uri: avatarSource }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
          )}
          <View style={styles.cameraBadge}>
            <Camera size={14} color={staticColors.ink} strokeWidth={2.2} />
          </View>
        </Pressable>

        <Text style={styles.fieldLabel}>Full Name</Text>
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Your name"
          placeholderTextColor={staticColors.mutedDarker}
          style={styles.textInput}
        />

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Button title="Save Changes" variant="primary" onPress={handleSave} loading={saving} style={{ marginTop: spacing.lg }} />
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

function makeStyles(colors) {
  return StyleSheet.create({
  sheet: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    alignItems: 'stretch',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xl,
    color: staticColors.surface,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: staticColors.inkCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: {
    alignSelf: 'center',
    marginBottom: spacing.xl,
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 26,
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 26,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: fontFamily.extrabold,
    fontSize: 32,
    color: staticColors.ink,
  },
  cameraBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 30,
    height: 30,
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
    borderWidth: 3,
    borderColor: staticColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: staticColors.mutedMid,
    marginBottom: spacing.sm,
  },
  textInput: {
    backgroundColor: staticColors.inkCard,
    borderRadius: 14,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: staticColors.surface,
  },
  errorText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    color: staticColors.dangerStrong,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  });
}
