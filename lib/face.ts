"use client";

import * as faceapi from "@vladmandic/face-api";

const MODEL_URL = "/models";
export const MATCH_THRESHOLD = 0.55;

let modelsReady: Promise<void> | null = null;

export function loadFaceModels(): Promise<void> {
  if (!modelsReady) {
    modelsReady = (async () => {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
    })().catch((err) => {
      modelsReady = null;
      throw err;
    });
  }
  return modelsReady;
}

export type FaceDetectionResult = {
  descriptor: Float32Array;
  box: { x: number; y: number; width: number; height: number };
};

export async function detectSingleFace(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
): Promise<FaceDetectionResult | null> {
  await loadFaceModels();
  const detection = await faceapi
    .detectSingleFace(
      input,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }),
    )
    .withFaceLandmarks()
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
    .detectAllFaces(
      input,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }),
    )
    .withFaceLandmarks()
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

export function matchFace(
  descriptor: Float32Array | number[],
  enrolled: EnrolledFace[],
  threshold = MATCH_THRESHOLD,
): FaceMatch | null {
  const usable = enrolled.filter((p) => p.descriptor?.length);
  if (!usable.length) return null;

  const query =
    descriptor instanceof Float32Array ? descriptor : new Float32Array(descriptor);
  const labeled = usable.map(
    (p) =>
      new faceapi.LabeledFaceDescriptors(p.id, [new Float32Array(p.descriptor)]),
  );
  const matcher = new faceapi.FaceMatcher(labeled, threshold);
  const best = matcher.findBestMatch(query);
  if (best.label === "unknown" || best.distance > threshold) return null;

  const person = usable.find((p) => p.id === best.label);
  return {
    id: best.label,
    label: person?.label ?? best.label,
    distance: best.distance,
  };
}
