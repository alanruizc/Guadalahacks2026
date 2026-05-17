import { useEffect, useRef, useState } from 'react';
import type { FaceLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { initializeFaceLandmarker, detectFaces } from '../../services/faceLandmarker';
import { useFaceDetection } from '../../hooks/useFaceDetection';
import {
  computeFaceZoomTarget,
  faceZoomToTransform,
  getLandmarkBounds,
  smoothFaceZoom,
  type FaceZoomState,
} from './faceZoom';
import styles from './CameraFeed.module.css';

const FPS = 30;
const FRAME_INTERVAL = 1000 / FPS;
const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;

interface CameraFeedProps {
  onReady?: (videoElement: HTMLVideoElement) => void;
  onFatigaChange?: (fatiga: number) => void;
}

function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('No se pudo cargar el video de la cámara'));
    };
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onReady);
      video.removeEventListener('error', onError);
    };

    video.addEventListener('loadedmetadata', onReady);
    video.addEventListener('error', onError);
  });
}

export function CameraFeed({ onReady, onFatigaChange }: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const zoomLayerRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);

  // Consumo del nuevo hook pasivo
  const { nivelFatiga, procesarFotogramaSomnolencia, resetFatiga } = useFaceDetection();

  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef(0);
  const lastDetectionTimeRef = useRef(-1);
  const zoomStateRef = useRef<FaceZoomState>({ scale: 1, originX: 50, originY: 50 });

  onReadyRef.current = onReady;

  // Propagación síncrona hacia App.tsx
  useEffect(() => {
    if (onFatigaChange) {
      onFatigaChange(nivelFatiga);
    }
  }, [nivelFatiga, onFatigaChange]);

  const applyFaceZoom = (landmarks: NormalizedLandmark[] | null) => {
    const wrapper = wrapperRef.current;
    const zoomLayer = zoomLayerRef.current;
    if (!wrapper || !zoomLayer) return;

    const displayWidth = wrapper.clientWidth;
    const displayHeight = wrapper.clientHeight;
    if (displayWidth === 0 || displayHeight === 0) return;

    const target =
      landmarks && landmarks.length > 0
        ? computeFaceZoomTarget(getLandmarkBounds(landmarks), displayWidth, displayHeight)
        : { scale: 1, originX: 50, originY: 50 };

    zoomStateRef.current = smoothFaceZoom(
      zoomStateRef.current,
      target,
      Boolean(landmarks && landmarks.length > 0),
    );

    const zoom = zoomStateRef.current;
    zoomLayer.style.transformOrigin = `${zoom.originX}% ${zoom.originY}%`;
    zoomLayer.style.transform = faceZoomToTransform(zoom);
  };

  const drawLandmarks = (landmarks: NormalizedLandmark[], frameWidth: number, frameHeight: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== frameWidth || canvas.height !== frameHeight) {
      canvas.width = frameWidth;
      canvas.height = frameHeight;
    }

    ctx.clearRect(0, 0, frameWidth, frameHeight);
    ctx.fillStyle = '#00d4ff';
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 1.5;

    const faceOutline = [
      10, 338, 297, 332, 331, 297, 284, 251, 389, 356, 454, 323, 361, 288,
      397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 169, 170, 140,
      171, 175, 396, 369, 395, 394, 364, 365, 397, 288, 361, 323, 454, 356,
      389, 251, 397, 365, 284, 251, 306, 241, 240, 242, 243, 44, 185, 122,
      188, 227, 225, 224, 223, 222, 221, 190, 189, 194, 207, 214, 211, 210,
      211, 43, 230, 228, 229, 231, 232, 135, 169, 170, 140, 171, 175, 396,
      369, 395, 394, 364, 365, 397, 288, 361, 323, 454, 356, 389, 251, 397,
      365, 284, 251, 306, 241, 240, 242, 243, 44, 185, 122, 188, 227, 225,
      224, 223, 222, 221, 190, 189, 194, 207, 214, 211, 210, 211,
    ];

    for (let i = 0; i < faceOutline.length - 1; i++) {
      const p1 = landmarks[faceOutline[i]];
      const p2 = landmarks[faceOutline[i + 1]];
      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1.x * frameWidth, p1.y * frameHeight);
        ctx.lineTo(p2.x * frameWidth, p2.y * frameHeight);
        ctx.stroke();
      }
    }

    const leftEye = [33, 246, 161, 160, 159, 158, 157, 173, 155, 154, 153, 145, 144, 163, 7, 33];
    const rightEye = [263, 466, 397, 288, 361, 323, 454, 356, 389, 251, 397, 365, 284, 251, 397, 263];

    for (let i = 0; i < leftEye.length - 1; i++) {
      const p1 = landmarks[leftEye[i]];
      const p2 = landmarks[leftEye[i + 1]];
      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1.x * frameWidth, p1.y * frameHeight);
        ctx.lineTo(p2.x * frameWidth, p2.y * frameHeight);
        ctx.stroke();
      }
    }

    for (let i = 0; i < rightEye.length - 1; i++) {
      const p1 = landmarks[rightEye[i]];
      const p2 = landmarks[rightEye[i + 1]];
      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1.x * frameWidth, p1.y * frameHeight);
        ctx.lineTo(p2.x * frameWidth, p2.y * frameHeight);
        ctx.stroke();
      }
    }

    for (const point of landmarks) {
      ctx.beginPath();
      ctx.arc(point.x * frameWidth, point.y * frameHeight, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  useEffect(() => {
    let mounted = true;
    let currentStream: MediaStream | null = null;

    async function setupCamera() {
      const video = videoRef.current;
      if (!video) {
        setCameraError('Elemento de video no disponible');
        setIsModelLoading(false);
        return;
      }

      try {
        setCameraError(null);
        setIsModelLoading(true);

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: VIDEO_WIDTH },
            height: { ideal: VIDEO_HEIGHT },
            facingMode: 'user',
          },
          audio: false,
        });

        if (!mounted) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

        currentStream = mediaStream;
        video.srcObject = mediaStream;
        await waitForVideoReady(video);
        await video.play();

        if (!mounted) return;

        const landmarker = await initializeFaceLandmarker();
        if (!mounted) return;

        landmarkerRef.current = landmarker;
        setIsModelLoading(false);
        onReadyRef.current?.(video);

        const processFrame = () => {
          if (!mounted || !videoRef.current || !landmarkerRef.current) {
            return;
          }

          const activeVideo = videoRef.current;
          if (activeVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || activeVideo.videoWidth === 0) {
            animationRef.current = requestAnimationFrame(processFrame);
            return;
          }

          const now = performance.now();
          if (now - lastFrameTimeRef.current < FRAME_INTERVAL) {
            animationRef.current = requestAnimationFrame(processFrame);
            return;
          }
          lastFrameTimeRef.current = now;

          const timestampMs = performance.now();
          if (timestampMs <= lastDetectionTimeRef.current) {
            animationRef.current = requestAnimationFrame(processFrame);
            return;
          }
          lastDetectionTimeRef.current = timestampMs;

          const frameWidth = activeVideo.videoWidth;
          const frameHeight = activeVideo.videoHeight;
          const result = detectFaces(landmarkerRef.current, activeVideo, timestampMs);

          if (result && result.faceLandmarks && result.faceLandmarks.length > 0) {
            const landmarks = result.faceLandmarks[0];
            drawLandmarks(landmarks, frameWidth, frameHeight);
            applyFaceZoom(landmarks);

            // CORRECCIÓN CLAVE: Inyección lineal del fotograma procesado hacia TensorFlow sin colisiones de hilos
            procesarFotogramaSomnolencia(activeVideo, landmarks);
          } else {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (ctx && canvas) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            applyFaceZoom(null);
            
            // Limpiar acumulados si no hay rostro en pantalla
            resetFatiga();
          }

          animationRef.current = requestAnimationFrame(processFrame);
        };

        animationRef.current = requestAnimationFrame(processFrame);
      } catch (err) {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : 'No se pudo acceder a la cámara.';
        setCameraError(message);
        setIsModelLoading(false);
      }
    }

    setupCamera();

    return () => {
      mounted = false;
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
      currentStream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      landmarkerRef.current = null;
    };
  }, [procesarFotogramaSomnolencia, resetFatiga]);

  const containerClass = `${styles.container} ${nivelFatiga > 55 ? styles.drowsyAlert : ''}`;

  return (
    <div className={containerClass}>
      {cameraError ? (
        <div className={styles.error}>
          <span className={styles.errorIcon}>!</span>
          <span>{cameraError}</span>
        </div>
      ) : (
        <div ref={wrapperRef} className={styles.videoWrapper}>
          <div
            ref={zoomLayerRef}
            className={styles.zoomLayer}
            style={{ transform: 'scaleX(-1) scale(1)', transformOrigin: '50% 50%' }}
          >
            <video ref={videoRef} className={styles.video} playsInline muted autoPlay />
            <canvas
              ref={canvasRef}
              className={styles.overlay}
              width={VIDEO_WIDTH}
              height={VIDEO_HEIGHT}
            />
          </div>
          {isModelLoading && (
            <div className={styles.loading}>
              <span>Iniciando cámara y modelo de somnolencia...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}