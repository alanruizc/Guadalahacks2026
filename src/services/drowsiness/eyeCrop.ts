interface LandmarkPoint {
  x: number;
  y: number;
}

const EYE_LANDMARK_INDICES = [
  33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246,
  263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466,
];

export function getEyeRegionBounds(landmarks: LandmarkPoint[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} | null {
  const points = EYE_LANDMARK_INDICES.map((i) => landmarks[i]).filter(Boolean);
  if (points.length < 4) return null;

  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  return { minX, minY, maxX, maxY };
}

export function eyeCropToPixels(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  videoWidth: number,
  videoHeight: number,
): { x: number; y: number; width: number; height: number } {
  let x = bounds.minX * videoWidth;
  let y = bounds.minY * videoHeight;
  let width = (bounds.maxX - bounds.minX) * videoWidth;
  let height = (bounds.maxY - bounds.minY) * videoHeight;

  const paddingX = width * 0.35;
  const paddingY = height * 0.5;

  x = Math.max(0, x - paddingX);
  y = Math.max(0, y - paddingY);
  width = Math.min(videoWidth - x, width + paddingX * 2);
  height = Math.min(videoHeight - y, height + paddingY * 2);

  return { x, y, width, height };
}
