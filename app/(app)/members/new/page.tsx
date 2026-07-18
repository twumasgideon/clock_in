import { requireRole } from "@/lib/session";
import { createMember } from "@/app/actions";
import Link from "next/link";

export default async function NewMemberPage() {
  await requireRole("admin", "officer");

  return (
    <div className="panel-card" style={{ maxWidth: 720 }}>
      <h2>Register member</h2>
      <p className="empty-hint">
        Enrollment is online-only. Kiosks pull roster when connected.
      </p>
      <form action={createMember}>
        <div className="grid-2">
          <div className="field">
            <label>Member code</label>
            <input name="member_code" placeholder="Auto if blank" />
          </div>
          <div className="field">
            <label>Gender</label>
            <select name="gender" defaultValue="">
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="field">
            <label>First name *</label>
            <input name="first_name" required />
          </div>
          <div className="field">
            <label>Last name *</label>
            <input name="last_name" required />
          </div>
          <div className="field">
            <label>Other names</label>
            <input name="other_names" />
          </div>
          <div className="field">
            <label>Phone</label>
            <input name="phone" />
          </div>
          <div className="field">
            <label>Email</label>
            <input name="email" type="email" />
          </div>
          <div className="field">
            <label>Address</label>
            <input name="address" />
          </div>
        </div>
        <div className="field">
          <label>Notes</label>
          <textarea name="notes" rows={2} />
        </div>
        <div className="row-actions">
          <button className="btn btn-accent" type="submit">
            Save member
          </button>
          <Link href="/members" className="btn btn-outline">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
