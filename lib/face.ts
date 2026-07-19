"use client";

import * as faceapi from "@vladmandic/face-api";

const MODEL_URL = "/models";
export const MATCH_THRESHOLD = 0.55;

/** TinyFaceDetector input sizes must be multiples of 32. Smaller = faster. */
const DETECT_OPTIONS = new faceapi.TinyFaceDetectorOptions({
  inputSize: 128,
  scoreThreshold: 0.4,
});

let modelsReady: Promise<void> | null = null;

export function loadFaceModels(): Promise<void> {
  if (!modelsReady) {
    modelsReady = (async () => {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
    })().catch((err) => {
      modelsReady = null;
      throw err;
    });
  }
  return modelsReady;
}

export type FaceBox = { x: number; y: number; width: number; height: number };

export type FaceDetectionResult = {
  descriptor: Float32Array;
  box: FaceBox;
};

/** Fast box-only detection (no landmarks / descriptor). */
export async function detectFaceBox(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
): Promise<FaceBox | null> {
  await loadFaceModels();
  const detection = await faceapi.detectSingleFace(input, DETECT_OPTIONS);
  if (!detection) return null;
  const box = detection.box;
  return { x: box.x, y: box.y, width: box.width, height: box.height };
}

export async function detectSingleFace(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
): Promise<FaceDetectionResult | null> {
  await loadFaceModels();
  const detection = await faceapi
    .detectSingleFace(input, DETECT_OPTIONS)
    .withFaceLandmarks(true)
    .withFaceDescriptor();

  if (!detection) return null;
  const box = detection.detection.box;
  return {
    descriptor: detection.descriptor,
    box: { x: box.x, y: box.y, width: box.width, height: box.height },
  };
}

export async function detectAllFaces(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
): Promise<FaceDetectionResult[]> {
  await loadFaceModels();
  const detections = await faceapi
    .detectAllFaces(input, DETECT_OPTIONS)
    .withFaceLandmarks(true)
    .withFaceDescriptors();

  return detections.map((d) => {
    const box = d.detection.box;
    return {
      descriptor: d.descriptor,
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
    };
  });
}

export type EnrolledFace = {
  id: string;
  label: string;
  descriptor: number[];
};

export type FaceMatch = {
  id: string;
  label: string;
  distance: number;
};

export function createFaceMatcher(
  enrolled: EnrolledFace[],
  threshold = MATCH_THRESHOLD,
): faceapi.FaceMatcher | null {
  const usable = enrolled.filter((p) => p.descriptor?.length);
  if (!usable.length) return null;
  const labeled = usable.map(
    (p) =>
      new faceapi.LabeledFaceDescriptors(p.id, [
        new Float32Array(p.descriptor),
      ]),
  );
  return new faceapi.FaceMatcher(labeled, threshold);
}

export function matchWithMatcher(
  descriptor: Float32Array | number[],
  matcher: faceapi.FaceMatcher,
  enrolled: EnrolledFace[],
  threshold = MATCH_THRESHOLD,
): FaceMatch | null {
  const query =
    descriptor instanceof Float32Array
      ? descriptor
      : new Float32Array(descriptor);
  const best = matcher.findBestMatch(query);
  if (best.label === "unknown" || best.distance > threshold) return null;
  const person = enrolled.find((p) => p.id === best.label);
  return {
    id: best.label,
    label: person?.label ?? best.label,
    distance: best.distance,
  };
}

export function matchFace(
  descriptor: Float32Array | number[],
  enrolled: EnrolledFace[],
  threshold = MATCH_THRESHOLD,
): FaceMatch | null {
  const matcher = createFaceMatcher(enrolled, threshold);
  if (!matcher) return null;
  return matchWithMatcher(descriptor, matcher, enrolled, threshold);
}
