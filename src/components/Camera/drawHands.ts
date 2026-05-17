import {
  DrawingUtils,
  HandLandmarker,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';

export function drawHands(
  drawingUtils: DrawingUtils,
  landmarks: NormalizedLandmark[][],
): void {
  for (const hand of landmarks) {
    drawingUtils.drawConnectors(hand, HandLandmarker.HAND_CONNECTIONS, {
      color: '#00FF88',
      lineWidth: 3,
    });
    drawingUtils.drawLandmarks(hand, {
      color: '#00D4FF',
      lineWidth: 1,
      radius: 2,
    });
  }
}
