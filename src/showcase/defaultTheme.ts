/**
 * Small appearance helpers for the app's Default family.
 *
 * The palette still comes from the existing accent preset registry. This file
 * only owns the independent corner-rounding choice so the new family can stay
 * close to the ideation-canvas control language without introducing another
 * palette system.
 */

export const DEFAULT_RADIUS_IDS = ['sharp', 'soft', 'rounded', 'pill'] as const;
export type DefaultRadius = (typeof DEFAULT_RADIUS_IDS)[number];

export interface DefaultRadiusMeta {
  id: DefaultRadius;
  label: string;
  description: string;
  previewPx: number;
}

export const DEFAULT_RADIUS: DefaultRadius = 'soft';

export const DEFAULT_RADII: readonly DefaultRadiusMeta[] = [
  { id: 'sharp', label: 'Sharp', description: 'Square corners', previewPx: 0 },
  { id: 'soft', label: 'Soft', description: 'Gentle rounding', previewPx: 8 },
  { id: 'rounded', label: 'Rounded', description: 'Friendlier corners', previewPx: 14 },
  { id: 'pill', label: 'Pill', description: 'Maximum softness', previewPx: 22 },
] as const;

const STORAGE_KEY = 'agensis_default_radius';

export function isDefaultRadius(value: unknown): value is DefaultRadius {
  return typeof value === 'string' && (DEFAULT_RADIUS_IDS as readonly string[]).includes(value);
}

export function getStoredDefaultRadius(): DefaultRadius {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isDefaultRadius(stored) ? stored : DEFAULT_RADIUS;
  } catch {
    return DEFAULT_RADIUS;
  }
}

/** Apply and persist the radius choice. The CSS scope keeps it Default-only. */
export function applyDefaultRadius(value: unknown): DefaultRadius {
  const radius = isDefaultRadius(value) ? value : DEFAULT_RADIUS;
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-default-radius', radius);
  }
  try {
    localStorage.setItem(STORAGE_KEY, radius);
  } catch {
    /* private mode */
  }
  return radius;
}
