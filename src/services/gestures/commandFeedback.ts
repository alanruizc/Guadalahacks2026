import type { VoiceCommandId } from '../voice/voiceCommands';
import { getCommandLabel } from '../voice/voiceCommands';

export interface ActionMessageContext {
  fatigueLevel: number;
  gpsSpeed: number;
  isGpsTracking: boolean;
  gpsStatusLabel: string;
  isMuted: boolean;
}

export function getActionMessage(
  commandId: VoiceCommandId,
  ctx: ActionMessageContext,
): string {
  switch (commandId) {
    case 'ack_alert':
      return 'Alerta confirmada';
    case 'calibrate':
      return 'Fatiga reiniciada';
    case 'rest_mode':
      return 'Modo descanso — detente cuando puedas';
    case 'call_emergency':
      return 'Llamando a emergencias…';
    case 'call_contact':
      return 'Llamando a tu contacto…';
    case 'toggle_voice':
      return 'Micrófono pausado';
    case 'mute_alerts':
      return ctx.isMuted ? 'Alertas activadas' : 'Alertas silenciadas';
    case 'report_speed':
      if (ctx.isGpsTracking) return `Velocidad: ${ctx.gpsSpeed} km/h`;
      return ctx.gpsStatusLabel || 'GPS no disponible';
    case 'report_status': {
      const { fatigueLevel: level, gpsSpeed, isGpsTracking } = ctx;
      const speedPart = isGpsTracking ? ` · ${gpsSpeed} km/h` : '';
      if (level > 60) return `Fatiga crítica: ${level}%${speedPart}`;
      if (level > 30) return `Fatiga leve: ${level}%${speedPart}`;
      return `Estado normal: ${level}%${speedPart}`;
    }
    default:
      return getCommandLabel(commandId);
  }
}
