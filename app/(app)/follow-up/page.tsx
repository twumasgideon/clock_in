import { requireRole } from "@/lib/session";
import {
  buildFollowUpReport,
  findLatestFollowUpService,
  listRecentServices,
} from "@/lib/follow-up";
import { FollowUpLists } from "@/components/FollowUpLists";

export default async function FollowUpPage({
  searchParams,
}: {
  searchParams: Promise<{ service_id?: string }>;
}) {
  await requireRole("admin", "officer", "pastor");
  const { service_id } = await searchParams;

  const services = await listRecentServices(40);
  const latest = await findLatestFollowUpService();
  const selectedId = service_id || latest?.id || services[0]?.id || "";

  const report = selectedId ? await buildFollowUpReport(selectedId) : null;

  return (
    <div>
      <div className="panel-card" style={{ marginBottom: "1rem" }}>
        <h2>After-service follow-up</h2>
        <p className="empty-hint" style={{ marginBottom: "1rem" }}>
          Registered members who were <strong>present</strong> or{" "}
          <strong>absent</strong> for a service, with phone numbers for pastoral
          follow-up.
        </p>
        <form method="get" className="row-actions">
          <select
            name="service_id"
            defaultValue={selectedId}
            style={{ minWidth: 280 }}
          >
            {services.length === 0 && <option value="">No services</option>}
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} · {new Date(s.starts_at).toLocaleString()}
              </option>
            ))}
          </select>
          <button className="btn btn-accent" type="submit">
            Load lists
          </button>
        </form>
      </div>

      {!report ? (
        <div className="panel-card">
          <p className="empty-hint">
            Schedule a service and record attendance on the kiosk, then return
            here.
          </p>
        </div>
      ) : (
        <>
          <div className="stat-grid" style={{ marginBottom: "1rem" }}>
            <div className="stat-card">
              <div className="label">Service</div>
              <p className="value" style={{ fontSize: "1.15rem" }}>
                {report.service.title}
              </p>
            </div>
            <div className="stat-card">
              <div className="label">Present</div>
              <p className="value" style={{ color: "var(--blue)" }}>
                {report.presentCount}
              </p>
            </div>
            <div className="stat-card">
              <div className="label">Absent</div>
              <p className="value" style={{ color: "#9a5b12" }}>
                {report.absentCount}
              </p>
            </div>
            <div className="stat-card">
              <div className="label">Absent with phone</div>
              <p className="value">{report.withPhoneAbsent}</p>
            </div>
          </div>

          <FollowUpLists present={report.present} absent={report.absent} />
        </>
      )}
    </div>
  );
}
