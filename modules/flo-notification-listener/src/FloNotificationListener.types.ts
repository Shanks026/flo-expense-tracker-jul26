export type DetectedNotification = {
  id: string;
  packageName: string;
  amount: number;
  type: 'income' | 'expense';
  // Raw notification fields, kept alongside the parsed amount/type for
  // on-device debugging — lets a parse be sanity-checked against what the
  // notification actually said.
  title: string;
  text: string;
  postedAt: number;
};

// ⚠️ DEBUG ONLY — remove before any store build. Every allowlisted
// notification seen, and what the parser made of it. Unlike DetectedNotification,
// this includes ones that FAILED to parse (outcome: 'no-parse'), which is the
// whole point: those are invisible otherwise, and they're exactly what you need
// to see in order to fix the parser against real bank/UPI wording.
export type DetectionDebugEntry = {
  packageName: string;
  title: string;
  text: string;
  amount: number | null;
  type: 'income' | 'expense' | null;
  outcome: 'prompted' | 'no-parse' | 'duplicate';
  at: number;
};
