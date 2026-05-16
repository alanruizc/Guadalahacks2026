import { useState } from 'react';
import styles from './Dashboard.module.css';
import { Speedometer } from './metrics/Speedometer';
import { AlertIndicator } from './metrics/AlertIndicator';
import { StatusBar } from './metrics/StatusBar';

export interface DriverState {
  speed: number;
  fatigueLevel: number;
  isAlertActive: boolean;
  isVoiceListening: boolean;
  currentMessage: string | null;
}

const initialState: DriverState = {
  speed: 0,
  fatigueLevel: 0,
  isAlertActive: false,
  isVoiceListening: false,
  currentMessage: null,
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

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <h1 className={styles.title}>Drive Copilot</h1>
        <StatusBar
          isMonitoring={true}
          isVoiceActive={state.isVoiceListening}
        />
      </header>

      <main className={styles.main}>
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
      </main>

      <footer className={styles.footer}>
        <span className={styles.statusText}></span>
      </footer>
    </div>
  );
}