import { forwardRef, useImperativeHandle, useRef, useState, useCallback, createContext, useContext } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Layers, Target, Calendar, FileText, Users } from 'lucide-react-native';
import Sheet from './ledger/Sheet';
import ListRow from './ledger/ListRow';
import useSheetBackHandler from '../hooks/useSheetBackHandler';
import { useLedger, ledgerType, ledgerSpace } from '../theme/ledger';
import { PRO_BENEFITS, PRO_MONTHLY_EQUIVALENT } from '../lib/pro';

const DEFAULT_REASON = 'A little more room to grow.';
// The top benefits only, so the sheet fits without scrolling.
const UPSELL_BENEFITS = 4;
// lib/pro.js names each benefit's icon; the glyphs live here, not in lib.
const BENEFIT_ICONS = { layers: Layers, target: Target, calendar: Calendar, fileText: FileText, users: Users };

const ProUpsellSheetContext = createContext(null);

export function ProUpsellSheetProvider({ children }) {
  const sheetRef = useRef(null);
  const openProUpsell = useCallback((reason) => sheetRef.current?.open(reason), []);

  return (
    <ProUpsellSheetContext.Provider value={{ openProUpsell }}>
      {children}
      <ProUpsellSheet ref={sheetRef} />
    </ProUpsellSheetContext.Provider>
  );
}

export function useProUpsellSheet() {
  const ctx = useContext(ProUpsellSheetContext);
  if (!ctx) throw new Error('useProUpsellSheet must be used within ProUpsellSheetProvider');
  return ctx;
}

// The upsell (14-subscription-pro.md; on the ledger kit since spec 49, ticket
// 10): opened only from a create-time gate, which passes while FLAGS.billing
// is off, so it never shows in that build. The reason the gate gave, the
// benefits, and one button to Pro.
const ProUpsellSheet = forwardRef(function ProUpsellSheet(_props, ref) {
  const { c } = useLedger();
  const sheetRef = useRef(null);
  const handleSheetChange = useSheetBackHandler(sheetRef);
  const router = useRouter();
  const [reason, setReason] = useState(null);

  useImperativeHandle(ref, () => ({
    open(nextReason) {
      setReason(nextReason ?? null);
      sheetRef.current?.present();
    },
  }));

  function handleLevelUp() {
    sheetRef.current?.dismiss();
    router.push('/pro');
  }

  return (
    <Sheet
      ref={sheetRef}
      title="Go further with FLO"
      onChange={handleSheetChange}
      footer={{ primary: { title: `Level up for ${PRO_MONTHLY_EQUIVALENT}/mo`, onPress: handleLevelUp } }}
    >
      <Text style={[styles.reason, { color: c.muted }]}>{reason ?? DEFAULT_REASON}</Text>
      {PRO_BENEFITS.slice(0, UPSELL_BENEFITS).map((b, i, list) => (
        <ListRow
          key={b.title}
          icon={BENEFIT_ICONS[b.icon]}
          title={b.title}
          sub={b.body}
          subLines={2}
          divider={i < list.length - 1}
        />
      ))}
    </Sheet>
  );
});

const styles = StyleSheet.create({
  reason: {
    ...ledgerType.body,
    marginBottom: ledgerSpace.sm,
  },
});
