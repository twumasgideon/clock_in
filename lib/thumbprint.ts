"use client";

export const THUMB_GRID = 16;
export const THUMB_MATCH_THRESHOLD = 0.22;

export type EnrolledThumb = {
  id: string;
  label: string;
  descriptor: number[];
};

export type ThumbMatch = {
  id: string;
  label: string;
  distance: number;
};

/** Build a normalized grid descriptor from a canvas thumb impression. */
export function descriptorFromCanvas(canvas: HTMLCanvasElement): number[] | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  const { width, height } = canvas;
  if (width < 8 || height < 8) return null;

  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  let inkPixels = 0;
  const gray = new Float32Array(width * height);

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const g = (data[i] + data[i + 1] + data[i + 2]) / 3 / 255;
    gray[p] = g;
    // Count dark strokes (ink) — canvas starts light
    if (g < 0.85) inkPixels++;
  }

  // Require a meaningful impression
  if (inkPixels < width * height * 0.02) return null;

  const cellW = width / THUMB_GRID;
  const cellH = height / THUMB_GRID;
  const descriptor: number[] = [];

  for (let gy = 0; gy < THUMB_GRID; gy++) {
    for (let gx = 0; gx < THUMB_GRID; gx++) {
      let sum = 0;
      let count = 0;
      const x0 = Math.floor(gx * cellW);
      const y0 = Math.floor(gy * cellH);
      const x1 = Math.floor((gx + 1) * cellW);
      const y1 = Math.floor((gy + 1) * cellH);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          sum += gray[y * width + x];
          count++;
        }
      }
      descriptor.push(count ? sum / count : 1);
    }
  }

  // Mean-center for lighting/pressure variance
  const mean = descriptor.reduce((a, b) => a + b, 0) / descriptor.length;
  return descriptor.map((v) => v - mean);
}

export function euclideanDistance(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (!n) return Number.POSITIVE_INFINITY;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum / n);
}

export function matchThumbprint(
  descriptor: number[],
  enrolled: EnrolledThumb[],
  threshold = THUMB_MATCH_THRESHOLD,
): ThumbMatch | null {
  let best: ThumbMatch | null = null;
  for (const person of enrolled) {
    if (!person.descriptor?.length) continue;
    const distance = euclideanDistance(descriptor, person.descriptor);
    if (!best || distance < best.distance) {
      best = { id: person.id, label: person.label, distance };
    }
  }
  return best && best.distance <= threshold ? best : null;
}
