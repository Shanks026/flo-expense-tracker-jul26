import { Component, Fragment, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LifeBuoy } from 'lucide-react-native';
import Button from './Button';
import { radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

// Root render-error safety net (32-safe-closed-test-build.md). In-house, no
// third-party SDK — native crashes and ANRs are covered by Play Console's
// Android vitals. Sits just inside ThemeProvider (app/_layout.js) so the
// recovery screen can read the active theme, and wraps everything below it,
// including AuthProvider and the whole navigator.
//
// "Try again" bumps `resetKey`, which remounts the subtree from scratch.
// "Go to Home" does the same and then replaces the route, on the next tick so
// the remounted Stack exists to receive it.
export default class AppErrorBoundary extends Component {
  state = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Stays in the device log (adb logcat) for debugging; nothing is sent anywhere.
    console.error('AppErrorBoundary caught a render error', error, info?.componentStack);
  }

  reset = () => {
    this.setState((s) => ({ error: null, resetKey: s.resetKey + 1 }));
  };

  goHome = () => {
    this.reset();
    setTimeout(() => {
      try {
        router.replace('/');
      } catch {
        // Navigator not ready yet: the remount alone still recovers the app.
      }
    }, 0);
  };

  render() {
    if (this.state.error) {
      return <ErrorScreen error={this.state.error} onRetry={this.reset} onHome={this.goHome} />;
    }
    return <Fragment key={this.state.resetKey}>{this.props.children}</Fragment>;
  }
}

function ErrorScreen({ error, onRetry, onHome }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <View style={styles.iconTile}>
          <LifeBuoy size={30} color={colors.ink} strokeWidth={2} />
        </View>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.subtitle}>
          FLO hit a snag showing this screen. Your data is safe. Try again, or head back to Home.
        </Text>
        {__DEV__ && (
          <ScrollView style={styles.devBox} contentContainerStyle={styles.devBoxContent}>
            <Text style={styles.devText}>{String(error?.message ?? error)}</Text>
          </ScrollView>
        )}
      </View>
      <View style={styles.actions}>
        <Button title="Try again" onPress={onRetry} />
        <Button title="Go to Home" variant="outline" onPress={onHome} />
      </View>
    </SafeAreaView>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.bg,
      paddingHorizontal: spacing.xxl,
    },
    body: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconTile: {
      width: 64,
      height: 64,
      borderRadius: radii.iconTileLg,
      backgroundColor: colors.iconTileBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xl,
    },
    title: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.display,
      color: colors.ink,
      textAlign: 'center',
    },
    subtitle: {
      fontFamily: fontFamily.medium,
      fontSize: fontSize.lg,
      color: colors.muted,
      textAlign: 'center',
      marginTop: spacing.sm,
      lineHeight: 22,
    },
    devBox: {
      alignSelf: 'stretch',
      maxHeight: 160,
      marginTop: spacing.xl,
      borderRadius: radii.buttonSm,
      backgroundColor: colors.dangerBg,
    },
    devBoxContent: {
      padding: spacing.md,
    },
    devText: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.sm,
      color: colors.danger,
    },
    actions: {
      gap: spacing.md,
      paddingBottom: spacing.lg,
    },
  });
}
