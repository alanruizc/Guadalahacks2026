import { useEffect } from 'react';
import { alertSoundService } from '../services/alertSound/alertSoundService';

/** Desbloquea audio en el primer gesto del usuario (política autoplay). */
export function useAlertSoundUnlock(): void {
  useEffect(() => {
    const unlock = () => {
      alertSoundService.unlock();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);
}

export function useAlertSound(isActive: boolean, isMuted: boolean): void {
  useEffect(() => {
    if (isActive && !isMuted) {
      alertSoundService.start();
    } else {
      alertSoundService.stop();
    }
    return () => alertSoundService.stop();
  }, [isActive, isMuted]);
}
