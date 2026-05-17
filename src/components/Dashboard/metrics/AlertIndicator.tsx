import styles from './AlertIndicator.module.css';

interface AlertIndicatorProps {
  isActive: boolean;
  onAck: () => void;
}

export function AlertIndicator({ isActive, onAck }: AlertIndicatorProps) {
  return (
    <div className={`${styles.container} ${isActive ? styles.active : ''}`}>
      <div className={styles.indicator}>
        <span className={styles.dot} />
        <span className={styles.label}>
          {isActive ? 'ALERTA ACTIVA' : 'NORMAL'}
        </span>
      </div>
      {isActive && <button className={styles.ackButton} onClick={onAck}>OK</button>}
    </div>
  );
}