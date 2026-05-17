import { useCallback, useState } from 'react';
import styles from './Dashboard.module.css';
import { Speedometer } from './metrics/Speedometer';
import { AlertIndicator } from './metrics/AlertIndicator';
import { StatusBar } from './metrics/StatusBar';
import { CameraFeed } from '../Camera/CameraFeed';
import { useVoiceCommand } from '../../hooks/useVoiceCommand';
import { useVehicleSpeed } from '../../hooks/useVehicleSpeed';
import { resolveGestureCommand } from '../../services/gestures/gestureCommands';
import type { VoiceCommandId } from '../../services/gestures/gestureCommands';
import type { DetectedGesture } from '../../services/gestures/extractGestures';

const EMERGENCY_CONTACT = localStorage.getItem('emergency_contact') ?? '+521234567890';

interface DriverState {
  fallbackSpeed: number;
  fatigueLevel: number;
  isAlertActive: boolean;
  isCameraActive: boolean;
  isMuted: boolean;
}

const initialState: DriverState = {
  fallbackSpeed: 0,
  fatigueLevel: 0,
  isAlertActive: false,
  isCameraActive: false,
  isMuted: false,
};

function speak(text: string): void {
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'es-MX';
  window.speechSynthesis.speak(utter);
}

export function Dashboard() {
  const [state, setState] = useState<DriverState>(initialState);
  const {
    speed: gpsSpeed,
    status: gpsStatus,
    statusLabel: gpsStatusLabel,
    isTracking: isGpsTracking,
    retry: retryGps,
  } = useVehicleSpeed();

  const displaySpeed = isGpsTracking ? gpsSpeed : state.fallbackSpeed;

  const executeCommand = useCallback((commandId: VoiceCommandId) => {
    setState((prev) => {
      switch (commandId) {
        case 'ack_alert':
          speak('Alerta confirmada');
          return { ...prev, isAlertActive: false, fatigueLevel: 0 };

        case 'calibrate':
          speak('Fatiga reiniciada a cero');
          return { ...prev, fatigueLevel: 0, isAlertActive: false };

        case 'rest_mode':
          speak('Modo descanso. Detente en un lugar seguro.');
          return { ...prev, isAlertActive: true };

        case 'mute_alerts': {
          const nextMuted = !prev.isMuted;
          speak(nextMuted ? 'Alertas silenciadas' : 'Alertas activadas');
          return { ...prev, isMuted: nextMuted };
        }

        case 'increase_speed':
          if (isGpsTracking) return prev;
          return { ...prev, fallbackSpeed: Math.min(prev.fallbackSpeed + 10, 220) };

        case 'decrease_speed':
          if (isGpsTracking) return prev;
          return { ...prev, fallbackSpeed: Math.max(prev.fallbackSpeed - 10, 0) };

        // report_status y las llamadas no modifican el estado; se manejan fuera
        default:
          return prev;
      }
    });

    if (commandId === 'report_status') {
      setState((prev) => {
        const level = prev.fatigueLevel;
        const msg =
          level > 60
            ? `Nivel de fatiga crítico: ${level} por ciento. Detente a descansar.`
            : level > 30
              ? `Fatiga leve: ${level} por ciento. Mantente alerta.`
              : `Estado normal: ${level} por ciento de fatiga.`;
        speak(msg);
        return prev;
      });
    }

    if (commandId === 'call_emergency') {
      speak('Llamando a emergencias');
      setTimeout(() => { window.location.href = 'tel:911'; }, 1200);
    }

    if (commandId === 'call_contact') {
      speak('Llamando a tu contacto');
      setTimeout(() => { window.location.href = `tel:${EMERGENCY_CONTACT}`; }, 1200);
    }
  }, [isGpsTracking]);

  const { isListening, modelStatus, modelProgress, lastTranscript, start, stop, retryModel } =
    useVoiceCommand(executeCommand);

  const handleVoiceToggle = () => {
    if (modelStatus === 'error') {
      retryModel();
      return;
    }
    if (isListening) {
      stop();
    } else {
      void start();
    }
  };

  const handleAlertAck = () => {
    setState((prev) => ({ ...prev, isAlertActive: false, fatigueLevel: 0 }));
  };

  const handleCameraReady = useCallback(() => {
    setState((prev) => ({ ...prev, isCameraActive: true }));
  }, []);

  const handleFatigaChange = useCallback((nuevaFatiga: number) => {
    setState((prev) => {
      if (prev.fatigueLevel === nuevaFatiga && (nuevaFatiga <= 55 || prev.isAlertActive)) {
        return prev;
      }
      return {
        ...prev,
        fatigueLevel: nuevaFatiga,
        isAlertActive: nuevaFatiga > 55 && !prev.isMuted ? true : prev.isAlertActive,
      };
    });
  }, []);

  const handleGestureConfirmed = useCallback(
    (gesture: DetectedGesture) => {
      const mapping = resolveGestureCommand(gesture);
      if (mapping) executeCommand(mapping.commandId);
    },
    [executeCommand],
  );

  const getAlertStatusText = () => {
    if (state.fatigueLevel > 60) return 'DISTRAIDO / SOMNOLENCIA';
    if (state.fatigueLevel > 30) return 'FATIGA LEVE';
    return 'NORMAL';
  };

  const getVoiceButtonLabel = () => {
    if (modelStatus === 'loading') return `Cargando modelo${modelProgress > 0 ? ` ${modelProgress}%` : '...'}`;
    if (modelStatus === 'error') return 'Error — toca para reintentar';
    if (isListening) return 'Escuchando...';
    return 'Comando de Voz';
  };

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <h1 className={styles.title}>Drive Copilot</h1>
        <StatusBar isMonitoring={state.isCameraActive} isVoiceActive={isListening} />
      </header>

      <main className={styles.main}>
        <section className={styles.cameraSection}>
          <CameraFeed
            onReady={handleCameraReady}
            onFatigaChange={handleFatigaChange}
            onGestureConfirmed={handleGestureConfirmed}
          />
        </section>

        <div className={styles.content}>
          <section className={styles.speedometerSection}>
            <Speedometer
              speed={displaySpeed}
              gpsStatus={gpsStatus}
              gpsStatusLabel={gpsStatusLabel}
              onRetryGps={retryGps}
            />
          </section>

          <section className={styles.metricsSection}>
            <div className={styles.metricCard}>
              <h3 className={styles.metricTitle}>Nivel de Fatiga</h3>
              <div className={styles.fatigueBar}>
                <div
                  className={styles.fatigueFill}
                  style={{ width: `${state.fatigueLevel}%` }}
                />
              </div>
              <span className={styles.metricValue}>{state.fatigueLevel}%</span>
            </div>

            <div className={styles.metricCard}>
              <h3 className={styles.metricTitle}>Estado de Alerta</h3>
              <div className={styles.alertStatus} data-level={
                state.fatigueLevel > 60 ? 'critical' :
                state.fatigueLevel > 30 ? 'warning' : 'ok'
              }>
                {getAlertStatusText()}
              </div>
              <AlertIndicator isActive={state.isAlertActive} onAck={handleAlertAck} />
            </div>
          </section>

          {lastTranscript && (
            <section className={styles.messageSection}>
              <div className={styles.messageCard}>
                <span className={styles.messageIcon}>🎙</span>
                <p className={styles.messageText}>{lastTranscript}</p>
              </div>
            </section>
          )}

          <section className={styles.controlsSection}>
            <button
              className={`${styles.voiceButton} ${isListening ? styles.listening : ''} ${state.isMuted ? styles.muted : ''}`}
              onClick={handleVoiceToggle}
              disabled={modelStatus === 'loading' || modelStatus === 'idle'}
            >
              <span className={styles.voiceIcon}>
                {modelStatus === 'loading' ? '⏳' : isListening ? '●' : '○'}
              </span>
              {getVoiceButtonLabel()}
            </button>
          </section>
        </div>
      </main>

      <footer className={styles.footer}>
        <span className={styles.statusText} />
      </footer>
    </div>
  );
}
