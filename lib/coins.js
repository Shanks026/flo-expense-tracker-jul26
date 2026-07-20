// Coin packs — the real-money top-up options (INR), 22-coin-store-and-reward-
// tiering.md Phase 3. FLO's coin economy is spending-only: money buys coins,
// coins buy everything (card themes now, mascot skins/bundles later). Single
// source of truth for coin-pack pricing, same discipline as lib/pro.js's
// PRO_PRICING — pure data, no React/Supabase imports.
//
// ⚠️ UI-ONLY for now. The Shop displays these but Buy is stubbed to an info
// toast, exactly like the Pro subscription CTA (app/pro.js's handleUpgrade) —
// no Play Billing, no Edge Function, no coins actually credited. Turning on
// real purchases (server-verified crediting via a `coin_purchase` reward_events
// row) is the separate payments-go-live effort (IDEAS-subscription-and-store.md
// Part 3), NOT this feature. This file changes nothing about that when it lands
// — the packs' coin/price values are already the source of truth.
//
// Ascending value: coins-per-rupee rises with each tier, the standard nudge
// toward the bigger packs. Anchors: ₹49 ≈ one Common theme (400), ₹99 ≈ any
// one Rare theme (≤1,000), ₹399 ≈ six rares or one bought freeze (3,000).
// `popular` flags the ₹99 pack as the highlighted default (it clears exactly
// one Rare theme — the most common purchase).
export const COIN_PACKS = [
  { id: 'starter', coins: 500, price: '₹49' },
  { id: 'popular', coins: 1200, price: '₹99', popular: true },
  { id: 'value', coins: 2700, price: '₹199' },
  { id: 'premium', coins: 6000, price: '₹399' },
  { id: 'mega', coins: 13000, price: '₹799' },
  { id: 'ultra', coins: 20000, price: '₹999' },
];
