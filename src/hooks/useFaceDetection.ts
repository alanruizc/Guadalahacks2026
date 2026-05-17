import { useState, useRef, useCallback, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import { initializeFaceLandmarker } from '../services/faceLandmarker';
import type { BlendshapeCategories } from '../services/drowsiness/blendshapes';
import { parseBlendshapeScores } from '../services/drowsiness/blendshapes';
import {
  createFatigueFusionState,
  fuseFatigueSignals,
  type FatigueFusionState,
} from '../services/drowsiness/fatigueFusion';
import { eyeCropToPixels, getEyeRegionBounds } from '../services/drowsiness/eyeCrop';

interface FaceLandmarks {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

interface UseFaceDetectionReturn {
  isLoading: boolean;
  error: string | null;
  nivelFatiga: number;
  procesarFotogramaSomnolencia: (
    video: HTMLVideoElement,
    landmarks: FaceLandmarks[],
    blendshapes?: BlendshapeCategories,
  ) => void;
  resetFatiga: () => void;
}

export function useFaceDetection(): UseFaceDetectionReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nivelFatiga, setNivelFatiga] = useState<number>(0);

  const modelRef = useRef<tf.LayersModel | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fusionStateRef = useRef<FatigueFusionState>(createFatigueFusionState());
  const nivelFatigaRef = useRef<number>(0);

  const applyFatigueLevel = useCallback((level: number) => {
    if (level !== nivelFatigaRef.current) {
      nivelFatigaRef.current = level;
      setNivelFatiga(level);
    }
  }, []);

  const initialize = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await initializeFaceLandmarker();

      const loadedModel = await tf.loadLayersModel('/model/model.json');
      modelRef.current = loadedModel;

      const canvas = document.createElement('canvas');
      canvas.width = 224;
      canvas.height = 224;
      offscreenCanvasRef.current = canvas;

      setIsLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error inicializando modelos.';
      setError(message);
      setIsLoading(false);
    }
  }, []);

  const runTensorFlowEyes = useCallback(
    (video: HTMLVideoElement, landmarks: FaceLandmarks[]): number | null => {
      if (!modelRef.current || !offscreenCanvasRef.current) return null;

      const bounds = getEyeRegionBounds(landmarks);
      if (!bounds) return null;

      const videoWidth = video.videoWidth || 640;
      const videoHeight = video.videoHeight || 480;
      const { x, y, width, height } = eyeCropToPixels(bounds, videoWidth, videoHeight);

      if (width < 10 || height < 10) return null;

      const ctx = offscreenCanvasRef.current.getContext('2d');
      if (!ctx) return null;

      ctx.clearRect(0, 0, 224, 224);
      ctx.drawImage(video, x, y, width, height, 0, 0, 224, 224);

      let probDormido = 0;
      tf.tidy(() => {
        const imgTensor = tf.browser.fromPixels(offscreenCanvasRef.current!);
        const normalized = imgTensor.toFloat().div(tf.scalar(255.0));
        const batched = normalized.expandDims(0);
        const prediccion = modelRef.current!.predict(batched) as tf.Tensor;
        probDormido = prediccion.dataSync()[1];
      });

      return probDormido;
    },
    [],
  );

  const procesarFotogramaSomnolencia = useCallback(
    (video: HTMLVideoElement, landmarks: FaceLandmarks[], blendshapes?: BlendshapeCategories) => {
      if (!landmarks.length) return;

      const parsedBlendshapes = parseBlendshapeScores(blendshapes);
      const modelProbDormido = runTensorFlowEyes(video, landmarks);

      const { state, level } = fuseFatigueSignals({
        state: fusionStateRef.current,
        blendshapes: parsedBlendshapes,
        modelProbDormido,
      });

      fusionStateRef.current = state;
      applyFatigueLevel(level);
    },
    [applyFatigueLevel, runTensorFlowEyes],
  );

  const resetFatiga = useCallback(() => {
    fusionStateRef.current = createFatigueFusionState();
    applyFatigueLevel(0);
  }, [applyFatigueLevel]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return {
    isLoading,
    error,
    nivelFatiga,
    procesarFotogramaSomnolencia,
    resetFatiga,
  };
}
