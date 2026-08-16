import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  MAX_AUDIO_BYTES,
  MAX_AUDIO_DURATION_MS,
  runWithAgentTurnContext,
  transcribeAudio,
} from "@neylonai/agent";
import {
  ApiAuthError,
  assertCanConsumeConversation,
} from "@neylonai/domain/billing";
import {
  isApiKeyAuthContext,
  requireApiKeyAuth,
} from "@/server/api-key-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface TranscribeBody {
  audioBase64?: string;
  mimeType?: string;
  durationMs?: number;
}

function decodeBase64Audio(raw: string): Buffer {
  const cleaned = raw.replace(/^data:audio\/[^;]+;base64,/, "").trim();
  return Buffer.from(cleaned, "base64");
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiKeyAuth(req);
    if (!isApiKeyAuthContext(auth)) return auth;

    // Same gate as chat: active plan + remaining conversation allowance.
    // STT does not consume a conversation_turn — only model COGS is recorded.
    await assertCanConsumeConversation(
      { organizationId: auth.organizationId, plan: auth.plan },
      auth.periodStart ?? undefined,
    );

    const body = (await req.json().catch(() => ({}))) as TranscribeBody;
    const audioBase64 =
      typeof body.audioBase64 === "string" ? body.audioBase64 : "";
    const mimeType =
      typeof body.mimeType === "string" && body.mimeType.trim()
        ? body.mimeType.trim()
        : "audio/webm";
    const durationMs =
      typeof body.durationMs === "number" && Number.isFinite(body.durationMs)
        ? Math.floor(body.durationMs)
        : undefined;

    if (!audioBase64) {
      return NextResponse.json(
        { success: false, error: "audioBase64 is required" },
        { status: 400 },
      );
    }

    if (
      durationMs != null &&
      (durationMs < 0 || durationMs > MAX_AUDIO_DURATION_MS + 5_000)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Recording must be between 0 and ${MAX_AUDIO_DURATION_MS / 1000} seconds.`,
        },
        { status: 400 },
      );
    }

    let audio: Buffer;
    try {
      audio = decodeBase64Audio(audioBase64);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid audioBase64" },
        { status: 400 },
      );
    }

    if (audio.byteLength === 0) {
      return NextResponse.json(
        { success: false, error: "Audio is empty" },
        { status: 400 },
      );
    }
    if (audio.byteLength > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `Audio exceeds ${MAX_AUDIO_BYTES / (1024 * 1024)} MB limit`,
        },
        { status: 413 },
      );
    }

    const requestId = randomUUID();

    const result = await runWithAgentTurnContext(
      {
        organizationId: auth.organizationId,
        requestId,
        apiKeyId: auth.apiKeyId ?? undefined,
        agentId: "speech_to_text",
      },
      () =>
        transcribeAudio({
          audio,
          mimeType,
          durationMs,
        }),
    );

    return NextResponse.json({
      success: true,
      data: {
        text: result.text,
        modelId: result.modelId,
        durationMs: result.durationMs,
      },
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
        },
        { status: error.status },
      );
    }
    console.error("transcribe error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to transcribe audio";
    const status = /too large|unsupported audio|empty/i.test(message)
      ? 400
      : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status },
    );
  }
}
