import { useCallback, useState, useRef } from 'react';
import styles from './Dashboard.module.css';
import { Speedometer } from './metrics/Speedometer';
import { AlertIndicator } from './metrics/AlertIndicator';
import { StatusBar } from './metrics/StatusBar';
import { CameraFeed } from '../Camera/CameraFeed';

export interface DriverState {
  speed: number;
  fatigueLevel: number;
  isAlertActive: boolean;
  isVoiceListening: boolean;
  isCameraActive: boolean;
}

const initialState: DriverState = {
  speed: 0,
  fatigueLevel: 0,
  isAlertActive: false,
  isVoiceListening: false,
  isCameraActive: false,
};

// ─── Umbral y cooldown ────────────────────────────────────────────────────────
const FATIGUE_ALERT_THRESHOLD = 70;         // % para disparar WhatsApp
const ALERT_COOLDOWN_MS = 5 * 60 * 1000;   // 5 minutos entre mensajes

export function Dashboard() {
  const [state, setState] = useState<DriverState>(initialState);

  // Ref para evitar spam: guarda el timestamp del último mensaje enviado
  const lastAlertSentRef = useRef<number>(0);
  // Ref para saber si ya estamos en estado de alerta activa (evita envíos repetidos
  // mientras la fatiga sigue >70 sin bajar)
  const alertActiveRef = useRef<boolean>(false);

  // ─── WhatsApp alert ──────────────────────────────────────────────────────
  const sendWhatsAppAlert = useCallback(async (nivelFatiga: number) => {
    const ahora = Date.now();
    if (ahora - lastAlertSentRef.current < ALERT_COOLDOWN_MS) return; // cooldown activo

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
        console.log(`[WhatsApp] Alertas enviadas: ${data.enviados}, fallidas: ${data.fallidas}`);
      }
    } catch (err) {
      console.error('[WhatsApp] No se pudo conectar al servidor de alertas:', err);
    }
  }, []);

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleSpeedChange = (speed: number) => {
    setState(prev => ({ ...prev, speed }));
  };

  const handleVoiceToggle = () => {
    setState(prev => ({ ...prev, isVoiceListening: !prev.isVoiceListening }));
  };

  const handleAlertAck = () => {
    // Al reconocer la alerta, reseteamos el estado para permitir
    // que se vuelva a disparar si la fatiga sube de nuevo
    alertActiveRef.current = false;
    setState(prev => ({ ...prev, isAlertActive: false, fatigueLevel: 0 }));
  };

  const handleCameraReady = useCallback(() => {
    setState(prev => ({ ...prev, isCameraActive: true }));
  }, []);

  const handleFatigaChange = useCallback((nuevaFatiga: number) => {
    setState(prev => {
      if (prev.fatigueLevel === nuevaFatiga && (nuevaFatiga <= 55 || prev.isAlertActive)) {
        return prev;
      }
      return {
        ...prev,
        fatigueLevel: nuevaFatiga,
        isAlertActive: nuevaFatiga > 55 ? true : prev.isAlertActive,
      };
    });

    // ── Lógica de alerta WhatsApp ──────────────────────────────────────────
    if (nuevaFatiga >= FATIGUE_ALERT_THRESHOLD) {
      if (!alertActiveRef.current) {
        // Primera vez que cruza el umbral en este evento
        alertActiveRef.current = true;
        sendWhatsAppAlert(nuevaFatiga);
      }
    } else {
      // Fatiga bajó del umbral → permite nuevo disparo en el siguiente evento
      if (alertActiveRef.current) {
        alertActiveRef.current = false;
      }
    }
  }, [sendWhatsAppAlert]);

  // ─── Texto dinámico de estado ─────────────────────────────────────────────
  const getAlertStatusText = () => {
    if (state.fatigueLevel >= FATIGUE_ALERT_THRESHOLD) return '🚨 DISTRAIDO / SOMNOLENCIA';
    if (state.fatigueLevel > 30) return '⚠️ FATIGA LEVE';
    return '🟢 NORMAL';
  };

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <h1 className={styles.title}>Drive Copilot</h1>
        <StatusBar
          isMonitoring={state.isCameraActive}
          isVoiceActive={state.isVoiceListening}
        />
      </header>

      <main className={styles.main}>
        <section className={styles.cameraSection}>
          <CameraFeed
            onReady={handleCameraReady}
            onFatigaChange={handleFatigaChange}
          />
        </section>

        <div className={styles.content}>
          <section className={styles.speedometerSection}>
            <Speedometer
              speed={state.speed}
              onSpeedChange={handleSpeedChange}
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
              <div style={{ marginBottom: '10px', fontWeight: 'bold', fontSize: '1.1rem' }}>
                {getAlertStatusText()}
              </div>
              <AlertIndicator
                isActive={state.isAlertActive}
                onAck={handleAlertAck}
              />
            </div>
          </section>

          <section className={styles.controlsSection}>
            <button
              className={`${styles.voiceButton} ${state.isVoiceListening ? styles.listening : ''}`}
              onClick={handleVoiceToggle}
            >
              <span className={styles.voiceIcon}>
                {state.isVoiceListening ? 'ON' : 'OFF'}
              </span>
              {state.isVoiceListening ? 'Escuchando...' : 'Comando de Voz'}
            </button>
          </section>
        </div>
      </main>

      <footer className={styles.footer}>
        <span className={styles.statusText}></span>
      </footer>
    </div>
  );
}