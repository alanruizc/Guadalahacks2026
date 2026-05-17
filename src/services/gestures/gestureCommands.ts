import type { DetectedGesture } from './extractGestures';
import { getCommandByGesture, type GestureVoiceMapping, type VoiceCommandId } from '../voice/voiceCommands';

export type { VoiceCommandId, GestureVoiceMapping };

export function resolveGestureCommand(gesture: DetectedGesture): GestureVoiceMapping | null {
  return getCommandByGesture(gesture.name);
}