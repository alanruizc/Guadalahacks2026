import styles from './StatusBar.module.css';

interface StatusBarProps {
  isMonitoring: boolean;
  isVoiceActive: boolean;
}

export function StatusBar({ isMonitoring, isVoiceActive }: StatusBarProps) {
  return (
    <div className={styles.container}>
      <div className={styles.item}>
        <span className={`${styles.dot} ${isMonitoring ? styles.on : ''}`} />
        <span className={styles.label}>Camera</span>
      </div>
      <div className={styles.item}>
        <span className={`${styles.dot} ${isVoiceActive ? styles.on : ''}`} />
        <span className={styles.label}>Mic</span>
      </div>
      <div className={styles.item}>
        <span className={styles.dot} />
        <span className={styles.label}>AI</span>
      </div>
    </div>
  );
}