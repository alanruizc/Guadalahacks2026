import type { DetectedGesture } from './extractGestures';

/**
 * Comandos de voz planeados y su variante por gesto (fase 2).
 * Por ahora solo define el mapa; la ejecución se conectará con el módulo de voz.
 */
export type VoiceCommandId =
  | 'toggle_voice'
  | 'ack_alert'
  | 'increase_speed'
  | 'decrease_speed';

export interface GestureCommandMapping {
  commandId: VoiceCommandId;
  voicePhrase: string;
  gestureName: string;
}

export const GESTURE_COMMAND_MAPPINGS: GestureCommandMapping[] = [
  { commandId: 'toggle_voice', voicePhrase: 'activar voz', gestureName: 'Open_Palm' },
  { commandId: 'ack_alert', voicePhrase: 'confirmar alerta', gestureName: 'Thumb_Up' },
  { commandId: 'increase_speed', voicePhrase: 'acelerar', gestureName: 'Pointing_Up' },
  { commandId: 'decrease_speed', voicePhrase: 'frenar', gestureName: 'Thumb_Down' },
];

export function resolveGestureCommand(gesture: DetectedGesture): GestureCommandMapping | null {
  return (
    GESTURE_COMMAND_MAPPINGS.find((mapping) => mapping.gestureName === gesture.name) ?? null
  );
}
