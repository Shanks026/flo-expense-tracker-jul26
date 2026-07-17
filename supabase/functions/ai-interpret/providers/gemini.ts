// Gemini adapter — implements the Provider seam (./types.ts) against Google's
// generateContent REST API. Structured output (responseSchema) constrains
// category_id to an enum built from the caller's own categories, which is how
// "never invent a category" is enforced at the model level; the parse step
// below re-checks it anyway (never trust a model output un-checked).
//
// Model id held in ONE constant — verified against ai.google.dev 2026-07-17.
// If Gemini renames/retires this tier, this is the only line that changes.
const GEMINI_MODEL = 'gemini-3.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

import type { InterpretInput, InterpretResult, InterpretDraft, Provider } from './types.ts';

function buildSchema(mode: InterpretInput['mode'], categoryIds: string[]) {
  // Gemini's schema always needs a non-empty enum; a user with zero categories
  // is not a real FLO state (every account gets defaults on signup), but guard
  // anyway rather than send an invalid empty enum.
  const categoryEnum = categoryIds.length > 0 ? categoryIds : ['__none__'];

  const categoryField = {
    type: 'STRING',
    enum: categoryEnum,
    nullable: true,
    description: 'Must be one of the provided category ids, or null if genuinely none fit.',
  };

  if (mode === 'categorise') {
    return {
      type: 'OBJECT',
      properties: {
        category_id: categoryField,
        confidence: { type: 'NUMBER' },
      },
      required: ['category_id', 'confidence'],
    };
  }

  return {
    type: 'OBJECT',
    properties: {
      category_id: categoryField,
      amount: { type: 'NUMBER', nullable: true },
      occurred_at: { type: 'STRING', nullable: true, description: 'yyyy-MM-dd, or null if not visible' },
      merchant: { type: 'STRING', nullable: true },
      type: { type: 'STRING', enum: ['income', 'expense'], nullable: true },
      confidence: { type: 'NUMBER' },
    },
    required: ['category_id', 'confidence'],
  };
}

function buildPrompt(input: InterpretInput) {
  const categoryList = input.categories.map((c) => `${c.id}: ${c.name} (${c.type})`).join('\n');

  if (input.mode === 'categorise') {
    return (
      `You are categorising a transaction in a personal expense tracker. ` +
      `Given the note text below, pick the single best matching category by its id. ` +
      `You MUST return one of the listed ids, or null if genuinely none fit — ` +
      `never invent a category name or id that isn't in this list.\n\n` +
      `Categories:\n${categoryList}\n\n` +
      `Note: ${input.text ?? ''}`
    );
  }

  return (
    `You are extracting structured data from a photo of a purchase receipt for a ` +
    `personal expense tracker. Read: the total amount paid, the date (yyyy-MM-dd; ` +
    `null if no date is visible), the merchant/store name, whether this is an ` +
    `expense or income (almost always expense), and the single best matching ` +
    `category by its id from the list below. You MUST return one of the listed ` +
    `category ids, or null if genuinely none fit — never invent a category name ` +
    `or id that isn't in this list.\n\n` +
    `Categories:\n${categoryList}`
  );
}

function buildRequestBody(input: InterpretInput) {
  const categoryIds = input.categories.map((c) => c.id);
  const parts: Record<string, unknown>[] = [{ text: buildPrompt(input) }];

  if (input.mode === 'receipt' && input.imageBase64) {
    parts.push({
      inline_data: {
        mime_type: input.imageMimeType ?? 'image/jpeg',
        data: input.imageBase64,
      },
    });
  }

  return {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: buildSchema(input.mode, categoryIds),
    },
  };
}

// A retry-with-backoff on 503/429 was tried here and REVERTED the same day
// (2026-07-17): live testing showed Gemini's overload was sustained (multiple
// independent requests over ~20 minutes all hit 503), not a brief blip — so
// each retry just re-waited on an already-down backend, turning a 3s failure
// into a 118s one for the exact same outcome. Retrying only pays off against
// a genuinely transient hiccup; against a sustained outage it's pure cost.
// Fail fast instead — the caller (scanReceipt) already degrades gracefully to
// "fill it in manually", and that's a far better experience than a long hang
// ending in the same failure. Revisit only with real evidence that a *short*,
// *single* retry measurably helps more often than it hurts.

export class GeminiProvider implements Provider {
  constructor(private apiKey: string) {}

  async interpret(input: InterpretInput): Promise<InterpretResult> {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify(buildRequestBody(input)),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${errText}`);
    }

    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini returned no content');

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('Gemini returned invalid JSON');
    }

    // Belt-and-suspenders: re-validate category_id against the real list even
    // though responseSchema's enum already constrains it server-side at Gemini.
    const categoryIds = new Set(input.categories.map((c) => c.id));
    const rawCategoryId = typeof parsed.category_id === 'string' ? parsed.category_id : null;
    const category_id = rawCategoryId && categoryIds.has(rawCategoryId) ? rawCategoryId : null;

    const draft: InterpretDraft = {
      category_id,
      amount: typeof parsed.amount === 'number' ? parsed.amount : null,
      occurred_at: typeof parsed.occurred_at === 'string' ? parsed.occurred_at : null,
      merchant: typeof parsed.merchant === 'string' ? parsed.merchant : null,
      type: parsed.type === 'income' || parsed.type === 'expense' ? parsed.type : null,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
    };

    const usageMeta = json?.usageMetadata ?? {};
    return {
      draft,
      usage: {
        model: GEMINI_MODEL,
        inputTokens: usageMeta.promptTokenCount ?? 0,
        outputTokens: usageMeta.candidatesTokenCount ?? 0,
      },
    };
  }
}
