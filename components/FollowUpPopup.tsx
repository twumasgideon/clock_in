"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Props = {
  serviceId: string;
  serviceTitle: string;
  presentCount: number;
  absentCount: number;
  withPhoneAbsent: number;
};

export function FollowUpPopup({
  serviceId,
  serviceTitle,
  presentCount,
  absentCount,
  withPhoneAbsent,
}: Props) {
  const [open, setOpen] = useState(false);
  const storageKey = `followup-dismissed:${serviceId}`;

  useEffect(() => {
    try {
      if (sessionStorage.getItem(storageKey)) return;
      setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [storageKey]);

  function dismiss() {
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="followup-overlay" role="dialog" aria-modal="true">
      <div className="followup-modal">
        <p className="eyebrow" style={{ color: "var(--blue)" }}>
          After service follow-up
        </p>
        <h2>Service attendance ready</h2>
        <p className="empty-hint">
          <strong>{serviceTitle}</strong> — review who was present and who was
          absent for pastoral follow-up calls.
        </p>
        <div className="followup-stats">
          <div>
            <span className="followup-stat-num present">{presentCount}</span>
            <span>Present</span>
          </div>
          <div>
            <span className="followup-stat-num absent">{absentCount}</span>
            <span>Absent</span>
          </div>
          <div>
            <span className="followup-stat-num">{withPhoneAbsent}</span>
            <span>Absent with phone</span>
          </div>
        </div>
        <div className="row-actions" style={{ marginTop: "1.25rem" }}>
          <Link
            href={`/follow-up?service_id=${serviceId}`}
            className="btn btn-accent"
            onClick={dismiss}
          >
            Open follow-up lists
          </Link>
          <button type="button" className="btn btn-outline" onClick={dismiss}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
