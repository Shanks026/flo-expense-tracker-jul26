import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// First-party product analytics (33-product-analytics.md). Not lib/analytics.js
// — that's the chart-math module.
//
// The whole event vocabulary lives here and nowhere else. Each event lists the
// props it may carry and the type of each; anything else is stripped, and an
// unknown name is dropped, so a careless call can't leak an amount, a note, a
// merchant or a category name into `events`. Only the two count-like props
// take numbers; every other value must be a short lowercase token that starts
// with a letter (`manual`, `share_import`), so neither free text nor a
// stringified amount passes.
const VOCABULARY = {
  app_open: {},
  onboarding_step_viewed: { step: 'token' },
  signup_completed: { method: 'token' },
  expense_logged: { source: 'token', category_was_prefilled: 'boolean', seconds_to_save: 'number' },
  no_spend_marked: {},
  share_import: { result: 'token' },
  nudge_opened: { type: 'token' },
  recap_viewed: {},
  streak_milestone: { days: 'number' },
  freeze_used: {},
  feature_opened: { feature: 'token' },
  pro_sheet_viewed: { trigger: 'token' },
  purchase_started: { product: 'token' },
  purchase_completed: { product: 'token' },
};

const TOKEN = /^[a-z][a-z0-9_.]{0,39}$/;

const APP_VERSION = Constants.expoConfig?.version ?? null;

// This module is the device's one copy of the consent flag. AnalyticsSync
// (app/_layout.js) loads it from the profile on sign-in and on each app open;
// the Settings switch changes it through saveAnalyticsConsent. Unknown (never
// confirmed by the server for this user) counts as off: nothing is queued.
let consent = false;
let consentUserId = null;
// Bumped by every local change, so a profile read that started before a
// toggle can't overwrite it, and a failed write only reverts its own change.
let consentEpoch = 0;
const listeners = new Set();

let sessionId = newSessionId();

function newSessionId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function setConsent(value) {
  consent = value === true;
  listeners.forEach((fn) => fn());
}

export function getTrackingConsent() {
  return consent;
}

export function subscribeTrackingConsent(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// The last choice the server confirmed, per user, so an offline launch still
// knows it (and a different account never inherits it).
const CONSENT_KEY = 'flo.trackConsent.v1';

function rememberConsent(userId, value) {
  AsyncStorage.setItem(CONSENT_KEY, JSON.stringify({ userId, consent: value === true })).catch(() => {});
}

async function lastConfirmedConsent(userId) {
  try {
    const saved = JSON.parse(await AsyncStorage.getItem(CONSENT_KEY));
    return saved?.userId === userId && saved.consent === true;
  } catch {
    return false;
  }
}

// Reads the signed-in user's consent from the profile, falling back to the
// last confirmed choice when offline. A null userId (signed out) turns
// tracking off.
export async function loadTrackingConsent(userId) {
  consentUserId = userId;
  if (!userId) {
    consentEpoch += 1;
    setConsent(false);
    return;
  }
  const epoch = consentEpoch;
  let value = null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('analytics_consent')
      .eq('id', userId)
      .maybeSingle();
    if (!error) value = data?.analytics_consent === true;
  } catch {
    // Offline: handled below.
  }
  if (value === null) value = await lastConfirmedConsent(userId);
  else rememberConsent(userId, value);
  if (epoch !== consentEpoch || consentUserId !== userId) return;
  setConsent(value);
  if (consent) flushEvents();
  else clearQueue();
}

// The tracking gate flips first, so turning analytics off stops collection
// before the round trip. A failed write puts the gate back, unless a newer
// toggle has happened since.
export async function saveAnalyticsConsent(value) {
  const userId = consentUserId;
  if (!userId) return { error: new Error('Not signed in') };
  const previous = consent;
  const epoch = ++consentEpoch;
  setConsent(value);
  // Opting out drops whatever is still waiting on the phone, even if the
  // write below fails: nothing collected under the old choice goes out.
  if (!consent) clearQueue();
  const { data, error } = await supabase
    .from('profiles')
    .update({ analytics_consent: value === true })
    .eq('id', userId)
    .select('id')
    .maybeSingle();
  const failed = error ?? (data ? null : new Error('profile_update_no_match'));
  if (failed && epoch === consentEpoch) setConsent(previous);
  if (!failed) rememberConsent(userId, value);
  return { error: failed };
}

// One session per app open: a cold start, a return after a real stretch in
// the background, or a change of signed-in user.
export function startTrackingSession() {
  sessionId = newSessionId();
}

function cleanProps(name, props) {
  const out = {};
  for (const [key, type] of Object.entries(VOCABULARY[name])) {
    const value = props?.[key];
    if (type === 'boolean' && typeof value === 'boolean') out[key] = value;
    else if (type === 'number' && typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    else if (type === 'token' && typeof value === 'string' && TOKEN.test(value)) out[key] = value;
  }
  return out;
}

// Fire and forget: never throws, never returns a promise for the UI to await.
// The event joins the on-device queue; it's sent with the next batch.
export function track(name, props) {
  try {
    if (!consent || !consentUserId || !Object.prototype.hasOwnProperty.call(VOCABULARY, name)) return;
    enqueue({
      name,
      props: cleanProps(name, props),
      occurred_at: new Date().toISOString(),
      app_version: APP_VERSION,
      session_id: sessionId,
    });
  } catch {
    // Analytics must never break the app.
  }
}

// --- Offline queue ---------------------------------------------------------
// Events wait in AsyncStorage and go up in batches: a few seconds after they
// are tracked, when the app goes to the background, and once consent loads at
// launch (which sends what an earlier run left behind). A failed batch stays
// queued and is retried a minute later; an event that keeps failing is
// dropped after MAX_ATTEMPTS, and the queue never holds more than MAX_QUEUED
// (oldest dropped first), so a long offline stretch can't grow it unbounded.
// Each entry remembers whose it is: the insert is attributed to whoever is
// signed in, so another account's events are dropped rather than sent.
const QUEUE_KEY = 'flo.trackQueue.v1';
const MAX_QUEUED = 500;
const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 8;
const FLUSH_DELAY_MS = 5 * 1000;
const RETRY_DELAY_MS = 60 * 1000;

let queue = [];
let queueLoaded = null;
let flushing = false;
let flushTimer = null;

function loadQueue() {
  if (!queueLoaded) {
    queueLoaded = AsyncStorage.getItem(QUEUE_KEY)
      .then((raw) => {
        const saved = raw ? JSON.parse(raw) : [];
        if (Array.isArray(saved)) queue = [...saved, ...queue].slice(-MAX_QUEUED);
      })
      .catch(() => {});
  }
  return queueLoaded;
}

// Waits for the load, so the first write of a run can't overwrite what the
// last run saved.
function persistQueue() {
  loadQueue()
    .then(() => AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue)))
    .catch(() => {});
}

function scheduleFlush(delay) {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushEvents();
  }, delay);
}

function enqueue(row) {
  queue.push({ row, userId: consentUserId, attempts: 0 });
  if (queue.length > MAX_QUEUED) queue = queue.slice(-MAX_QUEUED);
  persistQueue();
  scheduleFlush(FLUSH_DELAY_MS);
}

// After the load, or the saved queue would merge back in behind the clear.
function clearQueue() {
  loadQueue().then(() => {
    queue = [];
    persistQueue();
  });
}

// Sends one batch, then schedules the next if more is waiting. Safe to call
// any time; it never throws and does nothing while consent is off or nobody
// is signed in.
export async function flushEvents() {
  if (flushing) return;
  flushing = true;
  let retry = false;
  try {
    await loadQueue();
    const userId = consentUserId;
    if (!consent || !userId || !queue.length) return;
    const before = queue.length;
    queue = queue.filter((entry) => entry.userId === userId);
    if (queue.length !== before) persistQueue();

    const batch = queue.slice(0, BATCH_SIZE);
    if (!batch.length) return;
    const { error } = await supabase.from('events').insert(batch.map((entry) => entry.row));
    if (error) {
      batch.forEach((entry) => {
        entry.attempts += 1;
      });
      queue = queue.filter((entry) => entry.attempts < MAX_ATTEMPTS);
      retry = true;
    } else {
      queue = queue.filter((entry) => !batch.includes(entry));
    }
    persistQueue();
  } catch {
    retry = true;
  } finally {
    flushing = false;
  }
  if (queue.length) scheduleFlush(retry ? RETRY_DELAY_MS : 0);
}
