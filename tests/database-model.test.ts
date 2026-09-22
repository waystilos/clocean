import { describe, expect, it } from "vitest";
import { filterAndSortDatabaseRecords, validateDatabaseProperties } from "../worker/storage/databaseStore.ts";
import type { DatabaseRecord, DatabaseSchema } from "../worker/types.ts";

const schema: DatabaseSchema = {
  id: "db-test",
  workspaceId: "ws-test",
  name: "Roadmap",
  properties: [{ id: "status", name: "Status", type: "select", options: ["Todo", "Done"] }],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const records: DatabaseRecord[] = [
  { id: "row-1", databaseId: schema.id, title: "Zebra", properties: { status: "Todo" }, createdAt: "", updatedAt: "", createdBy: "a@example.com", updatedBy: "a@example.com" },
  { id: "row-2", databaseId: schema.id, title: "Alpha", properties: { status: "Done" }, createdAt: "", updatedAt: "", createdBy: "a@example.com", updatedBy: "a@example.com" },
];

describe("database record query seam", () => {
  it("rejects unsafe keys and values that do not match the declared type", () => {
    expect(() => validateDatabaseProperties({ constructor: "x" }, schema.properties)).toThrow("Unknown or unsafe");
    expect(() => validateDatabaseProperties({ status: "Unknown" }, schema.properties)).toThrow("invalid option");
    expect(() => validateDatabaseProperties({ status: 1 }, schema.properties)).toThrow("invalid option");
  });

  it("filters titles and property values without evaluating user input", () => {
    expect(filterAndSortDatabaseRecords(records, schema, "done").map((record) => record.id)).toEqual(["row-2"]);
    expect(filterAndSortDatabaseRecords(records, schema, "status === 'Done'")).toEqual([]);
  });

  it("sorts by title deterministically in either direction", () => {
    expect(filterAndSortDatabaseRecords(records, schema, undefined, "title").map((record) => record.title)).toEqual(["Alpha", "Zebra"]);
    expect(filterAndSortDatabaseRecords(records, schema, undefined, "title", "desc").map((record) => record.title)).toEqual(["Zebra", "Alpha"]);
  });

  it("ignores unknown sort fields instead of interpreting them", () => {
    expect(filterAndSortDatabaseRecords(records, schema, undefined, "constructor").map((record) => record.id)).toEqual(["row-1", "row-2"]);
  });
});
