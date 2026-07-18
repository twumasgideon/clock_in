import Link from "next/link";
import { requireSession } from "@/lib/session";
import { getCollection } from "@/lib/mongodb";
import type { AttendanceDoc, MemberDoc, ServiceDoc, DeviceDoc, SyncQueueDoc } from "@/lib/models";
import { serializeDocs, toId } from "@/lib/types";
import { ObjectId } from "mongodb";

export default async function DashboardPage() {
  await requireSession();

  const members = await getCollection<MemberDoc>("members");
  const attendance = await getCollection<AttendanceDoc>("attendance");
  const services = await getCollection<ServiceDoc>("services");
  const devices = await getCollection<DeviceDoc>("devices");
  const syncQueue = await getCollection<SyncQueueDoc>("sync_queue");

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [memberCount, todayCount, serviceCount, pendingSync, deviceList, recentRaw, upcoming] =
    await Promise.all([
      members.countDocuments({ membership_status: "active" }),
      attendance.countDocuments({
        clock_in_at: { $gte: start, $lt: end },
      }),
      services.countDocuments({
        is_active: true,
        starts_at: { $gte: dayAgo },
      }),
      syncQueue.countDocuments({
        status: { $in: ["pending", "processing", "failed"] },
      }),
      devices.find({ is_active: true }).toArray(),
      attendance.find({}).sort({ clock_in_at: -1 }).limit(8).toArray(),
      services
        .find({
          is_active: true,
          starts_at: { $gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
        })
        .sort({ starts_at: 1 })
        .limit(5)
        .toArray(),
    ]);

  const online = deviceList.filter((d) => d.mode === "online").length;
  const offline = deviceList.filter((d) => d.mode === "offline").length;
  const syncing = deviceList.filter((d) => d.mode === "syncing").length;
  const lastSync = deviceList
    .map((d) => d.last_sync_at)
    .filter(Boolean)
    .sort((a, b) => (b as Date).getTime() - (a as Date).getTime())[0] as
    | Date
    | undefined;

  const memberIds = [...new Set(recentRaw.map((r) => r.member_id))];
  const serviceIds = [...new Set(recentRaw.map((r) => r.service_id))];
  const memberMap = new Map<string, MemberDoc & { id: string }>();
  const serviceMap = new Map<string, ServiceDoc & { id: string }>();

  if (memberIds.length) {
    const oids = memberIds
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));
    const list = serializeDocs(
      await members.find({ _id: { $in: oids } }).toArray(),
    );
    list.forEach((m) => memberMap.set(m.id, m));
  }
  if (serviceIds.length) {
    const oids = serviceIds
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));
    const list = serializeDocs(
      await services.find({ _id: { $in: oids } }).toArray(),
    );
    list.forEach((s) => serviceMap.set(s.id, s));
  }

  const recent = recentRaw.map((r) => {
    const m = memberMap.get(r.member_id);
    const s = serviceMap.get(r.service_id);
    return {
      id: toId(r._id),
      clock_in_at: r.clock_in_at,
      status: r.status,
      source_mode: r.source_mode,
      synced_from_offline: r.synced_from_offline,
      first_name: m?.first_name ?? "—",
      last_name: m?.last_name ?? "",
      member_code: m?.member_code ?? "",
      service_title: s?.title ?? "—",
    };
  });

  return (
    <>
      <div className="stat-grid" style={{ marginBottom: "1rem" }}>
        <div className="stat-card">
          <div className="label">Active members</div>
          <p className="value">{memberCount}</p>
        </div>
        <div className="stat-card">
          <div className="label">Clock-ins today</div>
          <p className="value">{todayCount}</p>
        </div>
        <div className="stat-card">
          <div className="label">Active services</div>
          <p className="value">{serviceCount}</p>
        </div>
        <div className="stat-card">
          <div className="label">Pending sync</div>
          <p className="value">{pendingSync}</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.5rem",
            }}
          >
            <h2 style={{ margin: 0 }}>Recent attendance</h2>
            <Link href="/attendance" className="btn btn-outline btn-sm">
              View all
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="empty-hint">
              No attendance yet. Open the kiosk to clock members in.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Service</th>
                    <th>Time</th>
                    <th>Mode</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>
                          {row.first_name} {row.last_name}
                        </strong>
                        <div style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>
                          {row.member_code}
                        </div>
                      </td>
                      <td>{row.service_title}</td>
                      <td>
                        {row.clock_in_at
                          ? new Date(row.clock_in_at).toLocaleString()
                          : "—"}
                      </td>
                      <td>
                        <span className={`mode-badge mode-${row.source_mode}`}>
                          {row.source_mode}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <div className="panel-card" style={{ marginBottom: "1rem" }}>
            <h3>Connectivity</h3>
            <p>
              Kiosks online: <strong>{online}</strong> / {deviceList.length}
            </p>
            <p>
              Offline: <strong>{offline}</strong> · Syncing:{" "}
              <strong>{syncing}</strong>
            </p>
            <p className="empty-hint">
              Last sync:{" "}
              {lastSync ? new Date(lastSync).toLocaleString() : "Never"}
            </p>
            <Link href="/kiosk" className="btn btn-accent btn-sm">
              Open kiosk
            </Link>
          </div>
          <div className="panel-card">
            <h3>Upcoming services</h3>
            {upcoming.length === 0 ? (
              <p className="empty-hint">No upcoming services.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {upcoming.map((s) => (
                  <li key={toId(s._id)} style={{ marginBottom: "0.85rem" }}>
                    <strong>{s.title}</strong>
                    <div className="empty-hint">
                      {new Date(s.starts_at).toLocaleString()}
                      {s.location ? ` · ${s.location}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
