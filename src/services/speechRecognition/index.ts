export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ModelProgress {
  status?: string;
  progress?: number;
  name?: string;
  file?: string;
}

type Transcriber = (input: unknown, options?: Record<string, unknown>) => Promise<{ text?: string }>;

let transcriber: Transcriber | null = null;
let loadPromise: Promise<void> | null = null;

export class SpeechRecognitionService {
  onStatusChange?: (status: ModelStatus) => void;
  onProgress?: (progress: ModelProgress) => void;

  initialize(): void {
    if (transcriber || loadPromise) return;

    this.onStatusChange?.('loading');

    loadPromise = (async () => {
      try {
        const { pipeline, env } = await import('@xenova/transformers');

        env.allowLocalModels = false;
        env.useBrowserCache = true;
        env.backends.onnx.wasm.numThreads = 1;

        transcriber = (await pipeline(
          'automatic-speech-recognition',
          'Xenova/whisper-tiny',
          {
            progress_callback: (data: any) => {
              this.onProgress?.(data as ModelProgress);
            },
          },
        )) as Transcriber;

        this.onStatusChange?.('ready');
      } catch (err) {
        console.error('[Whisper]', err);
        loadPromise = null;
        this.onStatusChange?.('error');
      }
    })();
  }

  async transcribe(audio: Float32Array, samplingRate: number): Promise<string> {
    if (loadPromise) await loadPromise;
    if (!transcriber) return '';

    const output = await transcriber(
      { raw: audio, sampling_rate: samplingRate },
      { language: 'spanish', task: 'transcribe' },
    );
    return (output?.text ?? '').trim();
  }

  destroy(): void {
    transcriber = null;
    loadPromise = null;
  }
}
