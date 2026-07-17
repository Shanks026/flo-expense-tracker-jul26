// SINGLE SWAP SITE — replace the constructed instance below to point at a
// different Provider implementation (e.g. a future AnthropicProvider). Every
// other file imports `provider` from here, never a concrete adapter directly.
import type { Provider } from './types.ts';
import { GeminiProvider } from './gemini.ts';

const apiKey = Deno.env.get('GEMINI_API_KEY');
if (!apiKey) {
  throw new Error('GEMINI_API_KEY is not set');
}

export const provider: Provider = new GeminiProvider(apiKey);
