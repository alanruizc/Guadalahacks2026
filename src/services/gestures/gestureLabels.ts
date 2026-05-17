const GESTURE_LABELS: Record<string, string> = {
  Closed_Fist: '👊Puño cerrado',
  Open_Palm: '🤚Palma abierta',
  Pointing_Up: '👆Señalar arriba',
  Thumb_Down: '👎Pulgar abajo',
  Thumb_Up: '👍Pulgar arriba',
  Victory: '✌️Victoria / paz',
  ILoveYou: '🤟Te amo (ASL)',
};

export function formatGestureLabel(gestureName: string): string {
  return GESTURE_LABELS[gestureName] ?? gestureName.replaceAll('_', ' ');
}
