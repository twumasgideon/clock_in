import { requireRole } from "@/lib/session";
import { getCollection } from "@/lib/mongodb";
import type { AttendanceDoc, MemberDoc, ServiceDoc } from "@/lib/models";
import { serializeDocs, toId } from "@/lib/types";
import { ObjectId } from "mongodb";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ service_id?: string; mode?: string }>;
}) {
  await requireRole("admin", "officer", "pastor");
  const { service_id = "", mode = "" } = await searchParams;

  const servicesCol = await getCollection<ServiceDoc>("services");
  const attendanceCol = await getCollection<AttendanceDoc>("attendance");
  const membersCol = await getCollection<MemberDoc>("members");

  const services = serializeDocs(
    await servicesCol.find({}).sort({ starts_at: -1 }).limit(50).toArray(),
  );

  const filter: Record<string, unknown> = {};
  if (service_id && ObjectId.isValid(service_id)) filter.service_id = service_id;
  if (mode === "online" || mode === "offline") filter.source_mode = mode;

  const rowsRaw = await attendanceCol
    .find(filter)
    .sort({ clock_in_at: -1 })
    .limit(300)
    .toArray();

  const memberIds = [...new Set(rowsRaw.map((r) => r.member_id))];
  const serviceIds = [...new Set(rowsRaw.map((r) => r.service_id))];
  const memberMap = new Map<string, MemberDoc & { id: string }>();
  const serviceMap = new Map<string, ServiceDoc & { id: string }>();

  if (memberIds.length) {
    serializeDocs(
      await membersCol
        .find({
          _id: {
            $in: memberIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id)),
          },
        })
        .toArray(),
    ).forEach((m) => memberMap.set(m.id, m));
  }
  if (serviceIds.length) {
    serializeDocs(
      await servicesCol
        .find({
          _id: {
            $in: serviceIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id)),
          },
        })
        .toArray(),
    ).forEach((s) => serviceMap.set(s.id, s));
  }

  const rows = rowsRaw.map((r) => {
    const m = memberMap.get(r.member_id);
    const s = serviceMap.get(r.service_id);
    return {
      id: toId(r._id),
      ...r,
      first_name: m?.first_name ?? "—",
      last_name: m?.last_name ?? "",
      member_code: m?.member_code ?? "",
      service_title: s?.title ?? "—",
    };
  });

  return (
    <div className="panel-card">
      <form method="get" className="row-actions" style={{ marginBottom: "1rem" }}>
        <select name="service_id" defaultValue={service_id}>
          <option value="">All services</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} · {new Date(s.starts_at).toLocaleDateString()}
            </option>
          ))}
        </select>
        <select name="mode" defaultValue={mode}>
          <option value="">All modes</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
        </select>
        <button className="btn btn-outline" type="submit">
          Filter
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="empty-hint">No attendance records match your filters.</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Member</th>
                <th>Service</th>
                <th>In</th>
                <th>Out</th>
                <th>Status</th>
                <th>Mode</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>
                      {r.first_name} {r.last_name}
                    </strong>
                    <div style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>
                      {r.member_code}
                    </div>
                  </td>
                  <td>{r.service_title}</td>
                  <td>
                    {r.clock_in_at ? new Date(r.clock_in_at).toLocaleString() : "—"}
                  </td>
                  <td>
                    {r.clock_out_at
                      ? new Date(r.clock_out_at).toLocaleString()
                      : "—"}
                  </td>
                  <td>{r.status}</td>
                  <td>
                    <span className={`mode-badge mode-${r.source_mode}`}>
                      {r.source_mode}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
