// Pricing and currency conversion utilities for cost estimation

// Approximate FX rate. No env var dependency per product decision.
export const USD_JPY_RATE = 150;

// OpenAI Whisper-1 pricing (USD per minute)
export const WHISPER_PRICE_PER_MIN_USD = 0.006;

// Anthropic Claude 3.5 Sonnet (20241022) pricing (USD per 1M tokens)
export const CLAUDE_SONNET_INPUT_PER_M_TOKENS_USD = 3;
export const CLAUDE_SONNET_OUTPUT_PER_M_TOKENS_USD = 15;

export function calculateWhisperCostUsd(durationSeconds: number): number {
  const minutes = durationSeconds / 60;
  return minutes * WHISPER_PRICE_PER_MIN_USD;
}

export function calculateClaudeCostUsd(
  inputTokens: number,
  outputTokens: number
): number {
  return (
    (inputTokens / 1_000_000) * CLAUDE_SONNET_INPUT_PER_M_TOKENS_USD +
    (outputTokens / 1_000_000) * CLAUDE_SONNET_OUTPUT_PER_M_TOKENS_USD
  );
}

export function calculateWhisperCostYen(durationSeconds: number): number {
  const minutes = durationSeconds / 60;
  const usd = minutes * WHISPER_PRICE_PER_MIN_USD;
  return usd * USD_JPY_RATE;
}

export function calculateClaudeCostYen(
  inputTokens: number,
  outputTokens: number
): number {
  const usd =
    (inputTokens / 1_000_000) * CLAUDE_SONNET_INPUT_PER_M_TOKENS_USD +
    (outputTokens / 1_000_000) * CLAUDE_SONNET_OUTPUT_PER_M_TOKENS_USD;
  return usd * USD_JPY_RATE;
}


