import type { VoiceCommandId } from '../gestures/gestureCommands';

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

const COMMAND_PATTERNS: { commandId: VoiceCommandId; patterns: string[] }[] = [
  {
    commandId: 'ack_alert',
    patterns: ['confirmar', 'entendido', 'listo', 'acepto', 'confirmo', 'acuse'],
  },
  {
    commandId: 'call_emergency',
    patterns: ['emergencia', '911', 'auxilio', 'sos', 'llama emergencia', 'llama al 911'],
  },
  {
    commandId: 'call_contact',
    patterns: ['llama a casa', 'llama mi contacto', 'llama a mi contacto', 'llamar contacto'],
  },
  {
    commandId: 'mute_alerts',
    patterns: ['silenciar', 'silencio', 'sin alertas', 'apagar alertas', 'mute'],
  },
  {
    commandId: 'report_status',
    patterns: ['como estoy', 'estado', 'reporte', 'nivel de fatiga', 'cuanto tengo'],
  },
  {
    commandId: 'calibrate',
    patterns: ['calibrar', 'reiniciar', 'resetear', 'cero fatiga', 'reset'],
  },
  {
    commandId: 'rest_mode',
    patterns: ['voy a parar', 'modo descanso', 'necesito descansar', 'voy a descansar', 'parar'],
  },
  {
    commandId: 'toggle_voice',
    patterns: ['activar voz', 'desactivar voz', 'apagar microfono', 'encender microfono'],
  },
];

export function parseVoiceCommand(transcript: string): VoiceCommandId | null {
  const normalized = normalize(transcript);
  for (const { commandId, patterns } of COMMAND_PATTERNS) {
    if (patterns.some((p) => normalized.includes(normalize(p)))) {
      return commandId;
    }
  }
  return null;
}
