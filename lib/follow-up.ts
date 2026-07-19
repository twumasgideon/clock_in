import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import type { AttendanceDoc, MemberDoc, ServiceDoc } from "@/lib/models";
import { serializeDoc, serializeDocs, toId } from "@/lib/types";

export type FollowUpMember = {
  id: string;
  member_code: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  status?: string;
  clock_in_at?: string | null;
};

export type FollowUpReport = {
  service: {
    id: string;
    title: string;
    starts_at: string;
    ends_at: string | null;
    location: string | null;
  };
  present: FollowUpMember[];
  absent: FollowUpMember[];
  presentCount: number;
  absentCount: number;
  withPhoneAbsent: number;
  withPhonePresent: number;
};

/** Prefer a service that recently ended / started (for post-service follow-up). */
export async function findLatestFollowUpService(): Promise<
  (ServiceDoc & { id: string }) | null
> {
  const services = await getCollection<ServiceDoc>("services");
  const now = new Date();
  const windowStart = new Date(now.getTime() - 18 * 60 * 60 * 1000);

  const recent = await services
    .find({
      is_active: true,
      starts_at: { $gte: windowStart, $lte: now },
    })
    .sort({ starts_at: -1 })
    .limit(1)
    .toArray();

  if (recent[0]) return serializeDoc(recent[0]);

  const latestPast = await services
    .find({ starts_at: { $lte: now } })
    .sort({ starts_at: -1 })
    .limit(1)
    .toArray();

  return serializeDoc(latestPast[0] ?? null);
}

export async function buildFollowUpReport(
  serviceId: string,
): Promise<FollowUpReport | null> {
  if (!ObjectId.isValid(serviceId)) return null;

  const services = await getCollection<ServiceDoc>("services");
  const members = await getCollection<MemberDoc>("members");
  const attendance = await getCollection<AttendanceDoc>("attendance");

  const service = serializeDoc(
    await services.findOne({ _id: new ObjectId(serviceId) }),
  );
  if (!service) return null;

  const activeMembers = serializeDocs(
    await members
      .find({ membership_status: "active" })
      .sort({ last_name: 1, first_name: 1 })
      .toArray(),
  );

  const rows = await attendance.find({ service_id: serviceId }).toArray();
  const presentMap = new Map(
    rows.map((r) => [
      r.member_id,
      {
        status: r.status,
        clock_in_at: r.clock_in_at
          ? new Date(r.clock_in_at).toISOString()
          : null,
      },
    ]),
  );

  const present: FollowUpMember[] = [];
  const absent: FollowUpMember[] = [];

  for (const m of activeMembers) {
    const hit = presentMap.get(m.id);
    const row: FollowUpMember = {
      id: m.id,
      member_code: m.member_code,
      first_name: m.first_name,
      last_name: m.last_name,
      phone: m.phone ?? null,
      status: hit?.status,
      clock_in_at: hit?.clock_in_at,
    };
    if (hit) present.push(row);
    else absent.push(row);
  }

  return {
    service: {
      id: service.id,
      title: service.title,
      starts_at: new Date(service.starts_at).toISOString(),
      ends_at: service.ends_at
        ? new Date(service.ends_at).toISOString()
        : null,
      location: service.location ?? null,
    },
    present,
    absent,
    presentCount: present.length,
    absentCount: absent.length,
    withPhonePresent: present.filter((m) => m.phone).length,
    withPhoneAbsent: absent.filter((m) => m.phone).length,
  };
}

export async function listRecentServices(limit = 30) {
  const services = await getCollection<ServiceDoc>("services");
  return serializeDocs(
    await services.find({}).sort({ starts_at: -1 }).limit(limit).toArray(),
  ).map((s) => ({
    id: s.id,
    title: s.title,
    starts_at: new Date(s.starts_at).toISOString(),
  }));
}

export function shouldAutoPopup(serviceStartsAt: Date): boolean {
  const now = Date.now();
  const start = serviceStartsAt.getTime();
  // Show from 1 hour after start through 18 hours after start
  return now >= start + 60 * 60 * 1000 && now <= start + 18 * 60 * 60 * 1000;
}

export { toId };
