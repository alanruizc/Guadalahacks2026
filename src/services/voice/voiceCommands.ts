import type { CannedGestureName } from '../gestures/extractGestures';
import { formatGestureLabel } from '../gestures/gestureLabels';

export type VoiceCommandId =
  | 'toggle_voice'
  | 'ack_alert'
  | 'call_emergency'
  | 'call_contact'
  | 'mute_alerts'
  | 'report_status'
  | 'report_speed'
  | 'calibrate'
  | 'rest_mode';

export interface VoiceCommandDef {
  id: VoiceCommandId;
  label: string;
  phrases: string[];
  gestureName?: CannedGestureName;
}

export const VOICE_COMMANDS: VoiceCommandDef[] = [
  {
    id: 'toggle_voice',
    label: 'Activar / apagar micrófono',
    phrases: ['activar voz', 'desactivar voz', 'apagar microfono', 'encender microfono'],
    gestureName: 'Open_Palm',
  },
  {
    id: 'ack_alert',
    label: 'Confirmar alerta',
    phrases: ['confirmar alerta', 'entendido', 'listo', 'ya vi', 'acuse'],
    gestureName: 'Thumb_Up',
  },
  {
    id: 'rest_mode',
    label: 'Modo descanso',
    phrases: ['modo descanso', 'necesito descansar', 'voy a descansar', 'voy a parar'],
    gestureName: 'Closed_Fist',
  },
  {
    id: 'call_emergency',
    label: 'Llamar emergencias',
    phrases: ['emergencia', 'llama emergencia', 'llama al 911', '911', 'auxilio', 'sos'],
    gestureName: 'ILoveYou',
  },
  {
    id: 'call_contact',
    label: 'Llamar contacto',
    phrases: ['llama a casa', 'llama mi contacto', 'llama a mi contacto', 'llamar contacto'],
  },
  {
    id: 'report_status',
    label: 'Estado de fatiga',
    phrases: ['como estoy', 'estado', 'reporte', 'nivel de fatiga', 'como voy'],
    gestureName: 'Victory',
  },
  {
    id: 'report_speed',
    label: 'Velocidad actual',
    phrases: [
      'a que velocidad voy',
      'que velocidad llevo',
      'cuantos kilometros',
      'mi velocidad',
      'velocidad',
    ],
    gestureName: 'Pointing_Up',
  },
  {
    id: 'mute_alerts',
    label: 'Silenciar / activar alertas',
    phrases: [
      'silenciar alertas',
      'silenciar',
      'sin alertas',
      'apagar alertas',
      'activar alertas',
    ],
    gestureName: 'Thumb_Down',
  },
  {
    id: 'calibrate',
    label: 'Reiniciar fatiga',
    phrases: ['calibrar', 'reiniciar fatiga', 'cero fatiga', 'resetear fatiga'],
  },
];

export interface GestureVoiceMapping {
  commandId: VoiceCommandId;
  gestureName: CannedGestureName;
  gestureLabel: string;
  voicePhrase: string;
  label: string;
}

export const GESTURE_VOICE_MAPPINGS: GestureVoiceMapping[] = VOICE_COMMANDS.filter(
  (cmd): cmd is VoiceCommandDef & { gestureName: CannedGestureName } =>
    Boolean(cmd.gestureName),
).map((cmd) => ({
  commandId: cmd.id,
  gestureName: cmd.gestureName,
  gestureLabel: formatGestureLabel(cmd.gestureName),
  voicePhrase: cmd.phrases[0],
  label: cmd.label,
}));

export const VOICE_ONLY_COMMANDS = VOICE_COMMANDS.filter((cmd) => !cmd.gestureName);

export function getCommandLabel(id: VoiceCommandId): string {
  return VOICE_COMMANDS.find((c) => c.id === id)?.label ?? id;
}

export function getCommandByGesture(gestureName: string): GestureVoiceMapping | null {
  return GESTURE_VOICE_MAPPINGS.find((m) => m.gestureName === gestureName) ?? null;
}

export function formatGestureHint(gestureName: string): string | null {
  const m = getCommandByGesture(gestureName);
  if (!m) return null;
  return `${m.gestureLabel} → ${m.label}`;
}