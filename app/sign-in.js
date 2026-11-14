import { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Eye, EyeOff, Check, Circle } from 'lucide-react-native';
import PinnedFooter from '../components/ledger/PinnedFooter';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius, ledgerSize } from '../theme/ledger';
import { useAuth } from '../lib/AuthContext';
import { trackStepViewed } from '../lib/track';
import { passwordRules, passwordPasses, looksLikeEmail, authErrorLine } from '../lib/authRules';
import useKeyboardVisible from '../hooks/useKeyboardVisible';
import useAndroidKeyboardHeight from '../hooks/useAndroidKeyboardHeight';

// Sign-in, and sign-up (?mode=signup, from the opener's Create account), on
// the ledger kit (spec 47): a left-aligned title, labelled fields, a
// show/hide control, sign-up's live password rules, the terms line above a
// pinned button, and the link that switches modes.
//
// Fixed look: the ledger palette has no accent, so nothing here repaints
// into the account's colours when the session lands (spec 37's rule). Only
// the mode can change, and it follows the active Appearance like the rest
// of onboarding.
//
// Google sign-in stays parked (2026-10-27), its slot marked above the email
// field. Forgot password stays out until spec 42.
export default function SignIn() {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const keyboardUp = useKeyboardVisible();
  const keyboardHeight = useAndroidKeyboardHeight();
  const { signIn, signUp } = useAuth();
  const params = useLocalSearchParams();
  const [mode, setMode] = useState(params.mode === 'signup' ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const passwordRef = useRef(null);
  // The keyboard's Go and the button can both fire before `loading` renders.
  const submitting = useRef(false);

  const isSignUp = mode === 'signup';
  const rules = passwordRules(password);
  // Sign-in only needs something typed: an older account may predate the
  // sign-up rules, and the server judges the rest.
  const canSubmit = looksLikeEmail(email) && (isSignUp ? passwordPasses(password) : password.length > 0);

  // The funnel's auth step (35-onboarding-v3.md): sign-up mode only.
  useEffect(() => {
    if (isSignUp) trackStepViewed('auth');
  }, [isSignUp]);

  async function handleSubmit() {
    if (!canSubmit || submitting.current) return;
    submitting.current = true;
    setError(null);
    setLoading(true);
    try {
      if (isSignUp) await signUp(email.trim(), password);
      else await signIn(email.trim(), password);
    } catch (err) {
      setError(authErrorLine(err));
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  function switchMode() {
    setError(null);
    setMode(isSignUp ? 'signin' : 'signup');
  }

  return (
    // Android 16 is edge-to-edge, so the window doesn't resize for the
    // keyboard; pad by its height so the button rides on top of it. iOS
    // gets the same from KeyboardAvoidingView (the Android height is 0 there).
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { paddingTop: insets.top, paddingBottom: keyboardHeight }]}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title} accessibilityRole="header">
          {isSignUp ? 'Create your account' : 'Welcome back'}
        </Text>
        <Text style={styles.subtitle}>
          {isSignUp ? 'An email and a password, nothing else' : 'Sign in to pick up where you left off'}
        </Text>

        {/* Google's slot (parked 2026-10-27): "Continue with Google" and an
            "or" rule go here, sign-up only. The button and icon are in git
            history before spec 47. */}

        <Text style={styles.label} nativeID="emailLabel">
          Email
        </Text>
        <TextInput
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setError(null);
          }}
          placeholder="you@example.com"
          placeholderTextColor={c.muted}
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          accessibilityLabelledBy="emailLabel"
          accessibilityLabel="Email"
          style={styles.field}
        />

        <Text style={[styles.label, styles.labelGap]} nativeID="passwordLabel">
          Password
        </Text>
        <View style={styles.passwordRow}>
          <TextInput
            ref={passwordRef}
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setError(null);
            }}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            textContentType={isSignUp ? 'newPassword' : 'password'}
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
            accessibilityLabelledBy="passwordLabel"
            accessibilityLabel="Password"
            style={[styles.field, styles.passwordField]}
          />
          <Pressable
            onPress={() => setShowPassword((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            style={styles.eye}
          >
            {showPassword ? (
              <EyeOff size={20} color={c.muted} strokeWidth={1.75} />
            ) : (
              <Eye size={20} color={c.muted} strokeWidth={1.75} />
            )}
          </Pressable>
        </View>

        {isSignUp && (
          <View style={styles.rules}>
            {rules.map((rule) => (
              <View
                key={rule.key}
                style={styles.rule}
                accessible
                accessibilityLabel={`${rule.label}, ${rule.met ? 'met' : 'not yet'}`}
              >
                {rule.met ? (
                  <Check size={16} color={c.positive} strokeWidth={2.25} />
                ) : (
                  <Circle size={16} color={c.muted} strokeWidth={1.75} />
                )}
                <Text style={[styles.ruleText, { color: rule.met ? c.ink : c.muted }]}>{rule.label}</Text>
              </View>
            ))}
          </View>
        )}

        {!!error && (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        )}
      </ScrollView>

      {isSignUp && (
        <Text style={styles.terms}>By creating an account, you agree to FLO's terms and privacy policy.</Text>
      )}
      <PinnedFooter
        primary={{
          title: isSignUp ? 'Create account' : 'Sign in',
          onPress: handleSubmit,
          loading,
          disabled: !canSubmit,
        }}
        keyboardUp={keyboardUp}
        style={styles.footer}
      />
      <Pressable
        onPress={switchMode}
        accessibilityRole="button"
        style={[styles.switchRow, { paddingBottom: keyboardUp ? ledgerSpace.sm : insets.bottom + ledgerSpace.sm }]}
      >
        <Text style={styles.switchText}>
          {isSignUp ? 'Already have an account? ' : 'New to FLO? '}
          <Text style={styles.switchLink}>{isSignUp ? 'Sign in' : 'Create account'}</Text>
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.canvas,
    },
    content: {
      flexGrow: 1,
      paddingHorizontal: ledgerSpace.gutter,
      paddingTop: ledgerSpace.section * 2,
      paddingBottom: ledgerSpace.lg,
    },
    title: {
      ...ledgerType.display,
      color: c.ink,
    },
    subtitle: {
      ...ledgerType.body,
      color: c.muted,
      marginTop: ledgerSpace.sm,
      marginBottom: ledgerSpace.section,
    },
    label: {
      ...ledgerType.rowTitle,
      color: c.ink,
      marginBottom: ledgerSpace.sm,
    },
    labelGap: {
      marginTop: ledgerSpace.lg,
    },
    field: {
      height: ledgerSize.hit,
      paddingHorizontal: ledgerSpace.lg,
      paddingVertical: 0,
      borderRadius: ledgerRadius.field,
      backgroundColor: c.surfaceSunk,
      ...ledgerType.body,
      color: c.ink,
    },
    passwordRow: {
      justifyContent: 'center',
    },
    passwordField: {
      // Room for the show/hide target on the right.
      paddingRight: ledgerSize.hit,
    },
    eye: {
      position: 'absolute',
      right: 0,
      width: ledgerSize.hit,
      height: ledgerSize.hit,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rules: {
      marginTop: ledgerSpace.md,
      gap: ledgerSpace.xs,
    },
    rule: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ledgerSpace.sm,
    },
    ruleText: {
      ...ledgerType.caption,
    },
    error: {
      ...ledgerType.body,
      color: c.danger,
      marginTop: ledgerSpace.lg,
    },
    terms: {
      ...ledgerType.caption,
      color: c.muted,
      paddingHorizontal: ledgerSpace.gutter,
    },
    footer: {
      paddingBottom: ledgerSpace.xs,
    },
    switchRow: {
      alignItems: 'center',
      paddingTop: ledgerSpace.sm,
      minHeight: ledgerSize.hit,
      justifyContent: 'center',
    },
    switchText: {
      ...ledgerType.body,
      color: c.muted,
    },
    switchLink: {
      fontFamily: ledgerType.button.fontFamily,
      color: c.ink,
      textDecorationLine: 'underline',
    },
  });
}
