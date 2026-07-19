import { requireRole } from "@/lib/session";
import { getCollection } from "@/lib/mongodb";
import type { IncomeEntryDoc, NoticeDoc, MemberDoc } from "@/lib/models";
import { serializeDocs } from "@/lib/types";
import { createIncomeEntry, createNotice } from "@/app/actions";
import { isSmsConfigured } from "@/lib/sms";

function money(amount: number, currency = "GHS") {
  return `${currency} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    income?: string;
    notice?: string;
    error?: string;
    sms_sent?: string;
    sms_failed?: string;
    sms_skipped?: string;
  }>;
}) {
  await requireRole("admin", "pastor");
  const sp = await searchParams;
  const smsReady = isSmsConfigured();

  const incomes = serializeDocs(
    await (await getCollection<IncomeEntryDoc>("income_entries"))
      .find({})
      .sort({ period_start: -1, created_at: -1 })
      .limit(40)
      .toArray(),
  );

  const notices = serializeDocs(
    await (await getCollection<NoticeDoc>("notices"))
      .find({})
      .sort({ created_at: -1 })
      .limit(20)
      .toArray(),
  );

  const membersWithPhone = await (
    await getCollection<MemberDoc>("members")
  ).countDocuments({
    membership_status: "active",
    phone: { $exists: true, $nin: [null, ""] },
  });

  const today = new Date().toISOString().slice(0, 10);

  const dayTotal = incomes
    .filter((i) => i.period === "day")
    .slice(0, 10)
    .reduce((s, i) => s + Number(i.amount || 0), 0);
  const weekTotal = incomes
    .filter((i) => i.period === "week")
    .slice(0, 10)
    .reduce((s, i) => s + Number(i.amount || 0), 0);

  return (
    <div>
      {sp.income && (
        <div className="alert alert-success">Income entry saved.</div>
      )}
      {sp.notice && (
        <div className="alert alert-success">
          Notice posted to Users page
          {sp.sms_sent || sp.sms_failed || sp.sms_skipped
            ? ` · SMS sent ${sp.sms_sent ?? 0}, failed ${sp.sms_failed ?? 0}, skipped ${sp.sms_skipped ?? 0}`
            : ""}
          .
        </div>
      )}
      {sp.error === "income" && (
        <div className="alert alert-error">
          Check activity title, date, and amount.
        </div>
      )}
      {sp.error === "notice" && (
        <div className="alert alert-error">Title and message are required.</div>
      )}

      <div className="stat-grid" style={{ marginBottom: "1rem" }}>
        <div className="stat-card">
          <div className="label">Recent day entries (sum)</div>
          <p className="value">{money(dayTotal)}</p>
        </div>
        <div className="stat-card">
          <div className="label">Recent week entries (sum)</div>
          <p className="value">{money(weekTotal)}</p>
        </div>
        <div className="stat-card">
          <div className="label">Members with phone</div>
          <p className="value">{membersWithPhone}</p>
        </div>
        <div className="stat-card">
          <div className="label">SMS gateway</div>
          <p className="value" style={{ fontSize: "1.1rem" }}>
            {smsReady ? "Twilio ready" : "Not configured"}
          </p>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: "1rem" }}>
        <div className="panel-card">
          <h2>Record income</h2>
          <p className="empty-hint" style={{ marginBottom: "1rem" }}>
            Log offering or activity income for a day or week.
          </p>
          <form action={createIncomeEntry}>
            <div className="field">
              <label>Period</label>
              <select name="period" defaultValue="day" required>
                <option value="day">Day</option>
                <option value="week">Week</option>
              </select>
            </div>
            <div className="field">
              <label>Date (day, or any day in the week)</label>
              <input
                name="period_date"
                type="date"
                required
                defaultValue={today}
              />
            </div>
            <div className="field">
              <label>Event / activity title</label>
              <input
                name="activity_title"
                required
                placeholder="e.g. Sunday thanksgiving offering"
              />
            </div>
            <div className="field">
              <label>Type</label>
              <select name="activity_type" defaultValue="offering">
                <option value="offering">Offering</option>
                <option value="event">Event</option>
                <option value="activity">Activity</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="field">
              <label>Amount (GHS)</label>
              <input
                name="amount"
                type="number"
                min="0"
                step="0.01"
                required
                placeholder="0.00"
              />
            </div>
            <div className="field">
              <label>Notes</label>
              <textarea name="notes" rows={2} placeholder="Optional" />
            </div>
            <button className="btn btn-accent" type="submit">
              Save income
            </button>
          </form>
        </div>

        <div className="panel-card">
          <h2>Send notice</h2>
          <p className="empty-hint" style={{ marginBottom: "1rem" }}>
            Posts on the Users page. Optionally SMS all active members with a
            phone number ({membersWithPhone} ready).
          </p>
          {!smsReady && (
            <div className="alert alert-info">
              Add Twilio env vars to send SMS:{" "}
              <code>TWILIO_ACCOUNT_SID</code>, <code>TWILIO_AUTH_TOKEN</code>,{" "}
              <code>TWILIO_FROM_NUMBER</code>.
            </div>
          )}
          <form action={createNotice}>
            <div className="field">
              <label>Title</label>
              <input name="title" required placeholder="Notice title" />
            </div>
            <div className="field">
              <label>Message</label>
              <textarea
                name="body"
                rows={4}
                required
                placeholder="Write the notice for staff and members…"
              />
            </div>
            <label
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <input type="checkbox" name="send_sms" value="1" defaultChecked />
              Also SMS all members with phone numbers
            </label>
            <button className="btn btn-accent" type="submit">
              Post notice
            </button>
          </form>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel-card">
          <h2>Income log</h2>
          {incomes.length === 0 ? (
            <p className="empty-hint">No income entries yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Activity</th>
                    <th>Amount</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {incomes.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <span className="badge badge-ok">{row.period}</span>
                        <div className="empty-hint">
                          {new Date(row.period_start).toLocaleDateString()}
                        </div>
                      </td>
                      <td>
                        <strong>{row.activity_title}</strong>
                        <div className="empty-hint">{row.activity_type}</div>
                      </td>
                      <td>{money(Number(row.amount), row.currency || "GHS")}</td>
                      <td>
                        {new Date(row.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel-card">
          <h2>Recent notices</h2>
          {notices.length === 0 ? (
            <p className="empty-hint">No notices yet.</p>
          ) : (
            <ul className="notice-list">
              {notices.map((n) => (
                <li key={n.id} className="notice-item">
                  <strong>{n.title}</strong>
                  <p>{n.body}</p>
                  <p className="empty-hint">
                    {n.created_by_name} ·{" "}
                    {new Date(n.created_at).toLocaleString()}
                    {n.sms_requested
                      ? ` · SMS ${n.sms_sent} sent / ${n.sms_failed} failed / ${n.sms_skipped} skipped`
                      : " · No SMS"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
