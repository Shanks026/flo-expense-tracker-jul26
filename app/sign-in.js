import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, Lock, Eye, EyeOff, User } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import Button from '../components/Button';
import Logo from '../components/Logo';
import { colors, radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { useAuth } from '../lib/AuthContext';

export default function SignIn() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('signin');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isSignUp = mode === 'signup';
  const canSubmit = isSignUp
    ? email && password && firstName.trim() && lastName.trim()
    : email && password;

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email.trim(), password, `${firstName.trim()} ${lastName.trim()}`.trim());
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.spacerTop} />

          <View style={styles.brandRow}>
            <Logo size={52} radius={26} />
          </View>

          <View style={{ height: 20 }} />
          <Text style={styles.title}>{isSignUp ? 'Create account' : 'Welcome back'}</Text>
          <Text style={styles.subtitle}>Know where your money flows.</Text>

          <View style={{ height: 40 }} />

          {isSignUp && (
            <>
              <View style={styles.nameRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>First name</Text>
                  <View style={styles.inputRow}>
                    <User size={18} color={colors.mutedMid} strokeWidth={2} />
                    <TextInput
                      value={firstName}
                      onChangeText={setFirstName}
                      placeholder="Jacob"
                      placeholderTextColor={colors.mutedLight}
                      autoCapitalize="words"
                      style={styles.input}
                    />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Last name</Text>
                  <View style={styles.inputRow}>
                    <User size={18} color={colors.mutedMid} strokeWidth={2} />
                    <TextInput
                      value={lastName}
                      onChangeText={setLastName}
                      placeholder="Joestar"
                      placeholderTextColor={colors.mutedLight}
                      autoCapitalize="words"
                      style={styles.input}
                    />
                  </View>
                </View>
              </View>
              <View style={{ height: 16 }} />
            </>
          )}

          <Text style={styles.label}>Email</Text>
          <View style={styles.inputRow}>
            <Mail size={18} color={colors.mutedMid} strokeWidth={2} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@email.com"
              placeholderTextColor={colors.mutedLight}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              style={styles.input}
            />
          </View>

          <View style={{ height: 16 }} />
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputRow}>
            <Lock size={18} color={colors.mutedMid} strokeWidth={2} />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.mutedLight}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              style={[styles.input, { letterSpacing: showPassword ? 0 : 3 }]}
            />
            <Pressable onPress={() => setShowPassword((v) => !v)}>
              {showPassword ? (
                <EyeOff size={18} color={colors.mutedMid} strokeWidth={2} />
              ) : (
                <Eye size={18} color={colors.mutedMid} strokeWidth={2} />
              )}
            </Pressable>
          </View>

          {!isSignUp && (
            <Pressable style={styles.forgotRow}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}

          <View style={{ height: isSignUp ? 24 : 28 }} />
          <Button
            title={isSignUp ? 'Create Account' : 'Sign In'}
            onPress={handleSubmit}
            loading={loading}
            disabled={!canSubmit}
          />

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={[styles.googleButton, styles.googleButtonDisabled]}>
            <GoogleIcon />
            <Text style={styles.googleText}>Continue with Google</Text>
          </View>

          <View style={{ flex: 1 }} />
          <Pressable
            style={styles.switchRow}
            onPress={() => {
              setError(null);
              setMode(isSignUp ? 'signin' : 'signup');
            }}
          >
            <Text style={styles.switchText}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={styles.switchTextBold}>{isSignUp ? 'Sign In' : 'Sign Up'}</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function GoogleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M22.5 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2-1.9 3.3-4.7 3.3-7.9Z" />
      <Path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.3-1.9-6.2-4.6H2.2v2.8A11 11 0 0 0 12 23Z" />
      <Path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.2a11 11 0 0 0 0 9.8l3.6-2.8Z" />
      <Path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.2 7.1l3.6 2.8C6.7 7.3 9.1 5.4 12 5.4Z" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xxl,
  },
  spacerTop: {
    height: 32,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.hero,
    letterSpacing: -0.4,
    lineHeight: 34,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xl,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  label: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
    color: colors.mutedDarker,
    marginBottom: spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  inputRow: {
    height: 56,
    borderRadius: radii.buttonSm,
    backgroundColor: colors.inputBg,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: 10,
  },
  input: {
    flex: 1,
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xl,
    color: colors.ink,
    height: '100%',
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginTop: spacing.md,
  },
  forgotText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
    color: colors.muted,
  },
  errorText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    color: colors.danger,
    marginTop: spacing.md,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginVertical: spacing.xxl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    color: colors.mutedLight,
  },
  googleButton: {
    height: 56,
    borderRadius: radii.button,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleButtonDisabled: {
    opacity: 0.45,
  },
  googleText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.ink,
  },
  switchRow: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  switchText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.lg,
    color: colors.muted,
  },
  switchTextBold: {
    fontFamily: fontFamily.extrabold,
    color: colors.ink,
  },
});
