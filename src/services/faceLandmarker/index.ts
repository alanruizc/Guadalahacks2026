import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from '@mediapipe/tasks-vision';

const MODEL_PATH = '/models/face_landmarker.task';
const WASM_PATH = '/wasm';

let faceLandmarkerInstance: FaceLandmarker | null = null;
let initPromise: Promise<FaceLandmarker> | null = null;

async function createLandmarker(delegate: 'GPU' | 'CPU'): Promise<FaceLandmarker> {
  const wasmBase = new URL(WASM_PATH, window.location.origin).href.replace(/\/$/, '');
  const vision = await FilesetResolver.forVisionTasks(wasmBase, false);

  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_PATH,
      delegate,
    },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
  });
}

export async function initializeFaceLandmarker(): Promise<FaceLandmarker> {
  if (faceLandmarkerInstance) {
    return faceLandmarkerInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      faceLandmarkerInstance = await createLandmarker('GPU');
    } catch {
      faceLandmarkerInstance = await createLandmarker('CPU');
    }
    return faceLandmarkerInstance;
  })();

  try {
    return await initPromise;
  } catch (error) {
    initPromise = null;
    throw error;
  }
}

export function getFaceLandmarker(): FaceLandmarker | null {
  return faceLandmarkerInstance;
}

export function detectFaces(
  landmarker: FaceLandmarker,
  videoElement: HTMLVideoElement,
  timestampMs: number
): FaceLandmarkerResult {
  return landmarker.detectForVideo(videoElement, timestampMs);
}

export function disposeFaceLandmarker(): void {
  if (faceLandmarkerInstance) {
    faceLandmarkerInstance.close();
    faceLandmarkerInstance = null;
  }
  initPromise = null;
}

export type { FaceLandmarkerResult };
