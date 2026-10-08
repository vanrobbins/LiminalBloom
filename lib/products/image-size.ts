// How big an upload ends up (spec §5.4): at most 1200 px on its longest side,
// so a 5 MB phone photo becomes a ~150 KB image for store Wi-Fi.

export const MAX_IMAGE_SIDE = 1200;

export function fitWithin(width: number, height: number, max = MAX_IMAGE_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
