import { VOICE_COMMANDS } from '../../services/voice/voiceCommands';
import styles from './VoiceCommandHelp.module.css';

interface VoiceCommandHelpProps {
  engine: 'web' | 'whisper' | null;
}

export function VoiceCommandHelp({ engine }: VoiceCommandHelpProps) {
  return (
    <section className={styles.help} aria-label="Comandos de voz disponibles">
      <h3 className={styles.title}>Comandos de voz</h3>
      <p className={styles.hint}>
        {engine === 'web'
          ? 'Reconocimiento rápido del navegador'
          : engine === 'whisper'
            ? 'Reconocimiento local (puede tardar unos segundos)'
            : 'Activa el micrófono para usar comandos'}
      </p>
      <ul className={styles.list}>
        {VOICE_COMMANDS.filter((c) => c.id !== 'toggle_voice').map((cmd) => (
          <li key={cmd.id} className={styles.item}>
            <span className={styles.label}>{cmd.label}</span>
            <span className={styles.phrase}>«{cmd.phrases[0]}»</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
