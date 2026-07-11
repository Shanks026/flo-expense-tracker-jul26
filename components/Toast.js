import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, TriangleAlert, Info, X } from 'lucide-react-native';
import { colors, radii, spacing, fontFamily, fontSize } from '../theme/tokens';

const MAX_VISIBLE = 3;

const VARIANTS = {
  success: { icon: Check, iconColor: colors.income, bg: colors.incomeBg },
  error: { icon: X, iconColor: colors.danger, bg: colors.dangerBg },
  warn: { icon: TriangleAlert, iconColor: colors.warn, bg: colors.warnBg },
  info: { icon: Info, iconColor: colors.surface, bg: colors.ink },
};

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
    <View style={[styles.host, { top: insets.top + spacing.sm }]} pointerEvents="box-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </View>
  );
}

function ToastItem({ toast, onDismiss }) {
  const progress = useRef(new Animated.Value(0)).current;
  const v = VARIANTS[toast.variant] ?? VARIANTS.info;
  const Icon = v.icon;

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

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] });

  return (
    <Animated.View style={[styles.item, { backgroundColor: v.bg, opacity: progress, transform: [{ translateY }] }]}>
      <Pressable style={styles.itemPressable} onPress={handleDismiss}>
        <View style={[styles.iconWrap, toast.variant === 'info' && styles.iconWrapOnDark]}>
          <Icon size={16} color={v.iconColor} strokeWidth={2.6} />
        </View>
        <Text style={[styles.message, toast.variant === 'info' && styles.messageOnDark]} numberOfLines={2}>
          {toast.message}
        </Text>
        {toast.actionLabel && (
          <Pressable
            style={styles.actionButton}
            onPress={() => {
              toast.onAction?.();
              handleDismiss();
            }}
          >
            <Text style={[styles.actionText, toast.variant === 'info' && styles.actionTextOnDark]}>{toast.actionLabel}</Text>
          </Pressable>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 999,
    elevation: 999,
    gap: spacing.sm,
  },
  item: {
    borderRadius: radii.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  itemPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapOnDark: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  message: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  messageOnDark: {
    color: colors.surface,
  },
  actionButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  actionText: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  actionTextOnDark: {
    color: colors.brand,
  },
});
