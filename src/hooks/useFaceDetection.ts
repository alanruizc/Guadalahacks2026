import { useState, useRef, useCallback, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import { initializeFaceLandmarker } from '../services/faceLandmarker';

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
  nivelFatiga: number;
  procesarFotogramaSomnolencia: (video: HTMLVideoElement, landmarks: FaceLandmarks[]) => void;
  resetFatiga: () => void;
}

export function useFaceDetection(): UseFaceDetectionReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nivelFatiga, setNivelFatiga] = useState<number>(0);

  const modelRef = useRef<tf.LayersModel | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const porcentajeAcumuladoRef = useRef<number>(0);

  const initialize = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await initializeFaceLandmarker();
      
      // Intentar cargar las capas del modelo entrenado
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

  const procesarFotogramaSomnolencia = useCallback((video: HTMLVideoElement, landmarks: FaceLandmarks[]) => {
    if (!modelRef.current || !offscreenCanvasRef.current || !landmarks || landmarks.length === 0) return;

    const ctx = offscreenCanvasRef.current.getContext('2d');
    if (!ctx) return;

    // Índices periféricos clave de ambos ojos en MediaPipe FaceMesh
    // POR ESTO (Puntos extremos del óvalo facial completo):
    const indicesOjos = [10, 152, 234, 454, 139, 368, 58, 288];
    const puntosOjos = indicesOjos.map(idx => landmarks[idx]).filter(Boolean);

    if (puntosOjos.length === 0) return;

    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    puntosOjos.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    const videoWidth = video.videoWidth || 640;
    const videoHeight = video.videoHeight || 480;
    
    let x = minX * videoWidth;
    let y = minY * videoHeight;
    let width = (maxX - minX) * videoWidth;
    let height = (maxY - minY) * videoHeight;

    const paddingX = width * 0.45;
    const paddingY = height * 0.45;

    x = Math.max(0, x - paddingX);
    y = Math.max(0, y - paddingY);
    width = Math.min(videoWidth - x, width + (paddingX * 2));
    height = Math.min(videoHeight - y, height + (paddingY * 2));

    if (width < 10 || height < 10) return;

    ctx.clearRect(0, 0, 224, 224);
    ctx.drawImage(video, x, y, width, height, 0, 0, 224, 224);

    tf.tidy(() => {
      const imgTensor = tf.browser.fromPixels(offscreenCanvasRef.current!);
      const floatTensor = imgTensor.toFloat();
      const normalizedTensor = floatTensor.div(tf.scalar(255.0));
      const batchedTensor = normalizedTensor.expandDims(0);

      const prediccion = modelRef.current!.predict(batchedTensor) as tf.Tensor;
      const datos = prediccion.dataSync();

      const probDespierto = datos[0];
      const probDormido = datos[1];

      // Registro en consola para verificar los cambios en caliente
      console.log(`[Inferencia] Cansado: ${(probDormido * 100).toFixed(0)}% | Despierto: ${(probDespierto * 100).toFixed(0)}%`);

      if (probDormido > 0.65) {
        porcentajeAcumuladoRef.current = Math.min(100, porcentajeAcumuladoRef.current + 8);
      } else {
        porcentajeAcumuladoRef.current = Math.max(0, porcentajeAcumuladoRef.current - 12);
      }

      setNivelFatiga(Math.round(porcentajeAcumuladoRef.current));
    });
  }, []);

  const resetFatiga = useCallback(() => {
    porcentajeAcumuladoRef.current = 0;
    setNivelFatiga(0);
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return {
    isLoading,
    error,
    nivelFatiga,
    procesarFotogramaSomnolencia,
    resetFatiga
  };
}