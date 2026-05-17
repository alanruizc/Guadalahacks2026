import {
  DrawingUtils,
  FaceLandmarker,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';

export function drawFaceMesh(
  drawingUtils: DrawingUtils,
  landmarks: NormalizedLandmark[],
): void {
  drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, {
    color: '#C0C0C070',
    lineWidth: 1,
  });
  drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, {
    color: '#E0E0E0',
  });
  drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, {
    color: '#E0E0E0',
  });
  drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, {
    color: '#E0E0E0',
  });
  drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, {
    color: '#E0E0E0',
  });
  drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, {
    color: '#E0E0E0',
  });
  drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS, {
    color: '#E0E0E0',
  });
  drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS, {
    color: '#E0E0E0',
  });
  drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS, {
    color: '#E0E0E0',
  });
}
