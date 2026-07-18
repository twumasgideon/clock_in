import { ObjectId } from "mongodb";

export type Role = "admin" | "officer" | "pastor" | "member";

export function toId(value: unknown): string {
  if (value instanceof ObjectId) return value.toHexString();
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "_id" in (value as object)) {
    return toId((value as { _id: unknown })._id);
  }
  return String(value ?? "");
}

export function asObjectId(id: string): ObjectId | null {
  if (!ObjectId.isValid(id)) return null;
  return new ObjectId(id);
}

export function serializeDoc<T extends Record<string, unknown>>(
  doc: T | null | undefined,
): (T & { id: string }) | null {
  if (!doc) return null;
  const { _id, ...rest } = doc as T & { _id?: unknown };
  return {
    ...(rest as T),
    id: toId(_id),
  };
}

export function serializeDocs<T extends Record<string, unknown>>(
  docs: T[],
): Array<T & { id: string }> {
  return docs
    .map((d) => serializeDoc(d))
    .filter((d): d is T & { id: string } => d !== null);
}

export function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    admin: "Administrator",
    officer: "Attendance Officer",
    pastor: "Pastor",
    member: "Member",
  };
  return labels[role] ?? role;
}
