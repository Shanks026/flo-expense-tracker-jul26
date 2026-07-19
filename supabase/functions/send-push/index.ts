// send-push — 17-server-push-notifications.md.
//
// Two modes, one function:
//   { "mode": "cron" }     — the real batch job. pg_cron calls this every 15
//                            minutes (see the pg_cron_reminders /
//                            reminder_sends_and_cron migrations). Sends
//                            three kinds of push, each idempotent via a
//                            (user, trigger, ref) claim in reminder_sends
//                            before sending, so an overlapping or retried
//                            run can't double-send:
//                              - morning/evening nudge (Phase 2) — whoever's
//                                local clock just hit their configured time;
//                                evening skipped if already logged today.
//                              - bill_due (Phase 3) — whoever has an active
//                                bill whose (due date − days-before) is
//                                today, in their own timezone.
//                              - report_ready (Phase 3) — whoever's report
//                                cadence (weekly/monthly) is due today, at
//                                their configured time.
//   { "userId": "<uuid>" } — Phase 1's manual single-user test-send, kept
//                            for continued debugging.
//
// Uses the service-role key (auto-injected as SUPABASE_SERVICE_ROLE_KEY by
// the Edge Functions runtime — never set this as a secret manually, same
// note as ai-interpret's lib/entitlements.ts) so it can read across every
// user, not just one.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getReminderCopy } from './reminderCopy.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// ₹ + en-IN grouping — matches lib/currency.js's formatMoney exactly
// (`${symbol}${amount.toLocaleString(locale, {maximumFractionDigits:2})}`),
// duplicated here for the same reason reminderCopy.ts is: Deno can't
// import the RN module graph. The local bill-due scheduler never passed a
// bill's own currency either (lib/notifications.js's removed
// doRescheduleAll just called formatMoney(bill.amount) with no currency
// arg) — matched here, not a new gap this phase introduces.
function formatMoney(amount: number) {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

// Locale-independent local-time/date parts for a given IANA timezone — used
// instead of parsing weekday NAMES (which Intl would localize) by deriving
// dayOfWeek from the same y/m/d parts via Date.UTC + getUTCDay(), matching
// JS's own Date#getDay() convention (0 = Sunday) that lib/greetings.js and
// lib/reminderCopy.js are both keyed on.
function getLocalParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value])) as Record<string, string>;
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  return {
    year,
    month,
    day,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    dayOfWeek: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
  };
}

// Snaps both times to the same 15-minute grid the cron itself runs on
// (*/15 * * * *), so an arbitrary user-picked reminder time (e.g. 08:07)
// still fires on whichever tick it falls inside, exactly once per bucket.
function isWithinBucket(localNow: { hour: number; minute: number }, targetTime: string) {
  const [targetHourStr, targetMinuteStr] = (targetTime ?? '00:00').split(':');
  const bucket = (m: number) => Math.floor(m / 15) * 15;
  return localNow.hour === Number(targetHourStr) && bucket(localNow.minute) === bucket(Number(targetMinuteStr));
}

// Last day of a given local year/month (1-12) — used to clamp a monthly
// report's configured day-of-month, mirroring lib/reports.js's
// reportDueMoment() (`Math.min(settings.dayOfMonth, getDaysInMonth(now))`)
// so a "31st" cadence still fires in February server-side, the same as it
// would have client-side.
function daysInLocalMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// `next_due_date` is a plain SQL `date` (no time/timezone attached) — days
// arithmetic on the calendar string directly, no timezone conversion
// needed since a `date` column has none to convert.
function subtractDays(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

// Claim-then-act, not check-then-act — inserting IS the idempotency check.
// reminder_sends' UNIQUE (user_id, trigger, ref) constraint rejects a
// second claim for the same (user, trigger, ref), so two overlapping cron
// runs can't both decide to send. Same reasoning IDEAS-gamification.md
// already documents for reward_events' claim-once design. `ref` is the
// user's local date for nudge/report triggers, and `${billId}:${date}` for
// bill_due — a user can have several bills due the same day, each needing
// its own claim.
async function tryClaim(supabase: ReturnType<typeof createClient>, userId: string, trigger: string, ref: string) {
  const { error } = await supabase.from('reminder_sends').insert({ user_id: userId, trigger, ref });
  return !error;
}

// Fails OPEN (treats an error as "not logged") rather than closed — for the
// today-check, a redundant nudge to someone who already logged is mildly
// annoying; silently never nudging someone because a status check errored
// defeats the entire feature. For the yesterday-check, "not logged" just
// picks the gentler restart copy pool instead of the momentum one — the
// lesser failure mode either way.
async function hasLoggedOnRelativeDay(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  timezone: string,
  daysAgo: number
) {
  const { data, error } = await supabase.rpc('has_logged_on_relative_day', {
    p_user_id: userId,
    p_timezone: timezone,
    p_days_ago: daysAgo,
  });
  if (error) {
    console.error('send-push: has_logged_on_relative_day check failed:', error.message);
    return false;
  }
  return data === true;
}

type PushExtra = { channelId: string; categoryId?: string; data?: Record<string, unknown> };

async function sendPushToUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  title: string,
  body: string,
  extra: PushExtra
) {
  const { data: tokens, error } = await supabase.from('push_tokens').select('token').eq('user_id', userId);
  if (error) {
    console.error('send-push: push_tokens read failed:', error.message);
    return false;
  }
  if (!tokens || tokens.length === 0) return false;

  const messages = tokens.map(({ token }: { token: string }) => ({
    to: token,
    title,
    body,
    sound: 'default',
    channelId: extra.channelId,
    ...(extra.categoryId ? { categoryId: extra.categoryId } : {}),
    ...(extra.data ? { data: extra.data } : {}),
  }));

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  if (!res.ok) {
    console.error('send-push: Expo push API error:', res.status, await res.text());
    return false;
  }

  // Expo's push endpoint returns HTTP 200 even when an individual ticket
  // failed (e.g. FCM credentials misconfigured on the Expo/EAS project) —
  // res.ok alone was reporting every send as successful regardless of
  // whether the device actually received anything. Found via a real device
  // test where "sent" showed true but nothing arrived; the ticket itself
  // said `{"status":"error","details":{"error":"InvalidCredentials"}}`.
  const result = await res.json();
  const tickets = Array.isArray(result?.data) ? result.data : [];
  const errors = tickets.filter((t: { status?: string }) => t?.status === 'error');
  if (errors.length > 0) {
    console.error('send-push: Expo push ticket error(s):', JSON.stringify(errors));
  }
  return tickets.some((t: { status?: string }) => t?.status === 'ok');
}

// data.type: 'nudge' — categoryId registers this against the
// 'reminder-nudge' category the client sets up once via
// Notifications.setNotificationCategoryAsync (lib/pushToken.js's
// ensureCategories), which is what makes the "Log now" action button show
// up. useNotificationSync's tap listener routes a tap (button OR body)
// straight into AddTransactionSheet for the morning trigger; the evening one
// routes to Home instead (data.trigger — see below), where TodayCard now
// lives (18-gamification-ritual-and-ledger.md Phase 3).
async function sendNudges(supabase: ReturnType<typeof createClient>) {
  const now = new Date();
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, timezone, morning_reminder_time, evening_reminder_time')
    .eq('reminders_enabled', true);

  if (error) {
    console.error('send-push cron (nudges): profiles read failed:', error.message);
    return 0;
  }

  let sent = 0;
  for (const profile of profiles ?? []) {
    const timezone = profile.timezone || 'Asia/Kolkata';
    const localNow = getLocalParts(now, timezone);
    const firstName = (profile.full_name ?? '').split(' ')[0] || 'there';

    for (const trigger of ['morning', 'evening'] as const) {
      const targetTime = trigger === 'morning' ? profile.morning_reminder_time : profile.evening_reminder_time;
      if (!isWithinBucket(localNow, targetTime)) continue;

      if (trigger === 'evening' && (await hasLoggedOnRelativeDay(supabase, profile.id, timezone, 0))) continue;

      const claimed = await tryClaim(supabase, profile.id, `${trigger}_nudge`, localNow.dateKey);
      if (!claimed) continue;

      // The one piece of real state the copy reacts to — see
      // reminderCopy.ts's own comment on why this replaced day-of-week
      // keying. Evening already implies "not logged today" by construction
      // (the skip above); this is specifically about YESTERDAY, i.e.
      // whether today's gap is breaking real momentum or not.
      const loggedYesterday = await hasLoggedOnRelativeDay(supabase, profile.id, timezone, 1);
      const copy = getReminderCopy(trigger, loggedYesterday, localNow.dayOfWeek, firstName);
      // `trigger` added 18-gamification-ritual-and-ledger.md Phase 3 — lets
      // the client (lib/notifications.js's useNotificationSync) route the
      // evening nudge to Home (where TodayCard, the close-the-day ritual,
      // now lives) instead of straight into AddTransactionSheet like the
      // morning one.
      const ok = await sendPushToUser(supabase, profile.id, copy.title, copy.body, {
        channelId: 'flo.reminders.nudge',
        categoryId: 'reminder-nudge',
        data: { type: 'nudge', trigger },
      });
      if (ok) sent += 1;
    }
  }
  return sent;
}

// Ports lib/notifications.js's removed local bill-due scheduling: fixed
// 9:00 AM local, `next_due_date − days_before` (per-user configurable),
// same title/body shape ("{name} due in N days" / "₹X — tap to review").
// data.route: '/bills' — useNotificationSync's existing routing (no
// data.type) opens the Bills tab on tap, same as when this was local.
async function sendBillDue(supabase: ReturnType<typeof createClient>) {
  const now = new Date();
  const [{ data: profiles, error: profilesError }, { data: bills, error: billsError }] = await Promise.all([
    supabase.from('profiles').select('id, timezone, bill_reminders_enabled, bill_reminder_days_before'),
    supabase.from('bills').select('id, user_id, name, amount, next_due_date').eq('is_active', true),
  ]);

  if (profilesError || billsError) {
    console.error('send-push cron (bills): read failed:', profilesError?.message, billsError?.message);
    return 0;
  }

  const billsByUser = new Map<string, typeof bills>();
  for (const bill of bills ?? []) {
    if (!billsByUser.has(bill.user_id)) billsByUser.set(bill.user_id, []);
    billsByUser.get(bill.user_id)!.push(bill);
  }

  let sent = 0;
  for (const profile of profiles ?? []) {
    if (!profile.bill_reminders_enabled) continue;
    const userBills = billsByUser.get(profile.id);
    if (!userBills || userBills.length === 0) continue;

    const timezone = profile.timezone || 'Asia/Kolkata';
    const localNow = getLocalParts(now, timezone);
    if (!isWithinBucket(localNow, '09:00')) continue;

    const daysBefore = profile.bill_reminder_days_before ?? 2;
    for (const bill of userBills) {
      if (subtractDays(bill.next_due_date, daysBefore) !== localNow.dateKey) continue;

      const claimed = await tryClaim(supabase, profile.id, 'bill_due', `${bill.id}:${localNow.dateKey}`);
      if (!claimed) continue;

      const dueLabel = daysBefore === 0 ? 'due today' : `due in ${daysBefore} day${daysBefore === 1 ? '' : 's'}`;
      const ok = await sendPushToUser(supabase, profile.id, `${bill.name} ${dueLabel}`, `${formatMoney(bill.amount)} — tap to review`, {
        channelId: 'flo.bills.due',
        data: { route: '/bills' },
      });
      if (ok) sent += 1;
    }
  }
  return sent;
}

// Ports lib/reports.js's reportDueMoment/isReportDue semantics — simplified
// for a 15-minute-bucketed cron: "is NOW (in the user's local time) within
// the configured day+time bucket for their cadence", rather than
// reportDueMoment's client-side "most recent due moment <= now" backward
// scan (that logic stays exactly as-is for the Home card/bell, which are
// unaffected by this phase — see the Impact table). cadenceStartedAt still
// guards against notifying for a cycle that predates when the cadence was
// turned on, same reasoning as the client-side version.
async function sendReportReady(supabase: ReturnType<typeof createClient>) {
  const now = new Date();
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, timezone, report_cadence, report_weekday, report_day_of_month, report_time, report_cadence_started_at')
    .neq('report_cadence', 'off');

  if (error) {
    console.error('send-push cron (reports): profiles read failed:', error.message);
    return 0;
  }

  let sent = 0;
  for (const profile of profiles ?? []) {
    const timezone = profile.timezone || 'Asia/Kolkata';
    const localNow = getLocalParts(now, timezone);
    if (!isWithinBucket(localNow, profile.report_time)) continue;

    if (profile.report_cadence === 'weekly') {
      if (localNow.dayOfWeek !== profile.report_weekday) continue;
    } else if (profile.report_cadence === 'monthly') {
      const clampedDay = Math.min(profile.report_day_of_month, daysInLocalMonth(localNow.year, localNow.month));
      if (localNow.day !== clampedDay) continue;
    } else {
      continue;
    }

    if (profile.report_cadence_started_at && now < new Date(profile.report_cadence_started_at)) continue;

    const claimed = await tryClaim(supabase, profile.id, 'report_ready', localNow.dateKey);
    if (!claimed) continue;

    const cadenceLabel = profile.report_cadence === 'weekly' ? 'week' : 'month';
    const ok = await sendPushToUser(
      supabase,
      profile.id,
      `Your ${profile.report_cadence} report is ready`,
      `Tap to see how your ${cadenceLabel} went.`,
      { channelId: 'flo.reports.ready', data: { route: '/report' } }
    );
    if (ok) sent += 1;
  }
  return sent;
}

async function runCron(supabase: ReturnType<typeof createClient>) {
  const [nudges, bills, reports] = await Promise.all([
    sendNudges(supabase),
    sendBillDue(supabase),
    sendReportReady(supabase),
  ]);
  return { sent: { nudges, bills, reports } };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  if (body?.mode === 'cron') {
    const result = await runCron(supabase);
    return json(result);
  }

  // Phase 1's manual test-send path.
  const userId = body?.userId as string | undefined;
  if (!userId) return json({ error: 'userId_or_cron_mode_required' }, 400);

  const { data: tokens, error } = await supabase.from('push_tokens').select('token').eq('user_id', userId);
  if (error) {
    console.error('send-push: push_tokens read failed:', error.message);
    return json({ error: 'push_tokens_read_failed' }, 500);
  }
  if (!tokens || tokens.length === 0) {
    return json({ sent: 0, message: 'no push tokens registered for this user' });
  }

  const messages = tokens.map(({ token }: { token: string }) => ({
    to: token,
    title: 'FLO test push',
    body: 'If this arrived with the app fully closed, the pipeline works.',
    sound: 'default',
    channelId: 'flo.reminders.nudge',
  }));

  const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });

  if (!pushRes.ok) {
    const errText = await pushRes.text();
    console.error('send-push: Expo push API error:', pushRes.status, errText);
    return json({ error: 'expo_push_failed', status: pushRes.status }, 502);
  }

  const pushResult = await pushRes.json();
  // Same res.ok-isn't-enough gap as sendPushToUser (see its comment) — the
  // manual test-send path is exactly what surfaced this: Settings' "Send
  // test" button was reading `sent: messages.length` (queued count) as
  // proof of delivery, so a real FCM-credential failure showed as success
  // with no notification ever arriving and no error anywhere to find.
  const tickets = Array.isArray(pushResult?.data) ? pushResult.data : [];
  const ticketErrors = tickets.filter((t: { status?: string }) => t?.status === 'error');
  const okCount = tickets.filter((t: { status?: string }) => t?.status === 'ok').length;
  if (ticketErrors.length > 0) {
    console.error('send-push: Expo push ticket error(s):', JSON.stringify(ticketErrors));
  }
  return json({ sent: okCount, pushResult, ticketErrors });
});
