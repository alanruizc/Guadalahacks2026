import type { VoiceListenPhase } from '../../../hooks/useVoiceCommand';
import type { VehicleSpeedStatus } from '../../../hooks/useVehicleSpeed';
import styles from './StatusBar.module.css';

interface StatusBarProps {
  isMonitoring: boolean;
  listenPhase: VoiceListenPhase;
  gpsStatus: VehicleSpeedStatus;
  isModelLoading?: boolean;
}

export function StatusBar({
  isMonitoring,
  listenPhase,
  gpsStatus,
  isModelLoading,
}: StatusBarProps) {
  const micOn = listenPhase === 'wake' || listenPhase === 'armed';
  const gpsOn = gpsStatus === 'tracking';

  return (
    <div className={styles.container}>
      <div className={styles.item}>
        <span className={`${styles.dot} ${isMonitoring ? styles.on : ''}`} />
        <span className={styles.label}>Cámara</span>
      </div>
      <div className={styles.item}>
        <span
          className={`${styles.dot} ${micOn ? styles.on : ''} ${listenPhase === 'armed' ? styles.armed : ''}`}
        />
        <span className={styles.label}>
          {isModelLoading ? 'Voz…' : micOn ? (listenPhase === 'armed' ? 'Escuchando' : 'Activo') : 'Mic'}
        </span>
      </div>
      <div className={styles.item}>
        <span className={`${styles.dot} ${gpsOn ? styles.on : ''}`} data-status={gpsStatus} />
        <span className={styles.label}>
          {gpsStatus === 'tracking'
            ? 'GPS'
            : gpsStatus === 'requesting'
              ? 'GPS…'
              : gpsStatus === 'denied'
                ? 'Sin GPS'
                : 'GPS'}
        </span>
      </div>
    </div>
  );
}
