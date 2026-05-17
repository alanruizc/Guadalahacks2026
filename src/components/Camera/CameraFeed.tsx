import { useEffect, useRef, useState } from 'react';
import {
  DrawingUtils,
  type FaceLandmarker,
  type GestureRecognizer,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';
import { initializeFaceLandmarker, detectFaces } from '../../services/faceLandmarker';
import {
  initializeGestureRecognizer,
  recognizeGestures,
  disposeGestureRecognizer,
} from '../../services/gestureRecognizer';
import type { DetectedGesture } from '../../services/gestures/extractGestures';
import { drawFaceMesh } from './drawFaceMesh';
import { drawHands } from './drawHands';
import { useFaceDetection } from '../../hooks/useFaceDetection';
import { useGestureRecognition } from '../../hooks/useGestureRecognition';
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
  onGestureConfirmed?: (gesture: DetectedGesture) => void;
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

export function CameraFeed({ onReady, onFatigaChange, onGestureConfirmed }: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const zoomLayerRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  const onFatigaChangeRef = useRef(onFatigaChange);
  const onGestureConfirmedRef = useRef(onGestureConfirmed);
  const lastReportedFatigaRef = useRef<number | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);

  const { nivelFatiga, procesarFotogramaSomnolencia, resetFatiga } = useFaceDetection();
  const { procesarResultadoGesto } = useGestureRecognition({
    onGestureConfirmed,
  });

  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const gestureRecognizerRef = useRef<GestureRecognizer | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef(0);
  const lastDetectionTimeRef = useRef(-1);
  const zoomStateRef = useRef<FaceZoomState>({ scale: 1, originX: 50, originY: 50 });
  const drawingUtilsRef = useRef<DrawingUtils | null>(null);

  onReadyRef.current = onReady;
  onFatigaChangeRef.current = onFatigaChange;
  onGestureConfirmedRef.current = onGestureConfirmed;

  useEffect(() => {
    if (lastReportedFatigaRef.current === nivelFatiga) return;
    lastReportedFatigaRef.current = nivelFatiga;
    onFatigaChangeRef.current?.(nivelFatiga);
  }, [nivelFatiga]);

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

  const drawFrameOverlay = (
    faceLandmarks: NormalizedLandmark[] | null,
    handLandmarks: NormalizedLandmark[][] | null,
    frameWidth: number,
    frameHeight: number,
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== frameWidth || canvas.height !== frameHeight) {
      canvas.width = frameWidth;
      canvas.height = frameHeight;
    }

    ctx.clearRect(0, 0, frameWidth, frameHeight);

    if (!faceLandmarks?.length && !handLandmarks?.length) return;

    drawingUtilsRef.current = new DrawingUtils(ctx);

    if (faceLandmarks?.length) {
      drawFaceMesh(drawingUtilsRef.current, faceLandmarks);
    }

    if (handLandmarks?.length) {
      drawHands(drawingUtilsRef.current, handLandmarks);
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

        const [landmarker, gestureRecognizer] = await Promise.all([
          initializeFaceLandmarker(),
          initializeGestureRecognizer(),
        ]);
        if (!mounted) return;

        landmarkerRef.current = landmarker;
        gestureRecognizerRef.current = gestureRecognizer;
        setIsModelLoading(false);
        onReadyRef.current?.(video);

        const processFrame = () => {
          if (!mounted || !videoRef.current || !landmarkerRef.current || !gestureRecognizerRef.current) {
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
          const faceResult = detectFaces(landmarkerRef.current, activeVideo, timestampMs);
          const gestureResult = recognizeGestures(
            gestureRecognizerRef.current,
            activeVideo,
            timestampMs,
          );

          procesarResultadoGesto(gestureResult);

          const faceLandmarks =
            faceResult?.faceLandmarks && faceResult.faceLandmarks.length > 0
              ? faceResult.faceLandmarks[0]
              : null;
          const handLandmarks =
            gestureResult.landmarks && gestureResult.landmarks.length > 0
              ? gestureResult.landmarks
              : null;

          drawFrameOverlay(faceLandmarks, handLandmarks, frameWidth, frameHeight);

          if (faceLandmarks) {
            applyFaceZoom(faceLandmarks);
            const blendshapes = faceResult.faceBlendshapes?.[0];
            procesarFotogramaSomnolencia(activeVideo, faceLandmarks, blendshapes);
          } else {
            applyFaceZoom(null);
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
      gestureRecognizerRef.current = null;
      disposeGestureRecognizer();
    };
  }, [procesarFotogramaSomnolencia, procesarResultadoGesto, resetFatiga]);

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
              <span>Iniciando cámara y modelos de visión...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}