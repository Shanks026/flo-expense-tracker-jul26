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
// the Settings switch changes it through saveAnalyticsConsent. Unknown counts
// as off: nothing is sent.
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

// Reads the signed-in user's consent from the profile. A null userId (signed
// out) turns tracking off.
export async function loadTrackingConsent(userId) {
  consentUserId = userId;
  if (!userId) {
    consentEpoch += 1;
    setConsent(false);
    return;
  }
  const epoch = consentEpoch;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('analytics_consent')
      .eq('id', userId)
      .maybeSingle();
    if (epoch !== consentEpoch || consentUserId !== userId) return;
    if (!error) setConsent(data?.analytics_consent === true);
  } catch {
    // Offline: keep the last known value.
  }
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
  const { data, error } = await supabase
    .from('profiles')
    .update({ analytics_consent: value === true })
    .eq('id', userId)
    .select('id')
    .maybeSingle();
  const failed = error ?? (data ? null : new Error('profile_update_no_match'));
  if (failed && epoch === consentEpoch) setConsent(previous);
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
export function track(name, props) {
  try {
    if (!consent || !Object.prototype.hasOwnProperty.call(VOCABULARY, name)) return;
    const row = {
      name,
      props: cleanProps(name, props),
      occurred_at: new Date().toISOString(),
      app_version: APP_VERSION,
      session_id: sessionId,
    };
    supabase
      .from('events')
      .insert(row)
      .then(
        () => {},
        () => {}
      );
  } catch {
    // Analytics must never break the app.
  }
}
