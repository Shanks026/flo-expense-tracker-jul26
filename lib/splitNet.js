// A split's one-line position for the person (spec 48, ticket 07). Pure, no
// React Native imports, so scripts/ledger-check.mjs checks it.
//
// Leads with what the person PAYS (myPays, from useSplits), the same figure
// as the detail's band: a net can't be the headline, since the person may owe
// one member more while others owe them back. Anything under half a paisa
// (rounding left by uneven shares) reads as square.
import { formatMoney } from './currency.js';

const HALF_PAISA = 0.005;

// → { text, tone: 'positive' | 'ink' | 'muted' }
export function splitNetText({ myPays = 0, myNet = 0, entryCount = 0 } = {}, { closed = false, currency } = {}) {
  if (!entryCount) return { text: closed ? 'Nothing was added' : 'Nothing added yet', tone: 'muted' };
  if (myPays >= HALF_PAISA) return { text: `You owe ${formatMoney(myPays, currency)}`, tone: 'ink' };
  if (myNet >= HALF_PAISA) return { text: `You're owed ${formatMoney(myNet, currency)}`, tone: 'positive' };
  return { text: 'Settled up', tone: 'muted' };
}
