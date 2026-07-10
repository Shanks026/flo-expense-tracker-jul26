import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';

export default function usePlans() {
  const { version } = useDataRefresh();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from('v_plans_with_totals')
      .select('*')
      .order('status', { ascending: true })
      .order('created_at', { ascending: false });
    if (!error) setPlans(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  return {
    plans,
    activePlans: plans.filter((p) => p.status === 'active'),
    loading,
    refetch,
  };
}

export function usePlan(planId) {
  const { version } = useDataRefresh();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!planId) return;
    const { data, error } = await supabase.from('v_plans_with_totals').select('*').eq('id', planId).maybeSingle();
    setPlan(error ? null : data);
    setLoading(false);
  }, [planId]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  return { plan, loading, refetch };
}
