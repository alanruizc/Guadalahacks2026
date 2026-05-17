import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

export const FACE_FOCUS_MARGIN_PX = 240;
const ZOOM_SMOOTHING = 0.12;
const MAX_ZOOM = 3.5;

export interface FaceBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface FaceZoomState {
  scale: number;
  originX: number;
  originY: number;
}

export function getLandmarkBounds(landmarks: NormalizedLandmark[]): FaceBounds {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;

  for (const point of landmarks) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return { minX, minY, maxX, maxY };
}

export function computeFaceZoomTarget(
  bounds: FaceBounds,
  displayWidth: number,
  displayHeight: number,
): FaceZoomState {
  const marginX = FACE_FOCUS_MARGIN_PX / displayWidth;
  const marginY = FACE_FOCUS_MARGIN_PX / displayHeight;

  const cropMinX = Math.max(0, bounds.minX - marginX);
  const cropMinY = Math.max(0, bounds.minY - marginY);
  const cropMaxX = Math.min(1, bounds.maxX + marginX);
  const cropMaxY = Math.min(1, bounds.maxY + marginY);

  const cropW = Math.max(cropMaxX - cropMinX, 0.05);
  const cropH = Math.max(cropMaxY - cropMinY, 0.05);

  const scale = Math.min(Math.min(1 / cropW, 1 / cropH), MAX_ZOOM);
  const originX = ((cropMinX + cropMaxX) / 2) * 100;
  const originY = ((cropMinY + cropMaxY) / 2) * 100;

  return { scale, originX, originY };
}

export function smoothFaceZoom(
  current: FaceZoomState,
  target: FaceZoomState,
  hasFace: boolean,
): FaceZoomState {
  const resetTarget: FaceZoomState = { scale: 1, originX: 50, originY: 50 };
  const goal = hasFace ? target : resetTarget;
  const t = ZOOM_SMOOTHING;

  return {
    scale: current.scale + (goal.scale - current.scale) * t,
    originX: current.originX + (goal.originX - current.originX) * t,
    originY: current.originY + (goal.originY - current.originY) * t,
  };
}

export function faceZoomToTransform(zoom: FaceZoomState): string {
  return `scaleX(-1) scale(${zoom.scale})`;
}
