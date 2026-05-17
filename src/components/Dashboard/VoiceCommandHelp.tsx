import { WAKE_WORD_LABEL } from '../../services/speechRecognition/wakeWord';
import {
  GESTURE_VOICE_MAPPINGS,
  VOICE_ONLY_COMMANDS,
} from '../../services/voice/voiceCommands';
import styles from './VoiceCommandHelp.module.css';

interface VoiceCommandHelpProps {
  engine: 'web' | 'whisper' | null;
}

export function VoiceCommandHelp({ engine }: VoiceCommandHelpProps) {
  return (
    <section className={styles.help} aria-label="Comandos del copiloto">
      <p className={styles.wakeWord}>
        Di <strong>«{WAKE_WORD_LABEL}»</strong> + comando — ej. <em>«{WAKE_WORD_LABEL} estado»</em>
      </p>
      <p className={styles.hint}>
        {engine === 'web'
          ? 'Micrófono siempre activo · reconocimiento del navegador'
          : engine === 'whisper'
            ? 'Micrófono siempre activo · reconocimiento local'
            : 'Preparando micrófono…'}
        {' · '}
        Gesto ~1 s frente a la cámara
      </p>

      <ul className={styles.list}>
        {GESTURE_VOICE_MAPPINGS.filter((m) => m.commandId !== 'toggle_voice').map((m) => (
          <li key={m.commandId} className={styles.item}>
            <span className={styles.label}>{m.label}</span>
            <div className={styles.equiv}>
              <span className={styles.gesture}>✋ {m.gestureLabel}</span>
              <span className={styles.sep}>=</span>
              <span className={styles.phrase}>«{m.voicePhrase}»</span>
            </div>
          </li>
        ))}
      </ul>

      {VOICE_ONLY_COMMANDS.length > 0 && (
        <>
          <h4 className={styles.subtitle}>Solo voz</h4>
          <ul className={styles.list}>
            {VOICE_ONLY_COMMANDS.map((cmd) => (
              <li key={cmd.id} className={styles.item}>
                <span className={styles.label}>{cmd.label}</span>
                <span className={styles.phrase}>«{cmd.phrases[0]}»</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
