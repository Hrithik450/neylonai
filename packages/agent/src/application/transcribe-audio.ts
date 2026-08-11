/**
 * Speech-to-text via Gemini multimodal audio understanding.
 * Metered like other model calls (usage_events / MODEL_PRICE_BOOK).
 *
 * Audio tokens: Gemini bills ~32 input tokens per second of audio;
 * provider usageMetadata is preferred when present.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { withGoogleApiRetry } from "@neylonai/integrations/gemini";
import { getSttModel } from "../lib/models";
import { meterModelResponse } from "../infrastructure/metering";

/** Gemini audio docs: 32 tokens per second of audio. */
export const GEMINI_AUDIO_TOKENS_PER_SECOND = 32;

const TRANSCRIBE_PROMPT =
  "Transcribe the spoken words in this audio exactly. " +
  "Return only the transcript text with no labels, timestamps, or commentary. " +
  "If there is no intelligible speech, return an empty string.";

const ALLOWED_MIME = new Set([
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/ogg",
  "audio/ogg;codecs=opus",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
  "audio/aac",
]);

export const MAX_AUDIO_BYTES = 4 * 1024 * 1024; // 4 MiB inline
export const MAX_AUDIO_DURATION_MS = 60_000;

export interface TranscribeAudioInput {
  /** Raw audio bytes (webm/mp4/etc.). */
  audio: Buffer | Uint8Array;
  mimeType: string;
  /** Optional client-reported duration for fallback token estimate. */
  durationMs?: number;
}

export interface TranscribeAudioResult {
  text: string;
  modelId: string;
  durationMs: number | null;
}

function normalizeMimeType(raw: string): string {
  const base = raw.trim().toLowerCase().split(";")[0]?.trim() ?? "";
  if (base === "audio/mp3") return "audio/mpeg";
  return base || "audio/webm";
}

function isAllowedMime(mimeType: string): boolean {
  const lower = mimeType.trim().toLowerCase();
  if (ALLOWED_MIME.has(lower)) return true;
  const base = normalizeMimeType(lower);
  return ALLOWED_MIME.has(base);
}

/** Estimate input tokens when Gemini omits usageMetadata. */
export function estimateAudioInputTokens(durationMs: number): number {
  const seconds = Math.max(0.25, durationMs / 1000);
  return Math.max(1, Math.ceil(seconds * GEMINI_AUDIO_TOKENS_PER_SECOND));
}

function usageFromGeminiResponse(response: {
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}): { inputTokens: number; outputTokens: number; measured: boolean } {
  const um = response.usageMetadata;
  const input = Number(um?.promptTokenCount ?? 0) || 0;
  const output = Number(um?.candidatesTokenCount ?? 0) || 0;
  if (input > 0 || output > 0) {
    return { inputTokens: input, outputTokens: output, measured: true };
  }
  return { inputTokens: 0, outputTokens: 0, measured: false };
}

export async function transcribeAudio(
  input: TranscribeAudioInput,
): Promise<TranscribeAudioResult> {
  const mimeType = input.mimeType?.trim() || "audio/webm";
  if (!isAllowedMime(mimeType)) {
    throw new Error(
      `Unsupported audio type "${mimeType}". Use webm, mp4, mpeg, wav, or ogg.`,
    );
  }

  const bytes =
    input.audio instanceof Buffer
      ? input.audio
      : Buffer.from(
          input.audio.buffer,
          input.audio.byteOffset,
          input.audio.byteLength,
        );

  if (bytes.byteLength === 0) {
    throw new Error("Audio is empty.");
  }
  if (bytes.byteLength > MAX_AUDIO_BYTES) {
    throw new Error(
      `Audio is too large (${Math.round(bytes.byteLength / 1024)} KB). Max is ${MAX_AUDIO_BYTES / 1024} KB.`,
    );
  }

  const durationMs =
    typeof input.durationMs === "number" &&
    Number.isFinite(input.durationMs) &&
    input.durationMs > 0
      ? Math.min(MAX_AUDIO_DURATION_MS, Math.floor(input.durationMs))
      : null;

  const modelId = getSttModel();
  const inlineMime = normalizeMimeType(mimeType);
  const base64 = bytes.toString("base64");

  const { text, response } = await withGoogleApiRetry(async (apiKey) => {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelId });
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: inlineMime,
          data: base64,
        },
      },
      { text: TRANSCRIBE_PROMPT },
    ]);
    const geminiResponse = result.response;
    return {
      text: (geminiResponse.text() ?? "").trim(),
      response: geminiResponse,
    };
  });

  const usage = usageFromGeminiResponse(response);
  const inputTokens = usage.measured
    ? usage.inputTokens
    : durationMs != null
      ? estimateAudioInputTokens(durationMs)
      : 0;
  const outputTokens = usage.measured
    ? usage.outputTokens
    : Math.max(0, Math.ceil(text.length / 4));

  meterModelResponse(
    modelId,
    {
      usageMetadata: {
        promptTokenCount: inputTokens,
        candidatesTokenCount: outputTokens,
      },
    },
    {
      inputTokens,
      outputTokens,
      inputModality: "audio",
      // Estimated tokens still use the model price book (Gemini documents audio tok/s).
      forceUnknownPricing: !usage.measured && durationMs == null,
      metadata: {
        purpose: "speech_to_text",
        mimeType: inlineMime,
        audioBytes: bytes.byteLength,
        ...(durationMs != null ? { durationMs } : {}),
        tokenSource: usage.measured
          ? "provider"
          : durationMs != null
            ? "audio_duration_estimate"
            : "missing",
      },
    },
  );

  return {
    text,
    modelId,
    durationMs,
  };
}
