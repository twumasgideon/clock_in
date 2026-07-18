"use client";

import { useEffect, useRef, useState } from "react";
import { clearMemberFace, enrollMemberFace } from "@/app/actions";
import { detectSingleFace, loadFaceModels } from "@/lib/face";

export function FaceEnroll({
  memberId,
  enrolled,
  memberName,
}: {
  memberId: string;
  enrolled: boolean;
  memberName: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<string>(
    enrolled ? "Face already enrolled." : "Camera off.",
  );
  const [busy, setBusy] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(enrolled);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startCamera() {
    setBusy(true);
    setStatus("Loading face models…");
    try {
      await loadFaceModels();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
      setStatus("Camera ready. Center one face, then capture.");
    } catch (err) {
      setStatus(
        err instanceof Error
          ? err.message
          : "Could not start camera or load models.",
      );
    } finally {
      setBusy(false);
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
    setStatus(isEnrolled ? "Face already enrolled." : "Camera off.");
  }

  async function capture() {
    if (!videoRef.current) return;
    setBusy(true);
    setStatus("Detecting face…");
    try {
      const result = await detectSingleFace(videoRef.current);
      if (!result) {
        setStatus("No face detected. Improve lighting and try again.");
        return;
      }
      setStatus("Saving face template…");
      const res = await enrollMemberFace(memberId, Array.from(result.descriptor));
      if (!res.ok) {
        setStatus(res.error || "Failed to save face.");
        return;
      }
      setIsEnrolled(true);
      setStatus(`Enrolled face for ${memberName}.`);
      stopCamera();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Capture failed.");
    } finally {
      setBusy(false);
    }
  }

  async function clearFace() {
    setBusy(true);
    try {
      const res = await clearMemberFace(memberId);
      if (!res.ok) {
        setStatus(res.error || "Failed to clear face.");
        return;
      }
      setIsEnrolled(false);
      setStatus("Face enrollment cleared.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel-card face-enroll" style={{ marginTop: "1rem" }}>
      <h3>Face enrollment</h3>
      <p className="empty-hint" style={{ marginBottom: "0.75rem" }}>
        Capture one clear face for kiosk clock-in. Good lighting works best.
      </p>
      <div className="face-video-wrap">
        <video ref={videoRef} className="face-video" muted playsInline />
        {!cameraOn && (
          <div className="face-video-placeholder">
            {isEnrolled ? (
              <span className="badge badge-ok">Face enrolled</span>
            ) : (
              <span className="badge badge-muted">Not enrolled</span>
            )}
          </div>
        )}
      </div>
      <p className="face-status">{status}</p>
      <div className="row-actions">
        {!cameraOn ? (
          <button
            type="button"
            className="btn btn-accent"
            onClick={startCamera}
            disabled={busy}
          >
            {isEnrolled ? "Re-enroll face" : "Start camera"}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-accent"
              onClick={capture}
              disabled={busy}
            >
              Capture &amp; save
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={stopCamera}
              disabled={busy}
            >
              Stop camera
            </button>
          </>
        )}
        {isEnrolled && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={clearFace}
            disabled={busy}
          >
            Clear face
          </button>
        )}
      </div>
    </div>
  );
}
