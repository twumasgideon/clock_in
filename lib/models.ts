import { ObjectId } from "mongodb";
import type { Role } from "./types";

export type UserDoc = {
  _id?: ObjectId;
  email: string;
  password_hash: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  member_id?: string | null;
  last_login_at?: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type MemberDoc = {
  _id?: ObjectId;
  member_code: string;
  first_name: string;
  last_name: string;
  other_names?: string | null;
  gender?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  membership_status: "active" | "inactive" | "transferred" | "deceased";
  enrolled_face: boolean;
  enrolled_fingerprint: boolean;
  face_template_ref?: string | null;
  face_descriptor?: number[] | null;
  fingerprint_template_ref?: string | null;
  fingerprint_descriptor?: number[] | null;
  notes?: string | null;
  created_at: Date;
  updated_at: Date;
  synced_at?: Date | null;
};

export type ServiceDoc = {
  _id?: ObjectId;
  title: string;
  service_type: "sunday" | "midweek" | "special" | "event";
  location?: string | null;
  starts_at: Date;
  ends_at?: Date | null;
  late_after_minutes: number;
  is_active: boolean;
  notes?: string | null;
  created_at: Date;
  updated_at: Date;
};

export type AttendanceDoc = {
  _id?: ObjectId;
  member_id: string;
  service_id: string;
  clock_in_at?: Date | null;
  clock_out_at?: Date | null;
  status: "present" | "late" | "absent" | "partial";
  verify_method: string;
  source_mode: "online" | "offline";
  device_id?: string | null;
  client_event_id?: string | null;
  synced_from_offline: boolean;
  notes?: string | null;
  created_at: Date;
  updated_at: Date;
};

export type DeviceDoc = {
  _id?: ObjectId;
  device_code: string;
  name: string;
  location?: string | null;
  device_token_hash: string;
  mode: "online" | "offline" | "syncing";
  last_seen_at?: Date | null;
  last_sync_at?: Date | null;
  roster_version?: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

export type SyncQueueDoc = {
  _id?: ObjectId;
  device_id: string;
  client_event_id: string;
  event_type: "clock_in" | "clock_out" | "heartbeat" | "roster_ack";
  payload: Record<string, unknown>;
  status: "pending" | "processing" | "synced" | "failed" | "duplicate";
  attempts: number;
  last_error?: string | null;
  device_timestamp: Date;
  received_at: Date;
  synced_at?: Date | null;
};

export type AuditLogDoc = {
  _id?: ObjectId;
  actor_user_id?: string | null;
  actor_device_id?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  meta?: Record<string, unknown> | null;
  ip_address?: string | null;
  created_at: Date;
};
