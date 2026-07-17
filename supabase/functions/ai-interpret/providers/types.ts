// THE SEAM — every AI capability (categorisation, receipt scan, and any future
// mode) speaks this one contract. Swapping providers (Gemini → Anthropic later)
// means writing a new file in this folder that implements `Provider`; nothing
// outside providers/ ever changes. See .claude/features/13-ai-features.md.

export type InterpretMode = 'categorise' | 'receipt';

export interface CategoryOption {
  id: string;
  name: string;
  type: 'income' | 'expense';
}

export interface InterpretInput {
  mode: InterpretMode;
  // The user's real categories. The model MUST pick one of these ids (or
  // null) — it must never invent a category that doesn't exist in FLO.
  categories: CategoryOption[];
  text?: string; // categorise: the note/merchant text
  imageBase64?: string; // receipt: the captured image
  imageMimeType?: string; // defaults to image/jpeg if omitted
}

export interface InterpretDraft {
  category_id: string | null;
  // receipt-only fields — always null for 'categorise' mode:
  amount: number | null;
  occurred_at: string | null; // 'yyyy-MM-dd'
  merchant: string | null;
  type: 'income' | 'expense' | null;
  confidence: number; // 0..1
}

export interface InterpretUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface InterpretResult {
  draft: InterpretDraft;
  usage: InterpretUsage;
}

export interface Provider {
  interpret(input: InterpretInput): Promise<InterpretResult>;
}
