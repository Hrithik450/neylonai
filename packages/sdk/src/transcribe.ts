import { tryGetAuthHeaders } from "./client";
import { apiUrl } from "./network";

export interface TranscribeAudioClientInput {
  /** Recorded audio blob (typically webm/mp4 from MediaRecorder). */
  audio: Blob;
  /** Optional duration for server-side token estimate fallback. */
  durationMs?: number;
  signal?: AbortSignal;
}

export interface TranscribeAudioResult {
  text: string;
  modelId?: string;
  durationMs?: number | null;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to read audio"));
        return;
      }
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read audio"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Transcribe a short voice recording via Neylon AI (Gemini STT, metered).
 * Returns transcript text for the widget input — does not send a chat turn.
 */
export async function transcribeAudio(
  payload: TranscribeAudioClientInput,
): Promise<TranscribeAudioResult> {
  const auth = tryGetAuthHeaders({ "Content-Type": "application/json" });
  if ("error" in auth) {
    throw new Error(auth.error);
  }

  const audioBase64 = await blobToBase64(payload.audio);
  const mimeType = payload.audio.type || "audio/webm";

  const response = await fetch(apiUrl("/orchestration/api/v1/transcribe"), {
    method: "POST",
    headers: auth.headers,
    body: JSON.stringify({
      audioBase64,
      mimeType,
      durationMs: payload.durationMs,
    }),
    signal: payload.signal,
  });

  const json = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
    data?: { text?: string; modelId?: string; durationMs?: number | null };
  };

  if (!response.ok || !json.success) {
    throw new Error(
      json.error ??
        (response.status === 402
          ? "Subscription inactive or conversation limit reached."
          : "Could not transcribe audio. Please try again."),
    );
  }

  return {
    text: String(json.data?.text ?? "").trim(),
    modelId: json.data?.modelId,
    durationMs: json.data?.durationMs ?? null,
  };
}
