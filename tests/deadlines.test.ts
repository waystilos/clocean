import { describe, it, expect } from "vitest";

const BASE_URL = "http://127.0.0.1:8787";

describe("Sprint Task Deadlines & Email Alert Engine", () => {
  const testEmail = `deadline-user-${Date.now()}@clocean.co`;

  it("should scan tasks and identify tasks approaching deadline within 48h", async () => {
    // 1. Put tasks: one due tomorrow, one due in 30 days, one completed
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowIso = tomorrow.toISOString().split("T")[0]; // YYYY-MM-DD

    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);
    const nextMonthIso = nextMonth.toISOString().split("T")[0];

    const tasksPayload = [
      {
        id: "task-urgent-deadline",
        title: "Submit Cloudflare Security Audit",
        status: "todo",
        priority: "high",
        dueDate: tomorrowIso,
        assignee: {
          name: "Security Lead",
          email: testEmail,
        },
      },
      {
        id: "task-future",
        title: "Q4 Edge Strategy",
        status: "todo",
        priority: "low",
        dueDate: nextMonthIso,
        assignee: {
          name: "Security Lead",
          email: testEmail,
        },
      },
    ];

    const putRes = await fetch(`${BASE_URL}/api/tasks`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-user-email": testEmail,
      },
      body: JSON.stringify(tasksPayload),
    });
    expect(putRes.status).toBe(200);

    // 2. Call /api/tasks/check-deadlines
    const checkRes = await fetch(`${BASE_URL}/api/tasks/check-deadlines`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-email": testEmail,
      },
    });

    expect(checkRes.status).toBe(200);
    const checkData: any = await checkRes.json();
    expect(checkData.success).toBe(true);
    expect(checkData.alertedCount).toBeGreaterThanOrEqual(1);

    const alertedIds = checkData.alertedTasks.map((t: any) => t.id);
    expect(alertedIds).toContain("task-urgent-deadline");
    expect(alertedIds).not.toContain("task-future");

    // 3. Verify notification was recorded in user notifications
    const notifRes = await fetch(`${BASE_URL}/api/notifications`, {
      headers: { "x-user-email": testEmail },
    });
    expect(notifRes.status).toBe(200);
    const notifs = await notifRes.json();
    const hasDeadlineAlert = notifs.some(
      (n: any) => n.type === "deadline" && n.taskId === "task-urgent-deadline"
    );
    expect(hasDeadlineAlert).toBe(true);
  });
});
