import { useEffect, useRef, useState } from 'react';
import type {
  FaceLandmarker,
  GestureRecognizer,
  NormalizedLandmark,
} from '@mediapipe/tasks-vision';
import { initializeFaceLandmarker, detectFaces } from '../../services/faceLandmarker';
import {
  initializeGestureRecognizer,
  recognizeGestures,
  disposeGestureRecognizer,
} from '../../services/gestureRecognizer';
import type { DetectedGesture } from '../../services/gestures/extractGestures';
import { useFaceDetection } from '../../hooks/useFaceDetection';
import { useGestureRecognition } from '../../hooks/useGestureRecognition';
import { formatGestureHint } from '../../services/voice/voiceCommands';
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

/** Malla de cara/manos en canvas (detección sigue activa). */
const SHOW_LANDMARK_MESH = false;

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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const zoomLayerRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  const onFatigaChangeRef = useRef(onFatigaChange);
  const onGestureConfirmedRef = useRef(onGestureConfirmed);
  const lastReportedFatigaRef = useRef<number | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);

  const { nivelFatiga, procesarFotogramaSomnolencia, resetFatiga } = useFaceDetection();
  const { procesarResultadoGesto, primaryGesture } = useGestureRecognition({
    onGestureConfirmed,
  });

  const gestureHint =
    primaryGesture ? formatGestureHint(primaryGesture.name) : null;

  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const gestureRecognizerRef = useRef<GestureRecognizer | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef(0);
  const lastDetectionTimeRef = useRef(-1);
  const zoomStateRef = useRef<FaceZoomState>({ scale: 1, originX: 50, originY: 50 });

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
            {SHOW_LANDMARK_MESH && (
              <canvas
                className={styles.overlay}
                width={VIDEO_WIDTH}
                height={VIDEO_HEIGHT}
              />
            )}
          </div>
          {gestureHint && !isModelLoading && (
            <div className={styles.gestureHint} role="status">
              {gestureHint}
            </div>
          )}
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