import { useCallback, useEffect, useRef, useState } from 'react';
import { SpeechRecognitionService, type ModelStatus, type ModelProgress } from '../services/speechRecognition';
import {
  COMMAND_ARMED_MS,
  WAKE_WORD_LABEL,
  processCopilotUtterance,
} from '../services/speechRecognition/wakeWord';
import {
  WebSpeechRecognizer,
  isWebSpeechAvailable,
} from '../services/speechRecognition/webSpeechRecognizer';
import { getCommandLabel, type VoiceCommandId } from '../services/voice/voiceCommands';

const CHUNK_MS = 1500;
const MIME_TYPE = 'audio/webm;codecs=opus';
const USE_WEB_SPEECH = isWebSpeechAvailable();

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

export type VoiceEngine = 'web' | 'whisper' | null;
export type VoiceListenPhase = 'off' | 'wake' | 'armed';

export interface UseVoiceCommandOptions {
  onCommand?: (id: VoiceCommandId) => void;
  autoStart?: boolean;
}

export interface UseVoiceCommandReturn {
  isListening: boolean;
  listenPhase: VoiceListenPhase;
  modelStatus: ModelStatus;
  modelProgress: number;
  engine: VoiceEngine;
  lastTranscript: string;
  lastCommandId: VoiceCommandId | null;
  lastFeedback: string;
  start: () => Promise<void>;
  stop: () => void;
  retryModel: () => void;
}

const whisperSvc = new SpeechRecognitionService();

export function useVoiceCommand(options: UseVoiceCommandOptions = {}): UseVoiceCommandReturn {
  const { onCommand, autoStart = false } = options;

  const [isListening, setIsListening] = useState(false);
  const [armedUntil, setArmedUntil] = useState(0);
  const [modelStatus, setModelStatus] = useState<ModelStatus>(USE_WEB_SPEECH ? 'ready' : 'idle');
  const [modelProgress, setModelProgress] = useState(USE_WEB_SPEECH ? 100 : 0);
  const [engine, setEngine] = useState<VoiceEngine>(USE_WEB_SPEECH ? 'web' : null);
  const [lastTranscript, setLastTranscript] = useState('');
  const [lastCommandId, setLastCommandId] = useState<VoiceCommandId | null>(null);
  const [lastFeedback, setLastFeedback] = useState('');

  const streamRef = useRef<MediaStream | null>(null);
  const activeRef = useRef(false);
  const userStoppedRef = useRef(false);
  const armedUntilRef = useRef(0);
  const pendingStartRef = useRef(false);
  const chunkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mimeRef = useRef(MIME_TYPE);
  const modelReadyRef = useRef(USE_WEB_SPEECH);
  const webSpeechRef = useRef<WebSpeechRecognizer | null>(null);
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;

  armedUntilRef.current = armedUntil;

  const listenPhase: VoiceListenPhase = !isListening
    ? 'off'
    : Date.now() < armedUntil
      ? 'armed'
      : 'wake';

  const armListening = useCallback(() => {
    const until = Date.now() + COMMAND_ARMED_MS;
    armedUntilRef.current = until;
    setArmedUntil(until);
    setLastFeedback('Te escucho. Di tu comando.');
  }, []);

  const handleTranscript = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !activeRef.current) return;

      setLastTranscript(trimmed);
      const isArmed = Date.now() < armedUntilRef.current;
      const result = processCopilotUtterance(trimmed, isArmed);

      if (result.type === 'wake_only') {
        armListening();
        setLastCommandId(null);
        return;
      }

      if (result.type === 'command') {
        setLastCommandId(result.commandId);
        setLastFeedback(getCommandLabel(result.commandId));
        armedUntilRef.current = 0;
        setArmedUntil(0);
        onCommandRef.current?.(result.commandId);
        if (activeRef.current) {
          setLastFeedback(`Di «${WAKE_WORD_LABEL}» y luego tu comando`);
        }
        return;
      }

      if (isArmed) {
        setLastFeedback('No reconocí el comando. Prueba: «estado» o «confirmar alerta».');
      }
    },
    [armListening],
  );

  const startInternalRef = useRef<() => Promise<void>>(async () => {});

  const bindWhisperCallbacks = useCallback(() => {
    whisperSvc.onStatusChange = (status) => {
      if (!USE_WEB_SPEECH || status !== 'ready') {
        setModelStatus(status);
      }
      modelReadyRef.current = USE_WEB_SPEECH || status === 'ready';
      if (status === 'ready' && !USE_WEB_SPEECH) {
        setEngine('whisper');
        if (pendingStartRef.current) {
          pendingStartRef.current = false;
          void startInternalRef.current();
        }
      }
    };
    whisperSvc.onProgress = (p: ModelProgress) => {
      if (!USE_WEB_SPEECH && p.progress !== undefined) {
        setModelProgress(Math.round(p.progress));
      }
    };
  }, []);

  const loadWhisper = useCallback(() => {
    bindWhisperCallbacks();
    whisperSvc.initialize();
  }, [bindWhisperCallbacks]);

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
          const text = await whisperSvc.transcribe(audio, samplingRate);
          if (text) handleTranscript(text);
        } catch {
          // siguiente chunk
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
  }, [handleTranscript]);

  const startWhisper = useCallback(async () => {
    if (!modelReadyRef.current) {
      pendingStartRef.current = true;
      setLastFeedback('Cargando reconocimiento de voz…');
      loadWhisper();
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    streamRef.current = stream;
    mimeRef.current = MediaRecorder.isTypeSupported(MIME_TYPE) ? MIME_TYPE : 'audio/webm';
    setEngine('whisper');
    recordChunk();
  }, [loadWhisper, recordChunk]);

  const releaseMic = useCallback(() => {
    activeRef.current = false;
    webSpeechRef.current?.stop();
    webSpeechRef.current = null;

    if (chunkTimerRef.current) {
      clearTimeout(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    setIsListening(false);
    armedUntilRef.current = 0;
    setArmedUntil(0);
    if (USE_WEB_SPEECH) setEngine('web');
  }, []);

  const startInternal = useCallback(async () => {
    if (activeRef.current) return;

    try {
      activeRef.current = true;
      setIsListening(true);
      setLastFeedback(`Di «${WAKE_WORD_LABEL}» y tu comando`);
      setLastTranscript('');
      setLastCommandId(null);
      armedUntilRef.current = 0;
      setArmedUntil(0);

      if (USE_WEB_SPEECH) {
        const web = new WebSpeechRecognizer();
        webSpeechRef.current = web;
        const ok = web.start(handleTranscript);
        if (ok) {
          setEngine('web');
          setModelStatus('ready');
          return;
        }
        webSpeechRef.current = null;
      }

      await startWhisper();
    } catch {
      activeRef.current = false;
      setIsListening(false);
      setLastFeedback('No se pudo usar el micrófono. Revisa los permisos.');
    }
  }, [handleTranscript, startWhisper]);

  startInternalRef.current = startInternal;

  const start = useCallback(async () => {
    userStoppedRef.current = false;
    await startInternal();
  }, [startInternal]);

  const stop = useCallback(() => {
    userStoppedRef.current = true;
    releaseMic();
    setLastTranscript('');
    setLastCommandId(null);
    setLastFeedback('');
  }, [releaseMic]);

  const retryModel = useCallback(() => {
    whisperSvc.destroy();
    setModelProgress(0);
    loadWhisper();
  }, [loadWhisper]);

  useEffect(() => {
    if (!autoStart) return;
    userStoppedRef.current = false;
    void startInternal();
    return () => releaseMic();
  }, [autoStart, startInternal, releaseMic]);

  useEffect(() => {
    if (!USE_WEB_SPEECH) loadWhisper();
  }, [loadWhisper]);

  return {
    isListening,
    listenPhase,
    modelStatus,
    modelProgress,
    engine,
    lastTranscript,
    lastCommandId,
    lastFeedback,
    start,
    stop,
    retryModel,
  };
}
