import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { getReportSettings, isReportDue, currentReportPeriod } from '../lib/reports';

// Whether a scheduled report is due and unseen, right now — the single check
// both the Home "report ready" card and the bell/Alerts feed rely on (added
// 11-reports.md Phase 2), so a future change to what counts as "due" only
// needs to happen in one place. Like every other alert in this app, nothing
// here is stored — it's a live read of settings + seen-state.
export default function useReportDue() {
  const { session } = useAuth();
  const { version } = useDataRefresh();
  const userId = session?.user?.id ?? null;
  const [due, setDue] = useState(null); // null | { cadence, period }

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!userId) {
        if (!cancelled) setDue(null);
        return;
      }
      const settings = await getReportSettings();
      if (settings.cadence === 'off') {
        if (!cancelled) setDue(null);
        return;
      }
      const now = new Date();
      const isDue = await isReportDue(settings, userId, now);
      if (cancelled) return;
      setDue(isDue ? { cadence: settings.cadence, period: currentReportPeriod(settings, now) } : null);
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [userId, version]);

  return { due };
}
