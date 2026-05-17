import type { FaceBlendshapeScores } from './blendshapes';
import {
  areBothEyesClosed,
  areBothEyesOpen,
  isLookingDown,
  isSquinting,
  isYawning,
} from './blendshapes';

// Frames consecutivos con ojos cerrados para interpretar como señal fuerte (~0,4 s/30fps)
const CLOSED_FRAMES_STRONG = 12;
// Frames con ojos cerrados para interpretar como señal leve (~0,13 s/30fps)
const CLOSED_FRAMES_MILD = 4;

export interface FatigueFusionState {
  accumulated: number;
  closedFrameCount: number;
}

export interface FatigueFusionInput {
  state: FatigueFusionState;
  blendshapes: FaceBlendshapeScores | null;
  modelProbDormido: number | null;
}

export interface FatigueFusionResult {
  state: FatigueFusionState;
  level: number;
}

export function fuseFatigueSignals({
  state,
  blendshapes,
  modelProbDormido,
}: FatigueFusionInput): FatigueFusionResult {
  let { accumulated, closedFrameCount } = state;
  let delta = 0;

  if (blendshapes) {
    const eyesClosed = areBothEyesClosed(blendshapes);
    const eyesOpen = areBothEyesOpen(blendshapes);
    const lookingDown = isLookingDown(blendshapes);
    const yawning = isYawning(blendshapes);
    const squinting = isSquinting(blendshapes);

    if (eyesClosed) {
      closedFrameCount += 1;
    } else {
      closedFrameCount = 0;
    }

    if (closedFrameCount >= CLOSED_FRAMES_STRONG) {
      delta += 14;
    } else if (closedFrameCount >= CLOSED_FRAMES_MILD) {
      delta += 5;
    } else if (yawning) {
      delta += 8;
    }

    if (eyesOpen && !lookingDown) {
      delta -= 14;
    } else if (eyesOpen) {
      delta -= 8;
    } else if (lookingDown) {
      delta -= 4;
    }

    if (squinting && !eyesClosed) {
      delta -= 3;
    }

    const tfProb = modelProbDormido ?? 0;
    if (tfProb > 0.65) {
      if (eyesOpen && !lookingDown) {
        delta += 4;
      } else if (eyesClosed) {
        delta += 2;
      } else if (!eyesOpen) {
        delta += 0;
      }
    }
  } else if (modelProbDormido !== null) {
    if (modelProbDormido > 0.65) {
      delta += 6;
    } else {
      delta -= 10;
    }
    closedFrameCount = 0;
  }

  accumulated = Math.max(0, Math.min(100, accumulated + delta));

  return {
    state: { accumulated, closedFrameCount },
    level: Math.round(accumulated),
  };
}

export function createFatigueFusionState(): FatigueFusionState {
  return { accumulated: 0, closedFrameCount: 0 };
}
