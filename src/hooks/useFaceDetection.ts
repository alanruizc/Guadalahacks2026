import { useState, useRef, useCallback, useEffect } from 'react';
import {
  initializeFaceLandmarker,
  getFaceLandmarker,
  detectFaces,
  disposeFaceLandmarker,
} from '../services/faceLandmarker';

interface FaceLandmarks {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface FaceDetectionResult {
  landmarks: FaceLandmarks[] | null;
  timestamp: number;
}

interface UseFaceDetectionReturn {
  isLoading: boolean;
  error: string | null;
  faceDetectionResult: FaceDetectionResult | null;
  startDetection: (videoElement: HTMLVideoElement) => void;
  stopDetection: () => void;
}

const FPS = 30;
const FRAME_INTERVAL = 1000 / FPS;

export function useFaceDetection(): UseFaceDetectionReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [faceDetectionResult, setFaceDetectionResult] = useState<FaceDetectionResult | null>(null);

  const animationRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number>(-1);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const initialize = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await initializeFaceLandmarker();
      setIsLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize face landmarker';
      setError(message);
      setIsLoading(false);
    }
  }, []);

  const startDetection = useCallback((videoElement: HTMLVideoElement) => {
    videoRef.current = videoElement;
    const landmarker = getFaceLandmarker();

    if (!landmarker) {
      setError('FaceLandmarker not initialized');
      return;
    }

    const processFrame = (timestamp: number) => {
      if (timestamp - lastTimestampRef.current < FRAME_INTERVAL) {
        animationRef.current = requestAnimationFrame(processFrame);
        return;
      }

      lastTimestampRef.current = timestamp;
      const result = detectFaces(landmarker, videoElement, timestamp);

      if (result && result.faceLandmarks && result.faceLandmarks.length > 0) {
        setFaceDetectionResult({
          landmarks: result.faceLandmarks[0],
          timestamp,
        });
      } else {
        setFaceDetectionResult(null);
      }

      animationRef.current = requestAnimationFrame(processFrame);
    };

    animationRef.current = requestAnimationFrame(processFrame);
  }, []);

  const stopDetection = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    videoRef.current = null;
    setFaceDetectionResult(null);
  }, []);

  useEffect(() => {
    initialize();

    return () => {
      stopDetection();
      disposeFaceLandmarker();
    };
  }, [initialize, stopDetection]);

  return {
    isLoading,
    error,
    faceDetectionResult,
    startDetection,
    stopDetection,
  };
}