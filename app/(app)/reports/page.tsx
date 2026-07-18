import Link from "next/link";
import { requireRole } from "@/lib/session";
import { getCollection } from "@/lib/mongodb";
import type { AttendanceDoc, ServiceDoc } from "@/lib/models";
import { serializeDocs } from "@/lib/types";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireRole("admin", "officer", "pastor");
  const params = await searchParams;
  const from = params.from ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const to = params.to ?? new Date().toISOString().slice(0, 10);

  const fromDt = new Date(`${from}T00:00:00`);
  const toDt = new Date(`${to}T23:59:59`);

  const services = serializeDocs(
    await (await getCollection<ServiceDoc>("services"))
      .find({ starts_at: { $gte: fromDt, $lte: toDt } })
      .sort({ starts_at: -1 })
      .toArray(),
  );

  const attendance = await getCollection<AttendanceDoc>("attendance");
  const byService = [];
  for (const svc of services) {
    const rows = await attendance.find({ service_id: svc.id }).toArray();
    byService.push({
      title: svc.title,
      starts_at: svc.starts_at,
      total: rows.length,
      present_count: rows.filter((r) => r.status === "present").length,
      late_count: rows.filter((r) => r.status === "late").length,
      offline_count: rows.filter((r) => r.source_mode === "offline").length,
      synced_count: rows.filter((r) => r.synced_from_offline).length,
    });
  }

  return (
    <div className="panel-card">
      <form method="get" className="row-actions" style={{ marginBottom: "1rem" }}>
        <div className="field" style={{ margin: 0 }}>
          <label>From</label>
          <input type="date" name="from" defaultValue={from} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>To</label>
          <input type="date" name="to" defaultValue={to} />
        </div>
        <button className="btn btn-outline" type="submit">
          Run
        </button>
        <Link
          href={`/api/reports/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`}
          className="btn btn-accent"
        >
          Export CSV
        </Link>
      </form>

      {byService.length === 0 ? (
        <p className="empty-hint">No services in this date range.</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Service</th>
                <th>Date</th>
                <th>Total</th>
                <th>Present</th>
                <th>Late</th>
                <th>Offline</th>
                <th>Synced</th>
              </tr>
            </thead>
            <tbody>
              {byService.map((row, i) => (
                <tr key={i}>
                  <td>
                    <strong>{row.title}</strong>
                  </td>
                  <td>{new Date(row.starts_at).toLocaleDateString()}</td>
                  <td>{row.total}</td>
                  <td>{row.present_count}</td>
                  <td>{row.late_count}</td>
                  <td>{row.offline_count}</td>
                  <td>{row.synced_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
