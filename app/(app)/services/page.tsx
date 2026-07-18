import { requireRole } from "@/lib/session";
import { getCollection } from "@/lib/mongodb";
import type { ServiceDoc } from "@/lib/models";
import { serializeDocs } from "@/lib/types";
import { createService } from "@/app/actions";

export default async function ServicesPage() {
  const session = await requireRole("admin", "officer", "pastor");
  const canEdit = session.user.role === "admin" || session.user.role === "officer";
  const services = serializeDocs(
    await (await getCollection<ServiceDoc>("services"))
      .find({})
      .sort({ starts_at: -1 })
      .limit(100)
      .toArray(),
  );

  return (
    <div className="grid-2">
      {canEdit && (
        <div className="panel-card">
          <h2>Schedule service</h2>
          <form action={createService}>
            <div className="field">
              <label>Title</label>
              <input name="title" required />
            </div>
            <div className="field">
              <label>Type</label>
              <select name="service_type" defaultValue="sunday">
                <option value="sunday">Sunday</option>
                <option value="midweek">Midweek</option>
                <option value="special">Special</option>
                <option value="event">Event</option>
              </select>
            </div>
            <div className="field">
              <label>Location</label>
              <input name="location" placeholder="Main Auditorium" />
            </div>
            <div className="field">
              <label>Starts at</label>
              <input name="starts_at" type="datetime-local" required />
            </div>
            <div className="field">
              <label>Ends at</label>
              <input name="ends_at" type="datetime-local" />
            </div>
            <div className="field">
              <label>Late after (minutes)</label>
              <input name="late_after_minutes" type="number" defaultValue={15} min={0} />
            </div>
            <button className="btn btn-accent" type="submit" style={{ width: "100%" }}>
              Save service
            </button>
          </form>
        </div>
      )}

      <div className="panel-card" style={{ gridColumn: canEdit ? undefined : "1 / -1" }}>
        <h2>Service calendar</h2>
        {services.length === 0 ? (
          <p className="empty-hint">No services scheduled.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>When</th>
                  <th>Location</th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.title}</strong>
                    </td>
                    <td>{s.service_type}</td>
                    <td>{new Date(s.starts_at).toLocaleString()}</td>
                    <td>{s.location || "—"}</td>
                    <td>{s.is_active ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
