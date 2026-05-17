import type { DetectedGesture } from './extractGestures';
import {
  GESTURE_COMMAND_MAPPINGS,
  type VoiceCommandId,
} from '../voice/voiceCommands';

export type { VoiceCommandId };

export interface GestureCommandMapping {
  commandId: VoiceCommandId;
  voicePhrase: string;
  gestureName: string;
}

export { GESTURE_COMMAND_MAPPINGS };

export function resolveGestureCommand(gesture: DetectedGesture): GestureCommandMapping | null {
  return GESTURE_COMMAND_MAPPINGS.find((m) => m.gestureName === gesture.name) ?? null;
}
