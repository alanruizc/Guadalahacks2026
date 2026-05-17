const API_BASE = (import.meta.env.VITE_STT_API_URL as string | undefined) ?? 'https://localhost:8000';

export type VoiceCommandType =
  | 'WAKE_WORD'
  | 'SEND_MESSAGE'
  | 'SEND_MESSAGE_TARGET'
  | 'SEND_MESSAGE_EXPIRED';

export interface VoiceCommandResult {
  text: string;
  command: VoiceCommandType | null;
  is_final: boolean;
  confidence: number;
  partial?: boolean;
}

export interface VoiceApiStatus {
  active_copilot: boolean;
  copilot_ttl_remaining: number;
  awaiting_followup: string | null;
  followup_ttl_remaining: number;
}

async function safeFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(input, { ...init, signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function sendAudioChunk(blob: Blob): Promise<VoiceCommandResult | null> {
  const form = new FormData();
  form.append('file', blob, 'chunk.webm');
  return safeFetch<VoiceCommandResult>(`${API_BASE}/audio-chunk`, {
    method: 'POST',
    body: form,
  });
}

export async function getLatestCommand(): Promise<VoiceCommandResult | null> {
  return safeFetch<VoiceCommandResult>(`${API_BASE}/command`);
}

export async function getApiStatus(): Promise<VoiceApiStatus | null> {
  return safeFetch<VoiceApiStatus>(`${API_BASE}/status`);
}

export async function clearCommandHistory(): Promise<void> {
  await safeFetch(`${API_BASE}/commands`, { method: 'DELETE' });
}
