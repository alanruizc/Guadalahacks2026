export interface FaceBlendshapeScores {
  eyeBlinkLeft: number;
  eyeBlinkRight: number;
  eyeSquintLeft: number;
  eyeSquintRight: number;
  eyeLookDownLeft: number;
  eyeLookDownRight: number;
  jawOpen: number;
}

export interface BlendshapeCategories {
  categories?: Array<{ categoryName?: string; score?: number }>;
}

const ZERO_SCORES: FaceBlendshapeScores = {
  eyeBlinkLeft: 0,
  eyeBlinkRight: 0,
  eyeSquintLeft: 0,
  eyeSquintRight: 0,
  eyeLookDownLeft: 0,
  eyeLookDownRight: 0,
  jawOpen: 0,
};

function scoreFromCategories(
  categories: BlendshapeCategories['categories'],
  name: string,
): number {
  const entry = categories?.find((c) => c.categoryName === name);
  return entry?.score ?? 0;
}

export function parseBlendshapeScores(
  classifications: BlendshapeCategories | undefined,
): FaceBlendshapeScores | null {
  if (!classifications?.categories?.length) return null;

  const { categories } = classifications;
  return {
    eyeBlinkLeft: scoreFromCategories(categories, 'eyeBlinkLeft'),
    eyeBlinkRight: scoreFromCategories(categories, 'eyeBlinkRight'),
    eyeSquintLeft: scoreFromCategories(categories, 'eyeSquintLeft'),
    eyeSquintRight: scoreFromCategories(categories, 'eyeSquintRight'),
    eyeLookDownLeft: scoreFromCategories(categories, 'eyeLookDownLeft'),
    eyeLookDownRight: scoreFromCategories(categories, 'eyeLookDownRight'),
    jawOpen: scoreFromCategories(categories, 'jawOpen'),
  };
}

export function areBothEyesClosed(scores: FaceBlendshapeScores): boolean {
  return scores.eyeBlinkLeft > 0.55 && scores.eyeBlinkRight > 0.55;
}

export function areBothEyesOpen(scores: FaceBlendshapeScores): boolean {
  return scores.eyeBlinkLeft < 0.25 && scores.eyeBlinkRight < 0.25;
}

export function isLookingDown(scores: FaceBlendshapeScores): boolean {
  const down = (scores.eyeLookDownLeft + scores.eyeLookDownRight) / 2;
  return down > 0.45 && areBothEyesOpen(scores);
}

export function isYawning(scores: FaceBlendshapeScores): boolean {
  return scores.jawOpen > 0.45;
}

export function isSquinting(scores: FaceBlendshapeScores): boolean {
  return scores.eyeSquintLeft > 0.4 || scores.eyeSquintRight > 0.4;
}

export { ZERO_SCORES };
