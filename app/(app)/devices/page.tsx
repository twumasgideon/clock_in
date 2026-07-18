import { requireRole } from "@/lib/session";
import { getCollection } from "@/lib/mongodb";
import type { DeviceDoc, SyncQueueDoc } from "@/lib/models";
import { serializeDocs, toId } from "@/lib/types";
import { processSyncQueue, registerDevice } from "@/app/actions";

export default async function DevicesPage({
  searchParams,
}: {
  searchParams: Promise<{ processed?: string }>;
}) {
  await requireRole("admin");
  const sp = await searchParams;

  const devices = serializeDocs(
    await (await getCollection<DeviceDoc>("devices"))
      .find({})
      .sort({ created_at: -1 })
      .toArray(),
  );

  const queueRaw = await (await getCollection<SyncQueueDoc>("sync_queue"))
    .find({})
    .sort({ received_at: -1 })
    .limit(50)
    .toArray();

  const nameMap = new Map(devices.map((d) => [d.id, d.name]));
  const queue = queueRaw.map((q) => ({
    id: toId(q._id),
    ...q,
    device_name: nameMap.get(q.device_id) ?? "Unknown",
  }));

  const pending = await (
    await getCollection<SyncQueueDoc>("sync_queue")
  ).countDocuments({ status: { $in: ["pending", "processing", "failed"] } });

  const online = devices.filter((d) => d.mode === "online" && d.is_active).length;
  const offline = devices.filter((d) => d.mode === "offline" && d.is_active).length;

  return (
    <>
      {sp.processed && (
        <div className="alert alert-success">
          Processed queue: {sp.processed} event(s) applied.
        </div>
      )}
      <div className="stat-grid" style={{ marginBottom: "1rem" }}>
        <div className="stat-card">
          <div className="label">Devices</div>
          <p className="value">{devices.length}</p>
        </div>
        <div className="stat-card">
          <div className="label">Online</div>
          <p className="value">{online}</p>
        </div>
        <div className="stat-card">
          <div className="label">Offline</div>
          <p className="value">{offline}</p>
        </div>
        <div className="stat-card">
          <div className="label">Pending queue</div>
          <p className="value">{pending}</p>
        </div>
      </div>

      <div className="grid-2">
        <div>
          <div className="panel-card" style={{ marginBottom: "1rem" }}>
            <h2>Register kiosk</h2>
            <form action={registerDevice}>
              <div className="field">
                <label>Device code</label>
                <input name="device_code" required placeholder="KIOSK-SIDE-02" />
              </div>
              <div className="field">
                <label>Name</label>
                <input name="name" required />
              </div>
              <div className="field">
                <label>Location</label>
                <input name="location" />
              </div>
              <div className="field">
                <label>Device token</label>
                <input name="device_token" required minLength={8} />
              </div>
              <button className="btn btn-accent" type="submit" style={{ width: "100%" }}>
                Register
              </button>
            </form>
          </div>
          <form action={processSyncQueue}>
            <button className="btn btn-outline" type="submit" style={{ width: "100%" }}>
              Process pending sync queue
            </button>
          </form>
        </div>

        <div>
          <div className="panel-card" style={{ marginBottom: "1rem" }}>
            <h2>Devices</h2>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Mode</th>
                    <th>Last sync</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((d) => (
                    <tr key={d.id}>
                      <td>{d.device_code}</td>
                      <td>{d.name}</td>
                      <td>
                        <span className={`mode-badge mode-${d.mode}`}>{d.mode}</span>
                      </td>
                      <td>
                        {d.last_sync_at
                          ? new Date(d.last_sync_at).toLocaleString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel-card">
            <h2>Sync queue</h2>
            {queue.length === 0 ? (
              <p className="empty-hint">Queue is empty.</p>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Device</th>
                      <th>Event</th>
                      <th>Status</th>
                      <th>Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((q) => (
                      <tr key={q.id}>
                        <td>{q.device_name}</td>
                        <td>{q.event_type}</td>
                        <td>{q.status}</td>
                        <td>{new Date(q.received_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
