import { describe, expect, it } from "vitest";
import { CreateTreeNodeSchema, UpdateTreeNodeSchema } from "../worker/schemas.ts";

describe("Tree Folders & Node Movement Schemas", () => {
  it("validates creation of a folder node", () => {
    const folder = CreateTreeNodeSchema.parse({
      name: "Designs & Assets",
      type: "folder",
      parentId: null,
    });
    expect(folder.name).toBe("Designs & Assets");
    expect(folder.type).toBe("folder");
    expect(folder.parentId).toBeNull();
  });

  it("validates creation of a nested folder with parentId", () => {
    const subfolder = CreateTreeNodeSchema.parse({
      name: "Q4 Mockups",
      type: "folder",
      parentId: "folder-parent-123",
    });
    expect(subfolder.name).toBe("Q4 Mockups");
    expect(subfolder.parentId).toBe("folder-parent-123");
  });

  it("validates moving an item to a folder via UpdateTreeNodeSchema", () => {
    const movePayload = UpdateTreeNodeSchema.parse({
      parentId: "target-folder-456",
    });
    expect(movePayload.parentId).toBe("target-folder-456");
  });

  it("validates moving an item back to root (parentId: null)", () => {
    const moveToRootPayload = UpdateTreeNodeSchema.parse({
      parentId: null,
    });
    expect(moveToRootPayload.parentId).toBeNull();
  });

  it("validates file node creation with parentId", () => {
    const fileNode = CreateTreeNodeSchema.parse({
      name: "retplay.png",
      type: "file",
      parentId: "folder-marketing",
      size: 2048000,
      mimeType: "image/png",
    });
    expect(fileNode.name).toBe("retplay.png");
    expect(fileNode.type).toBe("file");
    expect(fileNode.parentId).toBe("folder-marketing");
  });
});
