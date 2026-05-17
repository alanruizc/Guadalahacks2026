import { useCallback, useRef, useState } from 'react';
import styles from './Dashboard.module.css';
import { Speedometer } from './metrics/Speedometer';
import { AlertIndicator } from './metrics/AlertIndicator';
import { StatusBar } from './metrics/StatusBar';
import { CameraFeed } from '../Camera/CameraFeed';
import { VoiceCommandHelp } from './VoiceCommandHelp';
import { useVoiceCommand } from '../../hooks/useVoiceCommand';
import { useVehicleSpeed } from '../../hooks/useVehicleSpeed';
import { useAlertSound, useAlertSoundUnlock } from '../../hooks/useAlertSound';
import { alertSoundService } from '../../services/alertSound/alertSoundService';
import { resolveGestureCommand } from '../../services/gestures/gestureCommands';
import type { VoiceCommandId } from '../../services/gestures/gestureCommands';
import type { DetectedGesture } from '../../services/gestures/extractGestures';

const EMERGENCY_CONTACT = localStorage.getItem('emergency_contact') ?? '+521234567890';

// ─── WhatsApp alert config ────────────────────────────────────────────────────
const FATIGUE_ALERT_THRESHOLD = 70;
const ALERT_COOLDOWN_MS = 5 * 60 * 1000;

interface DriverState {
  fatigueLevel: number;
  isAlertActive: boolean;
  isCameraActive: boolean;
  isMuted: boolean;
}

const initialState: DriverState = {
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

  const voiceRef = useRef({ isListening: false, start: async () => {}, stop: () => {} });

  // ─── WhatsApp refs ──────────────────────────────────────────────────────────
  const lastAlertSentRef = useRef<number>(0);
  const alertActiveRef = useRef<boolean>(false);

  useAlertSoundUnlock();
  useAlertSound(state.isAlertActive, state.isMuted);

  // ─── WhatsApp send ──────────────────────────────────────────────────────────
  const sendWhatsAppAlert = useCallback(async (nivelFatiga: number) => {
    const ahora = Date.now();
    if (ahora - lastAlertSentRef.current < ALERT_COOLDOWN_MS) return;

    lastAlertSentRef.current = ahora;

    try {
      const res = await fetch('http://localhost:3001/send-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nivelFatiga }),
      });

      if (!res.ok) {
        console.error('[WhatsApp] Error en servidor:', await res.text());
      } else {
        const data = await res.json();
        console.log(`[WhatsApp] Enviados: ${data.enviados}, Fallidos: ${data.fallidos}`);
      }
    } catch (err) {
      console.error('[WhatsApp] No se pudo conectar al servidor de alertas:', err);
    }
  }, []);

  // ─── Commands ───────────────────────────────────────────────────────────────
  const executeCommand = useCallback(
    (commandId: VoiceCommandId) => {
      if (commandId === 'toggle_voice') {
        const v = voiceRef.current;
        if (v.isListening) {
          v.stop();
          speak('Micrófono apagado');
        } else {
          void v.start();
          speak('Escuchando comandos');
        }
        return;
      }

      setState((prev) => {
        switch (commandId) {
          case 'ack_alert':
            alertSoundService.stop();
            alertActiveRef.current = false;
            speak('Alerta confirmada');
            return { ...prev, isAlertActive: false, fatigueLevel: 0 };

          case 'calibrate':
            alertSoundService.stop();
            alertActiveRef.current = false;
            speak('Fatiga reiniciada a cero');
            return { ...prev, fatigueLevel: 0, isAlertActive: false };

          case 'rest_mode':
            speak('Modo descanso. Detente en un lugar seguro cuando puedas.');
            return { ...prev, isAlertActive: true };

          case 'mute_alerts': {
            const nextMuted = !prev.isMuted;
            if (nextMuted) alertSoundService.stop();
            speak(nextMuted ? 'Alertas silenciadas' : 'Alertas activadas');
            return { ...prev, isMuted: nextMuted };
          }

          default:
            return prev;
        }
      });

      if (commandId === 'report_status') {
        setState((prev) => {
          const level = prev.fatigueLevel;
          const speedPart = isGpsTracking ? ` Vas a ${gpsSpeed} kilómetros por hora.` : '';
          const msg =
            level > 60
              ? `Nivel de fatiga crítico: ${level} por ciento. Detente a descansar.${speedPart}`
              : level > 30
                ? `Fatiga leve: ${level} por ciento. Mantente alerta.${speedPart}`
                : `Estado normal: ${level} por ciento de fatiga.${speedPart}`;
          speak(msg);
          return prev;
        });
      }

      if (commandId === 'report_speed') {
        if (isGpsTracking) {
          speak(`Llevas ${gpsSpeed} kilómetros por hora`);
        } else {
          speak(
            gpsStatus === 'denied'
              ? 'No tengo ubicación. Activa el permiso GPS para leer tu velocidad.'
              : 'Esperando señal GPS. Intenta de nuevo en un momento.',
          );
        }
      }

      if (commandId === 'call_emergency') {
        speak('Llamando a emergencias');
        setTimeout(() => { window.location.href = 'tel:911'; }, 1200);
      }

      if (commandId === 'call_contact') {
        speak('Llamando a tu contacto');
        setTimeout(() => { window.location.href = `tel:${EMERGENCY_CONTACT}`; }, 1200);
      }
    },
    [gpsSpeed, gpsStatus, isGpsTracking],
  );

  const voice = useVoiceCommand(executeCommand);
  voiceRef.current = {
    isListening: voice.isListening,
    start: voice.start,
    stop: voice.stop,
  };

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const handleVoiceToggle = () => {
    alertSoundService.unlock();
    if (voice.modelStatus === 'error') { voice.retryModel(); return; }
    if (voice.isListening) { voice.stop(); } else { void voice.start(); }
  };

  const handleAlertAck = () => {
    alertSoundService.stop();
    alertActiveRef.current = false;
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

    // ── WhatsApp alert ────────────────────────────────────────────────────────
    if (nuevaFatiga >= FATIGUE_ALERT_THRESHOLD) {
      if (!alertActiveRef.current) {
        alertActiveRef.current = true;
        void sendWhatsAppAlert(nuevaFatiga);
      }
    } else {
      alertActiveRef.current = false;
    }
  }, [sendWhatsAppAlert]);

  const handleGestureConfirmed = useCallback(
    (gesture: DetectedGesture) => {
      const mapping = resolveGestureCommand(gesture);
      if (mapping) executeCommand(mapping.commandId);
    },
    [executeCommand],
  );

  // ─── UI helpers ──────────────────────────────────────────────────────────────
  const getAlertStatusText = () => {
    if (state.fatigueLevel > 60) return 'DISTRAIDO / SOMNOLENCIA';
    if (state.fatigueLevel > 30) return 'FATIGA LEVE';
    return 'NORMAL';
  };

  const getVoiceButtonLabel = () => {
    if (voice.modelStatus === 'loading') {
      return `Cargando modelo${voice.modelProgress > 0 ? ` ${voice.modelProgress}%` : '...'}`;
    }
    if (voice.modelStatus === 'error') return 'Error — toca para reintentar';
    if (voice.isListening) return 'Escuchando...';
    return 'Comando de Voz';
  };

  const feedbackText =
    voice.lastFeedback ||
    (voice.lastTranscript && !voice.lastCommandId ? voice.lastTranscript : '');

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <h1 className={styles.title}>Drive Copilot</h1>
        <StatusBar isMonitoring={state.isCameraActive} isVoiceActive={voice.isListening} />
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
              speed={gpsSpeed}
              gpsStatus={gpsStatus}
              gpsStatusLabel={gpsStatusLabel}
              onRetryGps={retryGps}
            />
          </section>

          <section className={styles.metricsSection}>
            <div className={styles.metricCard}>
              <h3 className={styles.metricTitle}>Nivel de Fatiga</h3>
              <div className={styles.fatigueBar}>
                <div className={styles.fatigueFill} style={{ width: `${state.fatigueLevel}%` }} />
              </div>
              <span className={styles.metricValue}>{state.fatigueLevel}%</span>
            </div>

            <div className={styles.metricCard}>
              <h3 className={styles.metricTitle}>Estado de Alerta</h3>
              <div
                className={styles.alertStatus}
                data-level={
                  state.fatigueLevel > 60 ? 'critical' : state.fatigueLevel > 30 ? 'warning' : 'ok'
                }
              >
                {getAlertStatusText()}
              </div>
              <AlertIndicator isActive={state.isAlertActive} onAck={handleAlertAck} />
            </div>
          </section>

          <VoiceCommandHelp engine={voice.engine} />

          {feedbackText && (
            <section className={styles.messageSection}>
              <div
                className={styles.messageCard}
                data-kind={voice.lastCommandId ? 'ok' : voice.lastTranscript ? 'unknown' : 'info'}
              >
                <span className={styles.messageIcon}>
                  {voice.lastCommandId ? '✓' : voice.lastTranscript ? '?' : '🎙'}
                </span>
                <p className={styles.messageText}>{feedbackText}</p>
              </div>
            </section>
          )}

          <section className={styles.controlsSection}>
            <button
              type="button"
              className={`${styles.voiceButton} ${voice.isListening ? styles.listening : ''} ${state.isMuted ? styles.muted : ''}`}
              onClick={handleVoiceToggle}
              disabled={voice.modelStatus === 'loading' || voice.modelStatus === 'idle'}
            >
              <span className={styles.voiceIcon}>
                {voice.modelStatus === 'loading' ? '⏳' : voice.isListening ? '●' : '○'}
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