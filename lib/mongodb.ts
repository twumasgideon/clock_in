import { MongoClient, Db, Collection, Document } from "mongodb";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing MONGODB_URI environment variable");
  }
  return uri;
}

function getDbName(): string {
  return process.env.MONGODB_DATABASE || "apc_attendance";
}

function getClientPromise(): Promise<MongoClient> {
  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      const client = new MongoClient(getUri());
      global._mongoClientPromise = client.connect();
    }
    return global._mongoClientPromise;
  }
  const client = new MongoClient(getUri());
  return client.connect();
}

export async function getClient(): Promise<MongoClient> {
  return getClientPromise();
}

export async function getDb(): Promise<Db> {
  const c = await getClient();
  return c.db(getDbName());
}

export async function getCollection<T extends Document>(
  name: string,
): Promise<Collection<T>> {
  const db = await getDb();
  return db.collection<T>(name);
}

export default getClientPromise;
