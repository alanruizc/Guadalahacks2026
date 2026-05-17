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

      {gpsStatusLabel && (
        <div
          className={styles.gpsStatus}
          data-status={gpsStatus}
          role={canRetry ? 'button' : undefined}
          tabIndex={canRetry ? 0 : undefined}
          onClick={canRetry ? onRetryGps : undefined}
          onKeyDown={
            canRetry
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onRetryGps?.();
                  }
                }
              : undefined
          }
        >
          <span
            className={styles.gpsDot}
            data-active={gpsStatus === 'tracking'}
            aria-hidden
          />
          <span className={styles.gpsLabel}>
            {gpsStatusLabel}
            {canRetry ? ' · Toca para reintentar' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
