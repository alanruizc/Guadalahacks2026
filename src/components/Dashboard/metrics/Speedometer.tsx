import styles from './Speedometer.module.css';

interface SpeedometerProps {
  speed: number;
  onSpeedChange: (speed: number) => void;
}

export function Speedometer({ speed, onSpeedChange }: SpeedometerProps) {
  const percentage = Math.min((speed / 180) * 100, 100);
  const rotation = (percentage / 100) * 270 - 135;

  const getSpeedColor = () => {
    if (speed < 60) return '#00d4ff';
    if (speed < 100) return '#ffd93d';
    return '#ff6b6b';
  };

  return (
    <div className={styles.container}>
      <div className={styles.gauge}>
        <svg viewBox="0 0 200 120" className={styles.arc}>
          <circle
            cx="100"
            cy="100"
            r="90"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="8"
            strokeDasharray="424"
            strokeDashoffset="106"
            transform="rotate(135 100 100)"
          />
          <circle
            cx="100"
            cy="100"
            r="90"
            fill="none"
            stroke={getSpeedColor()}
            strokeWidth="8"
            strokeDasharray="424"
            strokeDashoffset={424 - (424 * percentage) / 100}
            transform="rotate(135 100 100)"
            className={styles.progress}
          />
        </svg>
        <div className={styles.needleContainer}>
          <div
            className={styles.needle}
            style={{ transform: `rotate(${rotation}deg)` }}
          />
        </div>
        <div className={styles.center}>
          <span className={styles.speedValue}>{speed}</span>
          <span className={styles.speedUnit}>km/h</span>
        </div>
      </div>
      <input
        type="range"
        min="0"
        max="180"
        value={speed}
        onChange={(e) => onSpeedChange(Number(e.target.value))}
        className={styles.slider}
      />
    </div>
  );
}