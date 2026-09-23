import { DatabaseProperty, DatabaseRecord, DatabaseSchema } from "../types.ts";
import { R2Database } from "./r2Db.ts";

const MAX_RECORDS = 5000;
const MAX_PROPERTY_VALUE_BYTES = 10_000;
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export class DatabaseConflictError extends Error {}
export class DatabaseValidationError extends Error {}

type RecordFile = { records: DatabaseRecord[] };

function key(workspaceId: string, databaseId: string, suffix: string) {
  return `workspaces/${workspaceId}/databases/${databaseId}/${suffix}.json`;
}

export function validateDatabaseProperties(properties: Record<string, unknown>, schema: DatabaseProperty[]) {
  const allowed = new Map(schema.map((property) => [property.id, property]));
  for (const [id, value] of Object.entries(properties)) {
    if (FORBIDDEN_KEYS.has(id) || !allowed.has(id)) throw new DatabaseValidationError("Unknown or unsafe database property");
    const property = allowed.get(id)!;
    // Null explicitly clears a cell; unknown/unsafe keys are still rejected above.
    if (value === null) continue;
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new DatabaseValidationError(`${property.name} has an invalid value`);
    if (serialized.length > MAX_PROPERTY_VALUE_BYTES) throw new DatabaseValidationError("Database property value is too large");
    if (property.type === "text" && typeof value !== "string") throw new DatabaseValidationError(`${property.name} must be text`);
    if (property.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) throw new DatabaseValidationError(`${property.name} must be a finite number`);
    if (property.type === "checkbox" && typeof value !== "boolean") throw new DatabaseValidationError(`${property.name} must be boolean`);
    if (property.type === "date" && (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))) throw new DatabaseValidationError(`${property.name} must be an ISO date`);
    if (property.type === "url" && (typeof value !== "string" || !/^https?:\/\//i.test(value))) throw new DatabaseValidationError(`${property.name} must be an HTTP(S) URL`);
    if (property.type === "select" && (typeof value !== "string" || !property.options?.includes(value))) throw new DatabaseValidationError(`${property.name} has an invalid option`);
    if (property.type === "multi_select" && (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !property.options?.includes(item)))) throw new DatabaseValidationError(`${property.name} has invalid options`);
    if (property.type === "person" && (typeof value !== "string" || !/^\S+@\S+\.\S+$/.test(value))) throw new DatabaseValidationError(`${property.name} must be an email`);
  }
}

export function filterAndSortDatabaseRecords(records: DatabaseRecord[], schema: DatabaseSchema, query?: string, sort?: string, direction: "asc" | "desc" = "asc") {
  const normalized = query?.trim().toLowerCase();
  const property = sort && schema.properties.find((item) => item.id === sort);
  const filtered = normalized ? records.filter((record) => `${record.title} ${Object.values(record.properties).flat().join(" ")}`.toLowerCase().includes(normalized)) : [...records];
  if (!property && sort !== "title") return filtered;
  const result = filtered.sort((a, b) => {
    const left = sort === "title" ? a.title : String(a.properties[sort!] ?? "");
    const right = sort === "title" ? b.title : String(b.properties[sort!] ?? "");
    return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }) * (direction === "desc" ? -1 : 1);
  });
  return result;
}

export class DatabaseStore {
  constructor(private readonly db: R2Database) {}

  async list(workspaceId: string) {
    const result = await this.db.getJson<{ databases: DatabaseSchema[] }>(`workspaces/${workspaceId}/databases/index.json`);
    return result.data?.databases ?? [];
  }

  async getSchema(workspaceId: string, databaseId: string) {
    // The registry is authoritative, so list and record validation observe the same schema.
    return (await this.list(workspaceId)).find((database) => database.id === databaseId) ?? null;
  }

  async create(workspaceId: string, name: string, properties: DatabaseProperty[], actor: string): Promise<DatabaseSchema> {
    const id = `db-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const schema: DatabaseSchema = { id, workspaceId, name, properties, createdAt: now, updatedAt: now };
    const result = await this.db.putJson(key(workspaceId, id, "schema"), schema);
    if (!result.ok) throw new Error("Failed to create database");
    const records = await this.db.putJson<RecordFile>(key(workspaceId, id, "records"), { records: [] });
    if (!records.ok) throw new Error("Failed to initialize database records");
    const indexKey = `workspaces/${workspaceId}/databases/index.json`;
    const index = await this.db.getJson<{ databases: DatabaseSchema[] }>(indexKey);
    const updatedIndex = [...(index.data?.databases ?? []), schema];
    const indexResult = await this.db.putJson(indexKey, { databases: updatedIndex }, index.etag ?? undefined);
    if (!indexResult.ok) throw new DatabaseConflictError("Workspace databases changed; reload and try again");
    return schema;
  }

  async update(workspaceId: string, databaseId: string, name: string, properties: DatabaseProperty[]) {
    const indexKey = `workspaces/${workspaceId}/databases/index.json`;
    const index = await this.db.getJson<{ databases: DatabaseSchema[] }>(indexKey);
    const currentSchema = index.data?.databases.find((database) => database.id === databaseId);
    if (!currentSchema || !index.data) return null;
    const updated: DatabaseSchema = {
      ...currentSchema,
      name,
      properties,
      updatedAt: new Date().toISOString(),
    };
    const databases = index.data.databases.map((database) => database.id === databaseId ? updated : database);
    const indexResult = await this.db.putJson(indexKey, { databases }, index.etag ?? undefined);
    if (!indexResult.ok) throw new DatabaseConflictError("Workspace databases changed; reload and try again");
    return updated;
  }

  async listRecords(workspaceId: string, databaseId: string, query?: string, sort?: string, direction?: "asc" | "desc") {
    const schema = await this.getSchema(workspaceId, databaseId);
    if (!schema) return null;
    const result = await this.db.getJson<RecordFile>(key(workspaceId, databaseId, "records"));
    return { schema, records: filterAndSortDatabaseRecords(result.data?.records ?? [], schema, query, sort, direction) };
  }

  async createRecord(workspaceId: string, databaseId: string, payload: { title: string; properties: Record<string, unknown> }, actor: string) {
    const schema = await this.getSchema(workspaceId, databaseId);
    if (!schema) return null;
    validateDatabaseProperties(payload.properties, schema.properties);
    const current = await this.db.getJson<RecordFile>(key(workspaceId, databaseId, "records"));
    const records = current.data?.records ?? [];
    if (records.length >= MAX_RECORDS) throw new DatabaseValidationError("Database record limit reached");
    const now = new Date().toISOString();
    const record: DatabaseRecord = { id: `row-${crypto.randomUUID()}`, databaseId, title: payload.title, properties: Object.assign(Object.create(null), payload.properties), createdAt: now, updatedAt: now, createdBy: actor, updatedBy: actor };
    const result = await this.db.putJson(key(workspaceId, databaseId, "records"), { records: [...records, record] }, current.etag ?? undefined);
    if (!result.ok) throw new DatabaseConflictError("Database changed; reload and try again");
    return record;
  }

  async updateRecord(
    workspaceId: string,
    databaseId: string,
    recordId: string,
    payload: { title?: string; properties?: Record<string, unknown> },
    actor: string
  ) {
    const schema = await this.getSchema(workspaceId, databaseId);
    if (!schema) return null;
    if (payload.properties) {
      validateDatabaseProperties(payload.properties, schema.properties);
    }
    const current = await this.db.getJson<RecordFile>(key(workspaceId, databaseId, "records"));
    const records = current.data?.records ?? [];
    const index = records.findIndex((r) => r.id === recordId);
    if (index === -1) return null;

    const existing = records[index];
    const updated: DatabaseRecord = {
      ...existing,
      title: payload.title !== undefined ? payload.title : existing.title,
      properties: payload.properties ? { ...existing.properties, ...payload.properties } : existing.properties,
      updatedAt: new Date().toISOString(),
      updatedBy: actor,
    };
    records[index] = updated;

    const result = await this.db.putJson(key(workspaceId, databaseId, "records"), { records }, current.etag ?? undefined);
    if (!result.ok) throw new DatabaseConflictError("Database changed; reload and try again");
    return updated;
  }

  async deleteRecord(workspaceId: string, databaseId: string, recordId: string) {
    const current = await this.db.getJson<RecordFile>(key(workspaceId, databaseId, "records"));
    if (!current.data) return false;
    const records = current.data.records.filter((record) => record.id !== recordId);
    if (records.length === current.data.records.length) return false;
    const result = await this.db.putJson(key(workspaceId, databaseId, "records"), { records }, current.etag ?? undefined);
    if (!result.ok) throw new DatabaseConflictError("Database changed; reload and try again");
    return true;
  }

  async delete(workspaceId: string, databaseId: string): Promise<boolean> {
    const indexKey = `workspaces/${workspaceId}/databases/index.json`;
    const index = await this.db.getJson<{ databases: DatabaseSchema[] }>(indexKey);
    if (!index.data) return false;
    const filtered = index.data.databases.filter((d) => d.id !== databaseId);
    if (filtered.length === index.data.databases.length) return false;

    const indexResult = await this.db.putJson(indexKey, { databases: filtered }, index.etag ?? undefined);
    if (!indexResult.ok) throw new DatabaseConflictError("Workspace databases changed; reload and try again");

    await this.db.deleteKey(key(workspaceId, databaseId, "schema"));
    await this.db.deleteKey(key(workspaceId, databaseId, "records"));
    return true;
  }
}
