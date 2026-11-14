import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, TriangleAlert, X } from 'lucide-react-native';
import { useLedger, ledgerPalettes, ledgerType, ledgerSpace, ledgerRadius, inter } from '../theme/ledger';

const MAX_VISIBLE = 3;

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ message, variant = 'info', actionLabel, onAction, duration }) => {
      const id = ++idRef.current;
      const resolvedDuration = duration ?? (actionLabel ? 5000 : 3000);
      setToasts((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), { id, message, variant, actionLabel, onAction, duration: resolvedDuration }]);
      return id;
    },
    []
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

function ToastHost({ toasts, onDismiss }) {
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <View style={[styles.host, { top: insets.top + ledgerSpace.sm }]} pointerEvents="box-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </View>
  );
}

// Status glyphs (spec 49, ticket 04): a tick for success, a cross for an
// error, a warning sign for warn. 'info' (showToast's default) is a plain
// message with no glyph.
const GLYPHS = {
  success: { icon: Check, tone: 'positive' },
  error: { icon: X, tone: 'danger' },
  warn: { icon: TriangleAlert, tone: 'warn' },
};

function ToastItem({ toast, onDismiss }) {
  const { c, modeId } = useLedger();
  // The pill is ink (black in light, near-white in dark), so its status
  // colours come from the other mode's palette, where they're built to read
  // on that background.
  const onPill = ledgerPalettes[modeId === 'dark' ? 'light' : 'dark'];
  const progress = useRef(new Animated.Value(0)).current;
  const glyph = GLYPHS[toast.variant];
  const Icon = glyph?.icon;

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 220, useNativeDriver: true }).start();

    const timer = setTimeout(() => handleDismiss(), toast.duration);
    return () => clearTimeout(timer);
  }, []);

  function handleDismiss() {
    Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: true }).start(({ finished }) => {
      if (finished) onDismiss();
    });
  }

  // Fades in place, with no slide (spec 46), so a fast tap on Undo lands
  // where the button already is.
  return (
    <Animated.View style={[styles.item, { backgroundColor: c.ink, shadowColor: c.shadow, opacity: progress }]}>
      <Pressable style={styles.itemPressable} onPress={handleDismiss} accessibilityRole="alert">
        {Icon && <Icon size={16} color={onPill[glyph.tone]} strokeWidth={2.25} />}
        <Text style={[styles.message, { color: c.inkOnInk }]} numberOfLines={2}>
          {toast.message}
        </Text>
        {toast.actionLabel && (
          <Pressable
            style={styles.actionButton}
            hitSlop={8}
            accessibilityRole="button"
            onPress={() => {
              toast.onAction?.();
              handleDismiss();
            }}
          >
            <Text style={[styles.actionText, { color: c.inkOnInk }]}>{toast.actionLabel}</Text>
          </Pressable>
        )}
      </Pressable>
    </Animated.View>
  );
}

// An ink capsule with inkOnInk text (redesign §2.5, spec 49 ticket 04).
const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: ledgerSpace.gutter,
    right: ledgerSpace.gutter,
    zIndex: 999,
    elevation: 999,
    gap: ledgerSpace.sm,
    alignItems: 'center',
  },
  item: {
    maxWidth: '100%',
    borderRadius: ledgerRadius.full,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  itemPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ledgerSpace.sm,
    minHeight: 44,
    paddingVertical: ledgerSpace.sm,
    paddingHorizontal: ledgerSpace.lg,
  },
  message: {
    ...ledgerType.body,
    flexShrink: 1,
  },
  actionButton: {
    paddingLeft: ledgerSpace.sm,
    paddingVertical: ledgerSpace.xs,
  },
  actionText: {
    ...ledgerType.body,
    fontFamily: inter.semibold,
  },
});
