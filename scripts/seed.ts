import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

async function main() {
  const { getCollection, getDb } = await import("../lib/mongodb");
  type DeviceDoc = import("../lib/models").DeviceDoc;
  type ServiceDoc = import("../lib/models").ServiceDoc;
  type UserDoc = import("../lib/models").UserDoc;

  console.log("Seeding MongoDB…");
  const db = await getDb();

  await db.collection("users").createIndexes([
    { key: { email: 1 }, unique: true },
    { key: { role: 1 } },
  ]);
  await db.collection("members").createIndexes([
    { key: { member_code: 1 }, unique: true },
    { key: { last_name: 1, first_name: 1 } },
    { key: { membership_status: 1 } },
  ]);
  await db.collection("services").createIndexes([
    { key: { starts_at: -1 } },
    { key: { is_active: 1, starts_at: 1 } },
  ]);
  await db.collection("attendance").createIndexes([
    { key: { member_id: 1, service_id: 1 }, unique: true },
    { key: { client_event_id: 1 }, unique: true, sparse: true },
    { key: { clock_in_at: -1 } },
  ]);
  await db.collection("devices").createIndexes([
    { key: { device_code: 1 }, unique: true },
  ]);
  await db.collection("sync_queue").createIndexes([
    { key: { device_id: 1, client_event_id: 1 }, unique: true },
    { key: { status: 1 } },
  ]);
  await db.collection("audit_logs").createIndexes([
    { key: { created_at: -1 } },
  ]);
  console.log("Indexes ready");

  const users = await getCollection<UserDoc>("users");
  const email = "admin@kasse.church";
  const password = "Admin@12345";
  const hash = await bcrypt.hash(password, 10);
  const now = new Date();

  const existing = await users.findOne({ email });
  if (existing) {
    await users.updateOne(
      { _id: existing._id },
      {
        $set: {
          password_hash: hash,
          full_name: "System Administrator",
          role: "admin",
          is_active: true,
          updated_at: now,
        },
      },
    );
  } else {
    await users.insertOne({
      email,
      password_hash: hash,
      full_name: "System Administrator",
      role: "admin",
      is_active: true,
      member_id: null,
      last_login_at: null,
      created_at: now,
      updated_at: now,
    });
  }
  console.log(`Admin: ${email} / ${password}`);

  const services = await getCollection<ServiceDoc>("services");
  if ((await services.countDocuments()) === 0) {
    const sunday = new Date();
    sunday.setDate(sunday.getDate() + ((7 - sunday.getDay()) % 7));
    sunday.setHours(9, 0, 0, 0);
    const midweek = new Date();
    const day = midweek.getDay();
    const add = (3 - day + 7) % 7;
    midweek.setDate(midweek.getDate() + add);
    midweek.setHours(18, 0, 0, 0);

    await services.insertMany([
      {
        title: "Sunday Morning Service",
        service_type: "sunday",
        location: "Main Auditorium",
        starts_at: sunday,
        ends_at: new Date(sunday.getTime() + 3 * 60 * 60 * 1000),
        late_after_minutes: 15,
        is_active: true,
        notes: null,
        created_at: now,
        updated_at: now,
      },
      {
        title: "Midweek Bible Study",
        service_type: "midweek",
        location: "Fellowship Hall",
        starts_at: midweek,
        ends_at: new Date(midweek.getTime() + 2 * 60 * 60 * 1000),
        late_after_minutes: 10,
        is_active: true,
        notes: null,
        created_at: now,
        updated_at: now,
      },
    ]);
    console.log("Seeded sample services");
  }

  const devices = await getCollection<DeviceDoc>("devices");
  if ((await devices.countDocuments()) === 0) {
    const token = "dev-token-change-me";
    await devices.insertOne({
      device_code: "KIOSK-MAIN-01",
      name: "Main Entrance Kiosk",
      location: "Main Auditorium Entrance",
      device_token_hash: createHash("sha256").update(token).digest("hex"),
      mode: "online",
      last_seen_at: null,
      last_sync_at: null,
      roster_version: null,
      is_active: true,
      created_at: now,
      updated_at: now,
    });
    console.log(`Seeded kiosk KIOSK-MAIN-01 (token: ${token})`);
  }

  console.log("Done.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
