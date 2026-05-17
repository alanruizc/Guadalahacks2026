import { useMemo } from 'react';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import styles from './FaceOverlay.module.css';

interface FaceOverlayProps {
  landmarks: NormalizedLandmark[] | null;
  videoWidth: number;
  videoHeight: number;
}

export function FaceOverlay({ landmarks, videoWidth, videoHeight }: FaceOverlayProps) {
  const dots = useMemo(() => {
    if (!landmarks) return [];

    return landmarks.map((point, index) => ({
      x: point.x * videoWidth,
      y: point.y * videoHeight,
      z: point.z,
      index,
    }));
  }, [landmarks, videoWidth, videoHeight]);

  const connections = useMemo(() => {
    const faceOutline = [
      10, 338, 297, 332, 331, 297, 284, 251, 389, 356, 454, 323, 361, 288,
      397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 169, 170, 140,
      171, 175, 396, 369, 395, 394, 364, 365, 397, 288, 361, 323, 454, 356,
      389, 251, 397, 365, 284, 251, 306, 241, 240, 242, 243, 44, 185, 122,
      188, 227, 225, 224, 223, 222, 221, 190, 189, 194, 207, 214, 211, 210,
      211, 43, 230, 228, 229, 231, 232, 135, 169, 170, 140, 171, 175, 396,
      369, 395, 394, 364, 365, 397, 288, 361, 323, 454, 356, 389, 251, 397,
      365, 284, 251, 306, 241, 240, 242, 243, 44, 185, 122, 188, 227, 225,
      224, 223, 222, 221, 190, 189, 194, 207, 214, 211, 210, 211,
    ];

    const lines: [number, number][] = [];
    for (let i = 0; i < faceOutline.length - 1; i++) {
      lines.push([faceOutline[i], faceOutline[i + 1]]);
    }

    const leftEye = [33, 246, 161, 160, 159, 158, 157, 173, 155, 154, 153, 145, 144, 163, 7, 33];
    const rightEye = [263, 466, 397, 288, 361, 323, 454, 356, 389, 251, 397, 365, 284, 251, 397, 263];

    leftEye.forEach((_, i) => {
      if (i < leftEye.length - 1) lines.push([leftEye[i], leftEye[i + 1]]);
    });
    rightEye.forEach((_, i) => {
      if (i < rightEye.length - 1) lines.push([rightEye[i], rightEye[i + 1]]);
    });

    return lines;
  }, []);

  if (!landmarks) return null;

  return (
    <svg className={styles.overlay} viewBox={`0 0 ${videoWidth} ${videoHeight}`}>
      {connections.map(([start, end], idx) => {
        const startPoint = dots[start];
        const endPoint = dots[end];
        if (!startPoint || !endPoint) return null;

        return (
          <line
            key={`line-${idx}`}
            x1={startPoint.x}
            y1={startPoint.y}
            x2={endPoint.x}
            y2={endPoint.y}
            className={styles.line}
          />
        );
      })}
      {dots.map((dot) => (
        <circle
          key={`dot-${dot.index}`}
          cx={dot.x}
          cy={dot.y}
          r={2}
          className={styles.dot}
        />
      ))}
    </svg>
  );
}