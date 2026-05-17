import type { GestureRecognizerResult } from '@mediapipe/tasks-vision';

/** Gestos incluidos en el modelo estándar de MediaPipe Gesture Recognizer */
export const CANNED_GESTURE_NAMES = [
  'Closed_Fist',
  'Open_Palm',
  'Pointing_Up',
  'Thumb_Down',
  'Thumb_Up',
  'Victory',
  'ILoveYou',
] as const;

export type CannedGestureName = (typeof CANNED_GESTURE_NAMES)[number];

export interface DetectedGesture {
  name: string;
  score: number;
  handedness: string;
}

export function extractDetectedGestures(
  result: GestureRecognizerResult,
  minScore = 0.5,
): DetectedGesture[] {
  if (!result.gestures?.length) return [];

  const detected: DetectedGesture[] = [];

  result.gestures.forEach((gestureList, index) => {
    const top = gestureList[0];
    if (!top || top.categoryName === 'None' || top.score < minScore) return;

    const handedness =
      result.handedness?.[index]?.[0]?.displayName ??
      result.handedness?.[index]?.[0]?.categoryName ??
      `Mano ${index + 1}`;

    detected.push({
      name: top.categoryName,
      score: top.score,
      handedness,
    });
  });

  return detected;
}

export function pickPrimaryGesture(gestures: DetectedGesture[]): DetectedGesture | null {
  if (gestures.length === 0) return null;
  return [...gestures].sort((a, b) => b.score - a.score)[0];
}
