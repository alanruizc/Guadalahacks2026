import { parseVoiceCommand } from './commandParser';
import type { VoiceCommandId } from '../voice/voiceCommands';

export const WAKE_WORD_LABEL = 'copiloto';

const WAKE_PHRASES = [
  'hey copiloto',
  'oye copiloto',
  'ok copiloto',
  'hola copiloto',
  'co piloto',
  'copiloto',
];

export const COMMAND_ARMED_MS = 8000;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function containsWakeWord(text: string): boolean {
  const n = normalize(text);
  return WAKE_PHRASES.some((p) => n.includes(p));
}

export function stripWakeWord(text: string): string {
  let n = normalize(text);
  for (const phrase of WAKE_PHRASES) {
    n = n.replace(phrase, ' ').trim();
  }
  return n.replace(/\s+/g, ' ').trim();
}

export type CopilotUtteranceResult =
  | { type: 'ignored' }
  | { type: 'wake_only' }
  | { type: 'command'; commandId: VoiceCommandId };

export function processCopilotUtterance(
  text: string,
  isArmed: boolean,
): CopilotUtteranceResult {
  const trimmed = text.trim();
  if (!trimmed) return { type: 'ignored' };

  const hasWake = containsWakeWord(trimmed);
  const afterWake = stripWakeWord(trimmed);

  if (hasWake && afterWake) {
    const commandId = parseVoiceCommand(afterWake);
    if (commandId && commandId !== 'toggle_voice') {
      return { type: 'command', commandId };
    }
  }

  if (isArmed) {
    const commandId = parseVoiceCommand(trimmed);
    if (commandId && commandId !== 'toggle_voice') {
      return { type: 'command', commandId };
    }
    if (hasWake && !afterWake) return { type: 'wake_only' };
    return { type: 'ignored' };
  }

  if (hasWake) {
    if (afterWake) {
      const commandId = parseVoiceCommand(afterWake);
      if (commandId && commandId !== 'toggle_voice') {
        return { type: 'command', commandId };
      }
    }
    return { type: 'wake_only' };
  }

  return { type: 'ignored' };
}
