import { requireRole } from "@/lib/session";
import { getCollection } from "@/lib/mongodb";
import type { DeviceDoc, MemberDoc, ServiceDoc } from "@/lib/models";
import { serializeDoc, serializeDocs } from "@/lib/types";
import { KioskClient } from "@/components/KioskClient";

export default async function KioskPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; queued?: string }>;
}) {
  await requireRole("admin", "officer");
  const sp = await searchParams;

  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const services = serializeDocs(
    await (await getCollection<ServiceDoc>("services"))
      .find({ is_active: true, starts_at: { $gte: sixHoursAgo } })
      .sort({ starts_at: 1 })
      .limit(20)
      .toArray(),
  ).map((s) => ({
    ...s,
    starts_at: new Date(s.starts_at).toISOString(),
  }));

  const memberDocs = await (
    await getCollection<MemberDoc>("members")
  )
    .find({ membership_status: "active" })
    .sort({ last_name: 1, first_name: 1 })
    .limit(500)
    .toArray();

  const members = serializeDocs(memberDocs);

  const enrolledFaces = memberDocs
    .filter(
      (m) =>
        m.enrolled_face &&
        Array.isArray(m.face_descriptor) &&
        m.face_descriptor.length,
    )
    .map((m) => ({
      id: String(m._id),
      label: `${m.first_name} ${m.last_name} (${m.member_code})`,
      descriptor: m.face_descriptor as number[],
    }));

  const enrolledThumbs = memberDocs
    .filter(
      (m) =>
        m.enrolled_fingerprint &&
        Array.isArray(m.fingerprint_descriptor) &&
        m.fingerprint_descriptor.length,
    )
    .map((m) => ({
      id: String(m._id),
      label: `${m.first_name} ${m.last_name} (${m.member_code})`,
      descriptor: m.fingerprint_descriptor as number[],
    }));

  const device = serializeDoc(
    await (await getCollection<DeviceDoc>("devices")).findOne(
      { is_active: true },
      { sort: { created_at: 1 } },
    ),
  );

  return (
    <>
      {sp.ok && <div className="alert alert-success">Clock recorded (online).</div>}
      {sp.queued && (
        <div className="alert alert-info">
          Queued offline. Process under Devices & Sync when ready.
        </div>
      )}
      <KioskClient
        members={members}
        services={services}
        device={device}
        enrolledFaces={enrolledFaces}
        enrolledThumbs={enrolledThumbs}
      />
    </>
  );
}
