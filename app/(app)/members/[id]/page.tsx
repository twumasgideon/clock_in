import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { getCollection } from "@/lib/mongodb";
import type { MemberDoc } from "@/lib/models";
import { serializeDoc } from "@/lib/types";
import { updateMember } from "@/app/actions";
import { FaceEnroll } from "@/components/FaceEnroll";
import { ThumbEnroll } from "@/components/ThumbEnroll";

export default async function EditMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin", "officer");
  const { id } = await params;
  if (!ObjectId.isValid(id)) notFound();

  const member = serializeDoc(
    await (await getCollection<MemberDoc>("members")).findOne({
      _id: new ObjectId(id),
    }),
  );
  if (!member) notFound();

  const update = updateMember.bind(null, id);
  const fullName = `${member.first_name} ${member.last_name}`;

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="panel-card">
        <h2>Edit member</h2>
        <p className="empty-hint">
          Code: <strong>{member.member_code}</strong>
        </p>
        <form action={update}>
          <div className="grid-2">
            <div className="field">
              <label>First name *</label>
              <input name="first_name" required defaultValue={member.first_name} />
            </div>
            <div className="field">
              <label>Last name *</label>
              <input name="last_name" required defaultValue={member.last_name} />
            </div>
            <div className="field">
              <label>Other names</label>
              <input name="other_names" defaultValue={member.other_names ?? ""} />
            </div>
            <div className="field">
              <label>Gender</label>
              <select name="gender" defaultValue={member.gender ?? ""}>
                <option value="">—</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="field">
              <label>Status</label>
              <select
                name="membership_status"
                defaultValue={member.membership_status}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="transferred">Transferred</option>
                <option value="deceased">Deceased</option>
              </select>
            </div>
            <div className="field">
              <label>Phone</label>
              <input name="phone" defaultValue={member.phone ?? ""} />
            </div>
            <div className="field">
              <label>Email</label>
              <input name="email" type="email" defaultValue={member.email ?? ""} />
            </div>
            <div className="field">
              <label>Address</label>
              <input name="address" defaultValue={member.address ?? ""} />
            </div>
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea name="notes" rows={2} defaultValue={member.notes ?? ""} />
          </div>
          <div className="row-actions">
            <button className="btn btn-accent" type="submit">
              Save changes
            </button>
            <Link href="/members" className="btn btn-outline">
              Back
            </Link>
          </div>
        </form>
      </div>

      <FaceEnroll
        memberId={id}
        enrolled={Boolean(member.enrolled_face && member.face_descriptor?.length)}
        memberName={fullName}
      />

      <ThumbEnroll
        memberId={id}
        enrolled={Boolean(
          member.enrolled_fingerprint && member.fingerprint_descriptor?.length,
        )}
        memberName={fullName}
      />
    </div>
  );
}
