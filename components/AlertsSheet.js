import { forwardRef, useImperativeHandle, useRef, useCallback, createContext, useContext } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Receipt, Wallet, Flag } from 'lucide-react-native';
import Sheet from './ledger/Sheet';
import SectionHeader from './ledger/SectionHeader';
import ListRow from './ledger/ListRow';
import EmptyState from './ledger/EmptyState';
import CategoryIcon from './CategoryIcon';
import { useLedger, ledgerSpace } from '../theme/ledger';
import useAlerts from '../hooks/useAlerts';
import useSheetBackHandler from '../hooks/useSheetBackHandler';

const AlertsSheetContext = createContext(null);

export function AlertsSheetProvider({ children }) {
  const sheetRef = useRef(null);
  const openAlerts = useCallback(() => sheetRef.current?.open(), []);

  return (
    <AlertsSheetContext.Provider value={{ openAlerts }}>
      {children}
      <AlertsSheet ref={sheetRef} />
    </AlertsSheetContext.Provider>
  );
}

export function useAlertsSheet() {
  const ctx = useContext(AlertsSheetContext);
  if (!ctx) throw new Error('useAlertsSheet must be used within AlertsSheetProvider');
  return ctx;
}

// Budgets and plans get a glyph per group; bills show their own icon.
const GROUP_ICON = { budgets: Wallet, plans: Flag };

// The bell's sheet (spec 49, ticket 05): the alerts grouped under Overdue,
// Budgets and Due soon (lib/alertGroups.js), each a row with a circle washed
// in danger or warn. A tap closes the sheet, then opens that bill's or
// budget's screen.
const AlertsSheet = forwardRef(function AlertsSheet(_props, ref) {
  const { c } = useLedger();
  const sheetRef = useRef(null);
  const handleSheetChange = useSheetBackHandler(sheetRef);
  const pendingRef = useRef(null);
  const router = useRouter();
  const { groups } = useAlerts();

  useImperativeHandle(ref, () => ({
    open() {
      sheetRef.current?.present();
    },
  }));

  // The route opens once the sheet has gone, so the screen isn't pushed
  // under a closing sheet.
  function go(route) {
    pendingRef.current = route;
    sheetRef.current?.dismiss();
  }

  function handleDismiss() {
    const route = pendingRef.current;
    pendingRef.current = null;
    if (route) router.push(route);
  }

  return (
    <Sheet ref={sheetRef} title="Alerts" onChange={handleSheetChange} onDismiss={handleDismiss}>
      {groups.length === 0 ? (
        <EmptyState illustration={null} title="You're all caught up" body="Bills due and budget warnings show up here." />
      ) : (
        groups.map((g, gi) => (
          <View key={g.key} style={gi > 0 && { marginTop: ledgerSpace.lg }}>
            <SectionHeader title={g.title} titleColor={g.tone === 'danger' ? c.danger : undefined} />
            {g.alerts.map((alert, i) => (
              <ListRow
                key={alert.id}
                icon={alert.iconKey ? undefined : GROUP_ICON[g.key] ?? Receipt}
                renderIcon={alert.iconKey ? (tint) => <CategoryIcon icon={alert.iconKey} size={18} color={tint} strokeWidth={1.75} /> : undefined}
                tone={alert.tone === 'danger' ? c.danger : c.warn}
                title={alert.title}
                sub={alert.sub}
                subColor={alert.tone === 'danger' ? c.danger : undefined}
                trailing="chevron"
                onPress={() => go(alert.route)}
                divider={i < g.alerts.length - 1}
              />
            ))}
          </View>
        ))
      )}
    </Sheet>
  );
});
