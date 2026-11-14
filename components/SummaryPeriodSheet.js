import { forwardRef } from 'react';
import { Text, StyleSheet } from 'react-native';
import { CalendarDays } from 'lucide-react-native';
import Sheet from './ledger/Sheet';
import ListRow from './ledger/ListRow';
import DayOfMonthPicker from './ledger/DayOfMonthPicker';
import useSheetBackHandler from '../hooks/useSheetBackHandler';
import { RESET_PERIOD_OPTIONS } from '../lib/periods';
import { useLedger, ledgerType, ledgerSpace } from '../theme/ledger';

// Settings → Summary period (30-summary-reset-period.md; Salary day from
// spec 47). Five choices don't fit a Segmented, so the row opens this sheet.
// `kind` picks the content: 'period' lists the choices, 'day' is the salary
// day grid. Picking applies through `onPick(value)` / `onPickDay(day)` and
// closes; Salary day with no day saved yet goes on to the grid (the screen
// switches `kind`), so reset_period and reset_month_day are written together.
//
// Local to Settings rather than an app-wide <XSheetProvider>: nothing else
// opens it.
const SummaryPeriodSheet = forwardRef(function SummaryPeriodSheet({ kind, period, monthDay, onPick, onPickDay }, ref) {
  const { c } = useLedger();
  const handleSheetChange = useSheetBackHandler(ref);

  const body =
    kind === 'day' ? (
      <>
        <DayOfMonthPicker value={monthDay} onChange={onPickDay} accessibilityLabel="Salary day" />
        <Text style={[ledgerType.caption, styles.note, { color: c.muted }]}>
          In a shorter month, a day past its end means its last day.
        </Text>
      </>
    ) : (
      RESET_PERIOD_OPTIONS.map((o, i) => (
        <ListRow
          key={o.value}
          icon={CalendarDays}
          title={o.label}
          trailing={period === o.value ? 'check' : undefined}
          onPress={() => onPick(o.value)}
          divider={i < RESET_PERIOD_OPTIONS.length - 1}
        />
      ))
    );

  return (
    <Sheet ref={ref} title={kind === 'day' ? 'Salary day' : 'Summary period'} onChange={handleSheetChange}>
      {body}
    </Sheet>
  );
});

export default SummaryPeriodSheet;

const styles = StyleSheet.create({
  note: {
    marginTop: ledgerSpace.md,
  },
});
