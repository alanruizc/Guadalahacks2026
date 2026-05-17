import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from '@mediapipe/tasks-vision';

// Cambiamos las rutas locales caóticas por las URLs oficiales e infalibles de Google por internet
const MODEL_PATH = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm';

let faceLandmarkerInstance: FaceLandmarker | null = null;
let initPromise: Promise<FaceLandmarker> | null = null;

async function createLandmarker(delegate: 'GPU' | 'CPU'): Promise<FaceLandmarker> {
  // Inicializamos el resolvedor de tareas apuntando directamente al CDN remoto
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH, false);

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
    } catch (err) {
      console.warn("Fallo al inicializar en GPU, intentando con CPU...", err);
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