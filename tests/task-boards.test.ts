import { describe, expect, it } from "vitest";
import {
  CreateTaskBoardSchema,
  UpdateTaskBoardSchema,
  TaskBoardColumnSchema,
  TaskItemSchema,
} from "../worker/schemas.ts";

describe("Task Board Schemas & Settings", () => {
  it("validates a standard TaskBoardColumn with WIP limits", () => {
    const col = TaskBoardColumnSchema.parse({
      id: "in-progress",
      title: "In Progress",
      color: "#1E7D6B",
      wipLimit: 5,
    });
    expect(col.id).toBe("in-progress");
    expect(col.title).toBe("In Progress");
    expect(col.wipLimit).toBe(5);
  });

  it("rejects invalid WIP limits (negative or zero)", () => {
    expect(() =>
      TaskBoardColumnSchema.parse({
        id: "test",
        title: "Test",
        wipLimit: 0,
      })
    ).toThrow();

    expect(() =>
      TaskBoardColumnSchema.parse({
        id: "test",
        title: "Test",
        wipLimit: -1,
      })
    ).toThrow();
  });

  it("validates CreateTaskBoardSchema with all custom board settings", () => {
    const board = CreateTaskBoardSchema.parse({
      name: "  Sprint 42 Alpha  ",
      description: "Deliver core platform features",
      icon: "🚀",
      color: "#1E7D6B",
      defaultView: "board",
      defaultPriority: "high",
      columns: [
        { id: "backlog", title: "Backlog" },
        { id: "dev", title: "Developing", wipLimit: 3 },
        { id: "done", title: "Shipped" },
      ],
    });

    expect(board.name).toBe("Sprint 42 Alpha");
    expect(board.icon).toBe("🚀");
    expect(board.color).toBe("#1E7D6B");
    expect(board.defaultView).toBe("board");
    expect(board.defaultPriority).toBe("high");
    expect(board.columns).toHaveLength(3);
    expect(board.columns?.[1].wipLimit).toBe(3);
  });

  it("validates UpdateTaskBoardSchema with partial updates", () => {
    const partialUpdate = UpdateTaskBoardSchema.parse({
      description: "Updated description",
      defaultView: "table",
    });

    expect(partialUpdate.description).toBe("Updated description");
    expect(partialUpdate.defaultView).toBe("table");
    expect(partialUpdate.name).toBeUndefined();
  });

  it("allows TaskItem on custom column statuses", () => {
    const taskOnCustomColumn = TaskItemSchema.parse({
      id: "task-custom-1",
      title: "Review PR #123",
      status: "code-review",
      priority: "urgent",
      type: "improvement",
      assignee: {
        name: "Ardon",
        email: "ardon@example.com",
      },
      tags: ["#frontend"],
    });

    expect(taskOnCustomColumn.status).toBe("code-review");
    expect(taskOnCustomColumn.title).toBe("Review PR #123");
  });

  it("rejects empty task status or empty task title", () => {
    expect(() =>
      TaskItemSchema.parse({
        id: "t-1",
        title: "",
        status: "todo",
      })
    ).toThrow();

    expect(() =>
      TaskItemSchema.parse({
        id: "t-2",
        title: "Valid title",
        status: "",
      })
    ).toThrow();
  });
});
