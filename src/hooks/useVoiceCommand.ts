import { useCallback, useEffect, useRef, useState } from 'react';
import { SpeechRecognitionService, type ModelStatus, type ModelProgress } from '../services/speechRecognition';
import { parseVoiceCommand } from '../services/speechRecognition/commandParser';
import type { VoiceCommandId } from '../services/gestures/gestureCommands';

const CHUNK_MS = 3000;
const MIME_TYPE = 'audio/webm;codecs=opus';

async function blobToFloat32(blob: Blob): Promise<{ audio: Float32Array; samplingRate: number }> {
  const buffer = await blob.arrayBuffer();
  const ctx = new AudioContext();
  try {
    const decoded = await ctx.decodeAudioData(buffer);
    return { audio: decoded.getChannelData(0), samplingRate: decoded.sampleRate };
  } finally {
    void ctx.close();
  }
}

export interface UseVoiceCommandReturn {
  isListening: boolean;
  modelStatus: ModelStatus;
  modelProgress: number;
  lastTranscript: string;
  start: () => Promise<void>;
  stop: () => void;
  retryModel: () => void;
}

// Singleton: el modelo se descarga una sola vez y persiste en el tab
const svc = new SpeechRecognitionService();

export function useVoiceCommand(onCommand?: (id: VoiceCommandId) => void): UseVoiceCommandReturn {
  const [isListening, setIsListening] = useState(false);
  const [modelStatus, setModelStatus] = useState<ModelStatus>('idle');
  const [modelProgress, setModelProgress] = useState(0);
  const [lastTranscript, setLastTranscript] = useState('');

  const streamRef = useRef<MediaStream | null>(null);
  const activeRef = useRef(false);
  const chunkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mimeRef = useRef(MIME_TYPE);
  const modelReadyRef = useRef(false);
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;

  const bindServiceCallbacks = useCallback(() => {
    svc.onStatusChange = (status) => {
      setModelStatus(status);
      modelReadyRef.current = status === 'ready';
    };
    svc.onProgress = (p: ModelProgress) => {
      if (p.progress !== undefined) setModelProgress(Math.round(p.progress));
    };
  }, []);

  const loadModel = useCallback(() => {
    bindServiceCallbacks();
    svc.initialize();
  }, [bindServiceCallbacks]);

  useEffect(() => {
    loadModel();
  }, [loadModel]);

  const recordChunk = useCallback(() => {
    if (!activeRef.current || !streamRef.current) return;

    const mime = mimeRef.current;
    const recorder = new MediaRecorder(streamRef.current, { mimeType: mime });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = async () => {
      if (!activeRef.current) return;
      if (chunks.length > 0 && modelReadyRef.current) {
        try {
          const blob = new Blob(chunks, { type: mime });
          const { audio, samplingRate } = await blobToFloat32(blob);
          const text = await svc.transcribe(audio, samplingRate);
          if (text && activeRef.current) {
            setLastTranscript(text);
            const commandId = parseVoiceCommand(text);
            if (commandId) onCommandRef.current?.(commandId);
          }
        } catch {
          // Transcripción fallida silenciosa; reintenta en el siguiente chunk
        }
      }
      if (activeRef.current) {
        chunkTimerRef.current = setTimeout(recordChunk, 0);
      }
    };

    recorder.start();
    chunkTimerRef.current = setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop();
    }, CHUNK_MS);
  }, []);

  const start = useCallback(async () => {
    if (activeRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      mimeRef.current = MediaRecorder.isTypeSupported(MIME_TYPE) ? MIME_TYPE : 'audio/webm';
      activeRef.current = true;
      setIsListening(true);
      recordChunk();
    } catch {
      // Permiso de micrófono denegado o no disponible
    }
  }, [recordChunk]);

  const stop = useCallback(() => {
    activeRef.current = false;
    if (chunkTimerRef.current) {
      clearTimeout(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setIsListening(false);
    setLastTranscript('');
  }, []);

  const retryModel = useCallback(() => {
    svc.destroy();
    setModelProgress(0);
    loadModel();
  }, [loadModel]);

  useEffect(() => () => { stop(); }, [stop]);

  return { isListening, modelStatus, modelProgress, lastTranscript, start, stop, retryModel };
}
