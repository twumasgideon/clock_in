import { requireRole } from "@/lib/session";
import { getCollection } from "@/lib/mongodb";
import type { UserDoc } from "@/lib/models";
import { serializeDocs, roleLabel } from "@/lib/types";
import { createUser } from "@/app/actions";

export default async function UsersPage() {
  await requireRole("admin");
  const users = serializeDocs(
    await (await getCollection<UserDoc>("users"))
      .find({})
      .project({ password_hash: 0 })
      .sort({ created_at: -1 })
      .toArray(),
  );

  return (
    <div className="grid-2">
      <div className="panel-card">
        <h2>Add user</h2>
        <form action={createUser}>
          <div className="field">
            <label>Full name</label>
            <input name="full_name" required />
          </div>
          <div className="field">
            <label>Email</label>
            <input name="email" type="email" required />
          </div>
          <div className="field">
            <label>Role</label>
            <select name="role" defaultValue="officer">
              <option value="admin">Administrator</option>
              <option value="officer">Attendance Officer</option>
              <option value="pastor">Pastor</option>
              <option value="member">Member</option>
            </select>
          </div>
          <div className="field">
            <label>Password</label>
            <input name="password" type="password" required minLength={8} />
          </div>
          <button className="btn btn-accent" type="submit" style={{ width: "100%" }}>
            Create user
          </button>
        </form>
      </div>
      <div className="panel-card">
        <h2>Accounts</h2>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Active</th>
                <th>Last login</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.full_name}</td>
                  <td>{u.email}</td>
                  <td>{roleLabel(u.role)}</td>
                  <td>{u.is_active ? "Yes" : "No"}</td>
                  <td>
                    {u.last_login_at
                      ? new Date(u.last_login_at).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
