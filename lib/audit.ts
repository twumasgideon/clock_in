import { getCollection } from "./mongodb";
import type { AuditLogDoc } from "./models";

export async function writeAudit(input: {
  actor_user_id?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  meta?: Record<string, unknown> | null;
}) {
  try {
    const logs = await getCollection<AuditLogDoc>("audit_logs");
    await logs.insertOne({
      actor_user_id: input.actor_user_id ?? null,
      actor_device_id: null,
      action: input.action,
      entity_type: input.entity_type ?? null,
      entity_id: input.entity_id ?? null,
      meta: input.meta ?? null,
      ip_address: null,
      created_at: new Date(),
    });
  } catch {
    // never break request for audit
  }
}
