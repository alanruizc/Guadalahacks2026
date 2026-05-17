import { useCallback, useState } from 'react';
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
  currentMessage: string | null;
  isCameraActive: boolean;
}

const initialState: DriverState = {
  speed: 0,
  fatigueLevel: 0,
  isAlertActive: false,
  isVoiceListening: false,
  currentMessage: null,
  isCameraActive: false,
};

export function Dashboard() {
  const [state, setState] = useState<DriverState>(initialState);

  const handleSpeedChange = (speed: number) => {
    setState(prev => ({ ...prev, speed }));
  };

  const handleVoiceToggle = () => {
    setState(prev => ({ ...prev, isVoiceListening: !prev.isVoiceListening }));
  };

  const handleAlertAck = () => {
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
  }, []);

  // Función auxiliar para determinar dinámicamente el texto del estado de alerta
  const getAlertStatusText = () => {
    if (state.fatigueLevel > 60) return '🚨 CRÍTICO / SOMNOLENCIA';
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
          {/* CORRECCIÓN 3: Le pasamos el callback al CameraFeed interno para capturar la telemetría */}
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
              {/* CORRECCIÓN 4: Render dinámico del texto de alerta según el porcentaje */}
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

          {state.currentMessage && (
            <section className={styles.messageSection}>
              <div className={styles.messageCard}>
                <span className={styles.messageIcon}>MSG</span>
                <p className={styles.messageText}>{state.currentMessage}</p>
              </div>
            </section>
          )}
        </div>
      </main>

      <footer className={styles.footer}>
        <span className={styles.statusText}></span>
      </footer>
    </div>
  );
}