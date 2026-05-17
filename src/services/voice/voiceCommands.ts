/** Comandos con sentido para un copiloto de seguridad (no controlan el vehículo). */
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
  /** Texto corto para la UI */
  label: string;
  /** Frases que el usuario puede decir */
  phrases: string[];
  /** Gesto MediaPipe asociado, si aplica */
  gestureName?: string;
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

export const GESTURE_COMMAND_MAPPINGS = VOICE_COMMANDS.filter(
  (c): c is VoiceCommandDef & { gestureName: string } => Boolean(c.gestureName),
).map((c) => ({
  commandId: c.id,
  voicePhrase: c.phrases[0],
  gestureName: c.gestureName,
}));

export function getCommandLabel(id: VoiceCommandId): string {
  return VOICE_COMMANDS.find((c) => c.id === id)?.label ?? id;
}
