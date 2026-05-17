import type { DetectedGesture } from './extractGestures';

export type VoiceCommandId =
  | 'toggle_voice'
  | 'ack_alert'
  | 'increase_speed'
  | 'decrease_speed'
  | 'call_emergency'
  | 'call_contact'
  | 'mute_alerts'
  | 'report_status'
  | 'calibrate'
  | 'rest_mode';

export interface GestureCommandMapping {
  commandId: VoiceCommandId;
  voicePhrase: string;
  gestureName: string;
}

// Cada gesto del modelo MediaPipe mapeado a un comando de copiloto
export const GESTURE_COMMAND_MAPPINGS: GestureCommandMapping[] = [
  { commandId: 'toggle_voice',   voicePhrase: 'activar voz',      gestureName: 'Open_Palm'   },
  { commandId: 'ack_alert',      voicePhrase: 'confirmar alerta', gestureName: 'Thumb_Up'    },
  { commandId: 'rest_mode',      voicePhrase: 'modo descanso',    gestureName: 'Closed_Fist' },
  { commandId: 'call_emergency', voicePhrase: 'emergencia',       gestureName: 'ILoveYou'    },
  { commandId: 'report_status',  voicePhrase: 'estado',           gestureName: 'Victory'     },
  { commandId: 'increase_speed', voicePhrase: 'acelerar',         gestureName: 'Pointing_Up' },
  { commandId: 'decrease_speed', voicePhrase: 'frenar',           gestureName: 'Thumb_Down'  },
];

export function resolveGestureCommand(gesture: DetectedGesture): GestureCommandMapping | null {
  return GESTURE_COMMAND_MAPPINGS.find((m) => m.gestureName === gesture.name) ?? null;
}
