import {
  GestureRecognizer,
  FilesetResolver,
  type GestureRecognizerResult,
} from '@mediapipe/tasks-vision';

const MODEL_PATH = '/models/gesture_recognizer.task';
const WASM_PATH = '/wasm';

let gestureRecognizerInstance: GestureRecognizer | null = null;
let initPromise: Promise<GestureRecognizer> | null = null;

async function createRecognizer(delegate: 'GPU' | 'CPU'): Promise<GestureRecognizer> {
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH, false);

  return GestureRecognizer.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_PATH,
      delegate,
    },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

export async function initializeGestureRecognizer(): Promise<GestureRecognizer> {
  if (gestureRecognizerInstance) {
    return gestureRecognizerInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      gestureRecognizerInstance = await createRecognizer('GPU');
    } catch (err) {
      console.warn('GestureRecognizer GPU falló, cambiando aCPU...', err);
      gestureRecognizerInstance = await createRecognizer('CPU');
    }
    return gestureRecognizerInstance;
  })();

  try {
    return await initPromise;
  } catch (error) {
    initPromise = null;
    throw error;
  }
}

export function getGestureRecognizer(): GestureRecognizer | null {
  return gestureRecognizerInstance;
}

export function recognizeGestures(
  recognizer: GestureRecognizer,
  videoElement: HTMLVideoElement,
  timestampMs: number,
): GestureRecognizerResult {
  return recognizer.recognizeForVideo(videoElement, timestampMs);
}

export function disposeGestureRecognizer(): void {
  if (gestureRecognizerInstance) {
    gestureRecognizerInstance.close();
    gestureRecognizerInstance = null;
  }
  initPromise = null;
}

export type { GestureRecognizerResult };
