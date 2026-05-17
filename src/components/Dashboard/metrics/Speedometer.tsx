import styles from './Speedometer.module.css';
import type { VehicleSpeedStatus } from '../../../hooks/useVehicleSpeed';

interface SpeedometerProps {
  speed: number;
  gpsStatus: VehicleSpeedStatus;
  gpsStatusLabel: string;
  onRetryGps?: () => void;
}

export function Speedometer({
  speed,
  gpsStatus,
  gpsStatusLabel,
  onRetryGps,
}: SpeedometerProps) {
  const percentage = Math.min((speed / 180) * 100, 100);
  const rotation = (percentage / 100) * 270 - 135;

  const getSpeedColor = () => {
    if (speed < 60) return '#00d4ff';
    if (speed < 100) return '#ffd93d';
    return '#ff6b6b';
  };

  const canRetry =
    onRetryGps &&
    (gpsStatus === 'denied' || gpsStatus === 'unavailable' || gpsStatus === 'error');

  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <h3 className={styles.title}>Velocidad</h3>
        {gpsStatusLabel && (
          <button
            type="button"
            className={styles.gpsPill}
            data-status={gpsStatus}
            onClick={canRetry ? onRetryGps : undefined}
            disabled={!canRetry}
            title={gpsStatusLabel}
          >
            <span className={styles.gpsDot} data-active={gpsStatus === 'tracking'} />
            <span className={styles.gpsLabel}>{gpsStatusLabel}</span>
          </button>
        )}
      </header>

      <div className={styles.body}>
        <div className={styles.readout}>
          <span className={styles.speedValue} style={{ color: getSpeedColor() }}>
            {speed}
          </span>
          <span className={styles.speedUnit}>km/h</span>
        </div>

        <div className={styles.miniGauge} aria-hidden>
          <svg viewBox="0 0 100 60" className={styles.arc}>
            <path
              d="M 12 52 A 38 38 0 0 1 88 52"
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <path
              d="M 12 52 A 38 38 0 0 1 88 52"
              fill="none"
              stroke={getSpeedColor()}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray="120"
              strokeDashoffset={120 - (120 * percentage) / 100}
              className={styles.progress}
            />
          </svg>
          <div
            className={styles.needle}
            style={{ transform: `rotate(${rotation}deg)` }}
          />
        </div>
      </div>
    </article>
  );
}