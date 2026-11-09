import { useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import Row, { RowGroup } from '../../components/Row';
import SegmentedChoice from '../../components/SegmentedChoice';
import Button from '../../components/Button';
import { fontFamily, type, spacing, radius } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { quickParse } from '../../lib/quickParse';
import { aiQuickAddEval } from '../../lib/ai';
import { EVAL_ACCOUNTS, EVAL_CASES, EVAL_TODAY, EVAL_TZ } from '../../lib/aiEvalCases';
import { categoriesFor, readable, scoreCase, percentile } from '../../lib/aiEvalScore';

// The phase 1 gate (44-ai-assistant.md §1.7, ticket 03). Runs the 40-phrase
// test set the way the Add sheet does: the phone's parser first, then the
// ai-assistant function for whatever the parser isn't sure about. Shows,
// per case, whether every scored field is right, which path answered, and
// the model's round trip; then the totals and p50/p90.
//
// The function gets the test set's own accounts, categories and fixed date
// (Thu 12 Nov 2026, 13:30 IST), and only the chosen model, with no
// fallback. Each run also prints a JSON summary to the Metro log.
//
// Development builds only: release builds have __DEV__ false and the route
// sends them Home. Each model call is a real, metered call.
export default function AiEvalScreen() {
  if (!__DEV__) return <Redirect href="/" />;
  return <AiEval />;
}

const EVAL_TIME = '13:30';

function AiEval() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [setName, setSetName] = useState('start');
  const [model, setModel] = useState('default');
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const runRef = useRef(0);

  async function run() {
    const runId = ++runRef.current;
    setRunning(true);
    setRows([]);
    setSummary(null);
    const categories = categoriesFor(setName);
    const results = [];
    // One case at a time, so the timings aren't skewed by parallel calls.
    for (const testCase of EVAL_CASES) {
      const local = quickParse(testCase.text, { categories, accounts: EVAL_ACCOUNTS, today: EVAL_TODAY });
      let row;
      if (local) {
        row = { path: 'phone', got: readable(local, categories) };
      } else {
        const answer = await aiQuickAddEval(testCase.text, {
          categories,
          accounts: EVAL_ACCOUNTS,
          today: EVAL_TODAY,
          time: EVAL_TIME,
          tz: EVAL_TZ,
          model,
        });
        row = {
          path: 'model',
          got: readable(answer.prefill, categories),
          ms: answer.ms,
          model: answer.model,
          reason: answer.reason,
        };
      }
      if (runId !== runRef.current) return;
      const score = scoreCase(testCase, row.got, setName);
      results.push({ id: testCase.id, text: testCase.text, ...row, ...score });
      setRows([...results]);
    }

    const modelRows = results.filter((r) => r.path === 'model');
    const answered = modelRows.filter((r) => r.reason !== 'error');
    const times = answered.map((r) => r.ms);
    const next = {
      set: setName,
      model,
      modelId: modelRows.find((r) => r.model)?.model ?? null,
      total: results.length,
      correct: results.filter((r) => r.correct).length,
      phone: results.filter((r) => r.path === 'phone').length,
      phoneCorrect: results.filter((r) => r.path === 'phone' && r.correct).length,
      modelCalls: modelRows.length,
      modelCorrect: modelRows.filter((r) => r.correct).length,
      modelErrors: modelRows.length - answered.length,
      p50: percentile(times, 50),
      p90: percentile(times, 90),
    };
    setSummary(next);
    setRunning(false);
    console.log(
      'AI_EVAL_RESULT',
      JSON.stringify({
        ...next,
        cases: results.map(({ id, text, path, correct, problems, ms, model: m, reason }) => ({
          id,
          text,
          path,
          correct,
          problems,
          ms,
          model: m,
          reason,
        })),
      })
    );
  }

  const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—');
  const secs = (ms) => (ms == null ? '—' : `${(ms / 1000).toFixed(2)} s`);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <RowGroup title="Phase 1 test set" footer="Model calls are real and metered. The gate counts the starting set on the default model.">
        <Row title="Categories">
          <SegmentedChoice
            accessibilityLabel="Category set"
            options={[
              { value: 'start', label: 'Starting' },
              { value: 'current', label: 'Current' },
            ]}
            value={setName}
            onChange={setSetName}
          />
        </Row>
        <Row title="Model">
          <SegmentedChoice
            accessibilityLabel="Model"
            options={[
              { value: 'default', label: 'Default' },
              { value: 'challenger', label: 'Challenger' },
            ]}
            value={model}
            onChange={setModel}
          />
        </Row>
      </RowGroup>

      <Button title={running ? `Running… ${rows.length}/${EVAL_CASES.length}` : 'Run 40 phrases'} onPress={run} loading={running} disabled={running} />

      {summary && (
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>
            {summary.correct}/{summary.total} fully correct · {pct(summary.correct, summary.total)}
          </Text>
          <Text style={styles.summaryLine}>
            Phone answered {summary.phone} ({pct(summary.phone, summary.total)}), {summary.phoneCorrect} right
          </Text>
          <Text style={styles.summaryLine}>
            Model: {summary.modelCalls} calls, {summary.modelCorrect} right, {summary.modelErrors} errors
          </Text>
          <Text style={styles.summaryLine}>
            p50 {secs(summary.p50)} · p90 {secs(summary.p90)}
          </Text>
          <Text style={styles.summaryLine}>{summary.modelId ?? 'no model answered'}</Text>
        </View>
      )}

      {rows.map((r) => (
        <View key={r.id} style={styles.case}>
          <Text style={[styles.mark, { color: r.correct ? colors.income : colors.danger }]}>{r.correct ? '✓' : '✗'}</Text>
          <View style={styles.caseBody}>
            <Text style={styles.caseText}>
              {r.id}. {r.text}
            </Text>
            <Text style={styles.caseMeta}>
              {r.path === 'phone' ? 'phone' : `model · ${secs(r.ms)}${r.reason ? ` · ${r.reason}` : ''}`}
            </Text>
            {r.problems.length > 0 && <Text style={styles.caseProblem}>{r.problems.join('\n')}</Text>}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    content: {
      padding: spacing.lg,
      paddingBottom: spacing.sectionLg,
      gap: spacing.lg,
    },
    summary: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.xs,
    },
    summaryTitle: {
      fontFamily: fontFamily.extrabold,
      fontSize: type.title,
      color: colors.ink,
    },
    summaryLine: {
      fontFamily: fontFamily.semibold,
      fontSize: type.body,
      color: colors.muted,
    },
    case: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    mark: {
      fontFamily: fontFamily.extrabold,
      fontSize: type.bodyLg,
      width: 20,
    },
    caseBody: {
      flex: 1,
    },
    caseText: {
      fontFamily: fontFamily.semibold,
      fontSize: type.body,
      color: colors.ink,
    },
    caseMeta: {
      fontFamily: fontFamily.semibold,
      fontSize: type.caption,
      color: colors.muted,
    },
    caseProblem: {
      fontFamily: fontFamily.semibold,
      fontSize: type.caption,
      color: colors.danger,
    },
  });
}
