import { WAKE_WORD_LABEL } from '../../services/speechRecognition/wakeWord';
import type { ModelStatus } from '../../services/speechRecognition';
import type { VoiceListenPhase } from '../../hooks/useVoiceCommand';
import styles from './VoiceStatusStrip.module.css';

interface VoiceStatusStripProps {
  listenPhase: VoiceListenPhase;
  modelStatus: ModelStatus;
  modelProgress: number;
  feedback: string;
  onResume?: () => void;
  onRetry?: () => void;
}

export function VoiceStatusStrip({
  listenPhase,
  modelStatus,
  modelProgress,
  feedback,
  onResume,
  onRetry,
}: VoiceStatusStripProps) {
  const statusLine =
    modelStatus === 'loading'
      ? `Preparando voz${modelProgress > 0 ? ` ${modelProgress}%` : '…'}`
      : modelStatus === 'error'
        ? 'Error de voz'
        : listenPhase === 'off'
          ? 'Micrófono apagado'
          : listenPhase === 'armed'
            ? 'Escuchando comando…'
            : `Di «${WAKE_WORD_LABEL}»`;

  return (
    <div className={styles.strip} data-phase={listenPhase}>
      <span className={styles.micIcon} data-active={listenPhase !== 'off'} aria-hidden>
        🎤
      </span>
      <div className={styles.text}>
        <span className={styles.status}>{statusLine}</span>
        {feedback && <span className={styles.feedback}>{feedback}</span>}
      </div>
      {listenPhase === 'off' && modelStatus !== 'loading' && onResume && (
        <button type="button" className={styles.actionBtn} onClick={onResume}>
          Activar
        </button>
      )}
      {modelStatus === 'error' && onRetry && (
        <button type="button" className={styles.actionBtn} onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}
