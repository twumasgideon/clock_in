import Link from "next/link";
import { requireRole } from "@/lib/session";
import { getCollection } from "@/lib/mongodb";
import type { MemberDoc } from "@/lib/models";
import { serializeDocs } from "@/lib/types";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireRole("admin", "officer");
  const { q = "" } = await searchParams;
  const membersCol = await getCollection<MemberDoc>("members");

  const filter = q
    ? {
        $or: [
          { first_name: { $regex: q, $options: "i" } },
          { last_name: { $regex: q, $options: "i" } },
          { member_code: { $regex: q, $options: "i" } },
          { phone: { $regex: q, $options: "i" } },
          { email: { $regex: q, $options: "i" } },
        ],
      }
    : {};

  const members = serializeDocs(
    await membersCol.find(filter).sort({ created_at: -1 }).limit(200).toArray(),
  );

  return (
    <div className="panel-card">
      <div
        className="row-actions"
        style={{ justifyContent: "space-between", marginBottom: "1rem" }}
      >
        <form className="row-actions" method="get">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search members…"
            style={{
              border: "1px solid var(--line)",
              borderRadius: 8,
              padding: "0.5rem 0.75rem",
            }}
          />
          <button className="btn btn-outline" type="submit">
            Search
          </button>
        </form>
        <Link href="/members/new" className="btn btn-accent">
          Register member
        </Link>
      </div>

      {members.length === 0 ? (
        <p className="empty-hint">No members yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Biometrics</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>{m.member_code}</td>
                  <td>
                    <strong>
                      {m.first_name} {m.last_name}
                    </strong>
                  </td>
                  <td>
                    <div>{m.phone || "—"}</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>
                      {m.email || ""}
                    </div>
                  </td>
                  <td>{m.membership_status}</td>
                  <td>
                    <span className={`badge ${m.enrolled_face ? "badge-ok" : "badge-muted"}`}>
                      Face
                    </span>{" "}
                    <span
                      className={`badge ${m.enrolled_fingerprint ? "badge-ok" : "badge-muted"}`}
                    >
                      Print
                    </span>
                  </td>
                  <td>
                    <Link href={`/members/${m.id}`} className="btn btn-outline btn-sm">
                      Edit
                    </Link>
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
