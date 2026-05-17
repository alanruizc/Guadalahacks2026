import { VOICE_COMMANDS, type VoiceCommandId } from '../voice/voiceCommands';

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** Frases más largas primero para evitar coincidencias parciales erróneas. */
const SORTED_PATTERNS = VOICE_COMMANDS.flatMap((cmd) =>
  cmd.phrases.map((phrase) => ({
    commandId: cmd.id,
    phrase: normalize(phrase),
    length: phrase.length,
  })),
).sort((a, b) => b.length - a.length);

export function parseVoiceCommand(transcript: string): VoiceCommandId | null {
  const normalized = normalize(transcript);
  for (const { commandId, phrase } of SORTED_PATTERNS) {
    if (normalized.includes(phrase)) {
      return commandId;
    }
  }
  return null;
}
