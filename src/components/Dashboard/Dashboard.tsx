import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './Dashboard.module.css';
import { Speedometer } from './metrics/Speedometer';
import { AlertIndicator } from './metrics/AlertIndicator';
import { CameraFeed } from '../Camera/CameraFeed';
import { VoiceCommandHelp } from './VoiceCommandHelp';
import { VoiceStatusStrip } from './VoiceStatusStrip';
import {
  ActionFeedback,
  type NotificationMessage,
  type NotificationVariant,
} from './ActionFeedback';
import { useVoiceCommand } from '../../hooks/useVoiceCommand';
import { useVehicleSpeed } from '../../hooks/useVehicleSpeed';
import { useAlertSound, useAlertSoundUnlock } from '../../hooks/useAlertSound';
import { alertSoundService } from '../../services/alertSound/alertSoundService';
import { resolveGestureCommand } from '../../services/gestures/gestureCommands';
import { getActionMessage } from '../../services/gestures/commandFeedback';
import type { VoiceCommandId } from '../../services/voice/voiceCommands';
import type { DetectedGesture } from '../../services/gestures/extractGestures';

const EMERGENCY_CONTACT = localStorage.getItem('emergency_contact') ?? '+521234567890';
const CALL_DELAY_MS = 400;
const FEEDBACK_MS = 4500;

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

export function Dashboard() {
  const [state, setState] = useState<DriverState>(initialState);
  const [helpOpen, setHelpOpen] = useState(false);
  const [feedback, setFeedback] = useState<NotificationMessage | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    speed: gpsSpeed,
    status: gpsStatus,
    statusLabel: gpsStatusLabel,
    isTracking: isGpsTracking,
    retry: retryGps,
  } = useVehicleSpeed();

  const voiceRef = useRef({ isListening: false, start: async () => {}, stop: () => {} });
  const stateRef = useRef(state);
  stateRef.current = state;

  // ─── WhatsApp refs ──────────────────────────────────────────────────────────
  const lastAlertSentRef = useRef<number>(0);
  const alertActiveRef = useRef<boolean>(false);

  useAlertSoundUnlock();
  useAlertSound(state.isAlertActive, state.isMuted);

  const showFeedback = useCallback((text: string, variant: NotificationVariant = 'info') => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setFeedback({ text, variant });
    feedbackTimerRef.current = setTimeout(() => {
      setFeedback(null);
      feedbackTimerRef.current = null;
    }, FEEDBACK_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

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
        showFeedback(`📱 Alerta enviada a ${data.enviados} contacto(s)`, 'warning');
      }
    } catch (err) {
      console.error('[WhatsApp] No se pudo conectar al servidor de alertas:', err);
    }
  }, [showFeedback]);

  const buildActionContext = useCallback(
    () => ({
      fatigueLevel: stateRef.current.fatigueLevel,
      gpsSpeed,
      isGpsTracking,
      gpsStatusLabel,
      isMuted: stateRef.current.isMuted,
    }),
    [gpsSpeed, gpsStatusLabel, isGpsTracking],
  );

  const executeCommand = useCallback(
    (commandId: VoiceCommandId) => {
      const ctx = buildActionContext();

      if (commandId === 'toggle_voice') {
        const v = voiceRef.current;
        if (v.isListening) {
          v.stop();
          showFeedback('Micrófono pausado', 'info');
        } else {
          void v.start();
          showFeedback('Micrófono activo', 'info');
        }
        return;
      }

      if (commandId === 'mute_alerts') {
        const nextMuted = !stateRef.current.isMuted;
        if (nextMuted) alertSoundService.stop();
        setState((prev) => ({ ...prev, isMuted: nextMuted }));
        showFeedback(
          getActionMessage('mute_alerts', { ...ctx, isMuted: !nextMuted }),
          nextMuted ? 'warning' : 'success',
        );
        return;
      }

      if (commandId === 'ack_alert' || commandId === 'calibrate') {
        alertSoundService.stop();
        alertActiveRef.current = false;
        setState((prev) => ({ ...prev, isAlertActive: false, fatigueLevel: 0 }));
        showFeedback(getActionMessage(commandId, { ...ctx, fatigueLevel: 0 }), 'success');
        return;
      }

      if (commandId === 'rest_mode') {
        setState((prev) => ({ ...prev, isAlertActive: true }));
        showFeedback(getActionMessage('rest_mode', ctx), 'warning');
        return;
      }

      if (commandId === 'report_status' || commandId === 'report_speed') {
        showFeedback(getActionMessage(commandId, ctx), 'info');
        return;
      }

      if (commandId === 'call_emergency') {
        showFeedback(getActionMessage('call_emergency', ctx), 'warning');
        setTimeout(() => { window.location.href = 'tel:911'; }, CALL_DELAY_MS);
        return;
      }

      if (commandId === 'call_contact') {
        showFeedback(getActionMessage('call_contact', ctx), 'warning');
        setTimeout(() => { window.location.href = `tel:${EMERGENCY_CONTACT}`; }, CALL_DELAY_MS);
      }
    },
    [buildActionContext, showFeedback],
  );

  const voice = useVoiceCommand({ onCommand: executeCommand, autoStart: true });

  voiceRef.current = { isListening: voice.isListening, start: voice.start, stop: voice.stop };

  const handleResetFatigue = () => executeCommand('calibrate');
  const handleAlertAck = () => executeCommand('ack_alert');

  const handleCameraReady = useCallback(() => {
    setState((prev) => ({ ...prev, isCameraActive: true }));
  }, []);

  const handleFatigaChange = useCallback((nuevaFatiga: number) => {
    setState((prev) => {
      if (prev.fatigueLevel === nuevaFatiga && (nuevaFatiga <= 55 || prev.isAlertActive)) return prev;
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

  const getAlertStatusText = () => {
    if (state.fatigueLevel > 60) return 'Somnolencia';
    if (state.fatigueLevel > 30) return 'Fatiga leve';
    return 'Normal';
  };

  const alertLevel = state.fatigueLevel > 60 ? 'critical' : state.fatigueLevel > 30 ? 'warning' : 'ok';

  const voiceFeedback =
    voice.lastFeedback ||
    (voice.lastCommandId ? '' : voice.lastTranscript ? voice.lastTranscript : '');

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <div className={styles.headerBrand}>
          <h1 className={styles.title}>Copiloto</h1>
          <p className={styles.subtitle}>Asistente de seguridad al volante</p>
        </div>
        <div className={styles.headerNotification}>
          <ActionFeedback message={feedback} />
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.cameraColumn}>
          <CameraFeed
            onReady={handleCameraReady}
            onFatigaChange={handleFatigaChange}
            onGestureConfirmed={handleGestureConfirmed}
          />
        </section>

        <aside className={styles.sidePanel}>
          <div className={styles.statsGrid}>
            <Speedometer
              speed={gpsSpeed}
              gpsStatus={gpsStatus}
              gpsStatusLabel={gpsStatusLabel}
              onRetryGps={retryGps}
            />

            <article className={`${styles.metricCard} ${styles.fatigueCard}`}>
              <div className={styles.metricCardHeader}>
                <h3 className={styles.metricTitle}>Fatiga</h3>
                <button
                  type="button"
                  className={styles.resetBtn}
                  onClick={handleResetFatigue}
                  title="Reiniciar nivel de fatiga"
                >
                  Reiniciar
                </button>
              </div>
              <div className={styles.fatigueRow}>
                <span className={styles.metricValue}>{state.fatigueLevel}%</span>
                <div className={styles.fatigueBar}>
                  <div
                    className={styles.fatigueFill}
                    style={{ width: `${state.fatigueLevel}%` }}
                    data-level={alertLevel}
                  />
                </div>
              </div>
            </article>

            <article className={`${styles.metricCard} ${styles.alertCard}`}>
              <h3 className={styles.metricTitle}>Alerta</h3>
              <p className={styles.alertStatus} data-level={alertLevel}>
                {getAlertStatusText()}
              </p>
              <AlertIndicator isActive={state.isAlertActive} onAck={handleAlertAck} />
            </article>
          </div>

          <VoiceStatusStrip
            listenPhase={voice.listenPhase}
            modelStatus={voice.modelStatus}
            modelProgress={voice.modelProgress}
            feedback={voiceFeedback}
            onResume={voice.listenPhase === 'off' ? () => void voice.start() : undefined}
            onRetry={voice.modelStatus === 'error' ? voice.retryModel : undefined}
          />

          <details
            className={styles.helpDetails}
            open={helpOpen}
            onToggle={(e) => setHelpOpen(e.currentTarget.open)}
          >
            <summary className={styles.helpSummary}>Comandos de voz y gestos</summary>
            <VoiceCommandHelp engine={voice.engine} />
          </details>
        </aside>
      </main>
    </div>
  );
}