"use client";

type MemberRow = {
  id: string;
  member_code: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  status?: string;
  clock_in_at?: string | null;
};

function waLink(phone: string | null): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("0") && d.length === 10) d = `233${d.slice(1)}`;
  if (!d) return null;
  return `https://wa.me/${d}`;
}

export function FollowUpLists({
  present,
  absent,
}: {
  present: MemberRow[];
  absent: MemberRow[];
}) {
  function copyPhones(rows: MemberRow[], label: string) {
    const lines = rows
      .filter((r) => r.phone)
      .map(
        (r) =>
          `${r.first_name} ${r.last_name} (${r.member_code}): ${r.phone}`,
      );
    const text = `${label}\n${lines.join("\n")}`;
    void navigator.clipboard.writeText(text);
    alert(`Copied ${lines.length} phone number(s) for ${label}.`);
  }

  return (
    <div className="grid-2">
      <div className="panel-card followup-panel present">
        <div className="followup-panel-head">
          <h2>Present ({present.length})</h2>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => copyPhones(present, "Present")}
          >
            Copy phones
          </button>
        </div>
        {present.length === 0 ? (
          <p className="empty-hint">No clock-ins for this service yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Phone</th>
                  <th>Call</th>
                </tr>
              </thead>
              <tbody>
                {present.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <strong>
                        {m.first_name} {m.last_name}
                      </strong>
                      <div className="empty-hint">{m.member_code}</div>
                    </td>
                    <td>{m.phone || "—"}</td>
                    <td>
                      {m.phone ? (
                        <span className="row-actions">
                          <a className="btn btn-outline btn-sm" href={`tel:${m.phone}`}>
                            Call
                          </a>
                          {waLink(m.phone) && (
                            <a
                              className="btn btn-outline btn-sm"
                              href={waLink(m.phone)!}
                              target="_blank"
                              rel="noreferrer"
                            >
                              WhatsApp
                            </a>
                          )}
                        </span>
                      ) : (
                        <span className="badge badge-muted">No phone</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel-card followup-panel absent">
        <div className="followup-panel-head">
          <h2>Absent — follow up ({absent.length})</h2>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => copyPhones(absent, "Absent")}
          >
            Copy phones
          </button>
        </div>
        {absent.length === 0 ? (
          <p className="empty-hint">Everyone registered was present. Great!</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Phone</th>
                  <th>Follow up</th>
                </tr>
              </thead>
              <tbody>
                {absent.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <strong>
                        {m.first_name} {m.last_name}
                      </strong>
                      <div className="empty-hint">{m.member_code}</div>
                    </td>
                    <td>{m.phone || "—"}</td>
                    <td>
                      {m.phone ? (
                        <span className="row-actions">
                          <a className="btn btn-accent btn-sm" href={`tel:${m.phone}`}>
                            Call
                          </a>
                          {waLink(m.phone) && (
                            <a
                              className="btn btn-outline btn-sm"
                              href={waLink(m.phone)!}
                              target="_blank"
                              rel="noreferrer"
                            >
                              WhatsApp
                            </a>
                          )}
                        </span>
                      ) : (
                        <span className="badge badge-muted">No phone</span>
                      )}
                    </td>
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
