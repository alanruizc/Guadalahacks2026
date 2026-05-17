import { useCallback, useRef, useState } from 'react';
import type { GestureRecognizerResult } from '../services/gestureRecognizer';
import {
  extractDetectedGestures,
  pickPrimaryGesture,
  type DetectedGesture,
} from '../services/gestures/extractGestures';

const DEFAULT_MIN_SCORE = 0.65;
const DEFAULT_COOLDOWN_MS = 2000;

interface UseGestureRecognitionOptions {
  minScore?: number;
  cooldownMs?: number;
  onGestureConfirmed?: (gesture: DetectedGesture) => void;
}

interface UseGestureRecognitionReturn {
  activeGestures: DetectedGesture[];
  primaryGesture: DetectedGesture | null;
  lastConfirmedGesture: DetectedGesture | null;
  procesarResultadoGesto: (result: GestureRecognizerResult | null) => void;
  clearActiveGestures: () => void;
}

function gestureKey(gesture: DetectedGesture): string {
  return `${gesture.handedness}:${gesture.name}`;
}

export function useGestureRecognition(
  options: UseGestureRecognitionOptions = {},
): UseGestureRecognitionReturn {
  const { minScore = DEFAULT_MIN_SCORE, cooldownMs = DEFAULT_COOLDOWN_MS, onGestureConfirmed } =
    options;

  const [activeGestures, setActiveGestures] = useState<DetectedGesture[]>([]);
  const [primaryGesture, setPrimaryGesture] = useState<DetectedGesture | null>(null);
  const [lastConfirmedGesture, setLastConfirmedGesture] = useState<DetectedGesture | null>(null);

  const onGestureConfirmedRef = useRef(onGestureConfirmed);
  const lastConfirmedKeyRef = useRef<string | null>(null);
  const lastConfirmedAtRef = useRef(0);

  onGestureConfirmedRef.current = onGestureConfirmed;

  const confirmGesture = useCallback(
    (gesture: DetectedGesture) => {
      const key = gestureKey(gesture);
      const now = Date.now();

      if (
        lastConfirmedKeyRef.current === key &&
        now - lastConfirmedAtRef.current < cooldownMs
      ) {
        return;
      }

      lastConfirmedKeyRef.current = key;
      lastConfirmedAtRef.current = now;
      setLastConfirmedGesture(gesture);
      onGestureConfirmedRef.current?.(gesture);
    },
    [cooldownMs],
  );

  const procesarResultadoGesto = useCallback(
    (result: GestureRecognizerResult | null) => {
      const detected = result ? extractDetectedGestures(result, minScore) : [];
      const primary = pickPrimaryGesture(detected);

      setActiveGestures(detected);
      setPrimaryGesture(primary);

      if (primary) {
        confirmGesture(primary);
      }
    },
    [confirmGesture, minScore],
  );

  const clearActiveGestures = useCallback(() => {
    setActiveGestures([]);
    setPrimaryGesture(null);
  }, []);

  return {
    activeGestures,
    primaryGesture,
    lastConfirmedGesture,
    procesarResultadoGesto,
    clearActiveGestures,
  };
}
