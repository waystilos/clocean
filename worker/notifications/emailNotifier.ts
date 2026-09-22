import { Env, MentionNotification, UserNotificationsData, WorkspaceMember } from "../types.ts";
import { R2Database } from "../storage/r2Db.ts";

/**
 * Extracts mentioned workspace members from content or comments.
 * Supports:
 * - Direct email mentions: @elena@clocean.co
 * - Full name mentions: @Elena Rostova
 * - First name mentions: @Elena
 */
export function extractMentions(
  text: string,
  members: WorkspaceMember[],
  senderEmail?: string
): WorkspaceMember[] {
  if (!text || !members.length) return [];

  const matchedMembers = new Map<string, WorkspaceMember>();

  // 1. Direct email regex: @name@domain.com
  const emailRegex = /@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  let match;
  while ((match = emailRegex.exec(text)) !== null) {
    const email = match[1].toLowerCase();
    const found = members.find((m) => m.email.toLowerCase() === email);
    if (found && (!senderEmail || found.email.toLowerCase() !== senderEmail.toLowerCase())) {
      matchedMembers.set(found.email.toLowerCase(), found);
    }
  }

  // 2. Name mentions: @First Last or @First
  for (const member of members) {
    if (senderEmail && member.email.toLowerCase() === senderEmail.toLowerCase()) {
      continue; // Do not notify sender
    }

    const fullNamePattern = new RegExp(`@${escapeRegex(member.name)}\\b`, "i");
    const firstName = member.name.split(" ")[0];
    const firstNamePattern = new RegExp(`@${escapeRegex(firstName)}\\b`, "i");

    if (fullNamePattern.test(text) || firstNamePattern.test(text)) {
      matchedMembers.set(member.email.toLowerCase(), member);
    }
  }

  return Array.from(matchedMembers.values());
}

function escapeRegex(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Generates responsive, high-end HTML email template styled to match Figma design tokens.
 */
export function generateMentionEmailHtml(notification: MentionNotification, appUrl?: string): string {
  const baseUrl = appUrl || "http://localhost:3000";
  let targetUrl = `${baseUrl}?doc=${notification.documentId}&ws=${notification.workspaceId}`;
  let ctaText = "Open Document & Reply →";
  let actionDescription = `mentioned you in <strong>"${escapeHtml(notification.documentTitle || "Document")}"</strong>`;
  let titleText = `${notification.sender.name} mentioned you in ${notification.documentTitle || "Document"}`;

  if (notification.type === "task") {
    targetUrl = `${baseUrl}?view=tasks&ws=${notification.workspaceId}`;
    ctaText = "View Sprint Task →";
    actionDescription = `mentioned you in task <strong>"${escapeHtml(notification.taskTitle || notification.documentTitle || "Task")}"</strong>`;
    titleText = `${notification.sender.name} mentioned you in task "${notification.taskTitle || notification.documentTitle || "Task"}"`;
  } else if (notification.type === "invite") {
    targetUrl = `${baseUrl}?ws=${notification.workspaceId}`;
    ctaText = "Accept Invitation & Open Workspace →";
    const roleLabel = notification.inviteRole === "admin" ? "an Admin" : "a Member";
    actionDescription = `invited you to join <strong>"${escapeHtml(notification.workspaceName)}"</strong> as <strong>${roleLabel}</strong>`;
    titleText = `${notification.sender.name} invited you to join ${notification.workspaceName}`;
  } else if (notification.type === "test") {
    targetUrl = `${baseUrl}?ws=${notification.workspaceId}`;
    ctaText = "Open Clocean Workspace →";
    actionDescription = `sent you a <strong>verification test notification</strong>`;
    titleText = `Test notification from ${notification.sender.name}`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(titleText)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #141412; color: #E8E5E0;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #141412; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="560" style="max-width: 560px; background-color: #1C1C1A; border: 1px solid #2C2C28; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <!-- Brand Header -->
          <tr>
            <td style="padding: 24px 32px; border-bottom: 1px solid #2C2C28; background-color: #232321;">
              <span style="font-family: Georgia, serif; font-size: 20px; font-weight: 600; color: #E8E5E0; letter-spacing: -0.02em;">
                clocean
              </span>
              <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; background-color: #1E7D6B; color: #FFFFFF; padding: 3px 8px; border-radius: 10px; margin-left: 10px; font-weight: 600;">
                ${escapeHtml(notification.workspaceName)}
              </span>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px;">
              <div style="display: flex; align-items: center; margin-bottom: 20px;">
                <img src="${escapeHtml(notification.sender.avatar)}" alt="${escapeHtml(notification.sender.name)}" width="40" height="40" style="border-radius: 50%; border: 1px solid #2C2C28; margin-right: 12px; display: inline-block; vertical-align: middle;">
                <div style="display: inline-block; vertical-align: middle;">
                  <div style="font-size: 15px; font-weight: 600; color: #E8E5E0;">
                    ${escapeHtml(notification.sender.name)}
                  </div>
                  <div style="font-size: 13px; color: #8F8C85;">
                    ${actionDescription}
                  </div>
                </div>
              </div>

              <!-- Context Snippet Quote -->
              <div style="background-color: #232321; border-left: 3px solid #1E7D6B; padding: 14px 18px; border-radius: 4px; margin: 20px 0; font-size: 14px; line-height: 1.6; color: #E8E5E0; font-style: italic;">
                "${escapeHtml(notification.contextSnippet)}"
              </div>

              <!-- CTA Button -->
              <div style="margin-top: 28px; text-align: center;">
                <a href="${escapeHtml(targetUrl)}" style="display: inline-block; background-color: #1E7D6B; color: #FFFFFF; font-size: 14px; font-weight: 600; text-decoration: none; padding: 10px 24px; border-radius: 6px; box-shadow: 0 4px 12px rgba(30, 125, 107, 0.3);">
                  ${escapeHtml(ctaText)}
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #141412; border-top: 1px solid #2C2C28; text-align: center; font-size: 11px; color: #8F8C85; line-height: 1.5;">
              This notification was sent to <strong>${escapeHtml(notification.recipientEmail)}</strong> regarding your activity in <strong>${escapeHtml(notification.workspaceName)}</strong>.<br>
              Clocean Zero-Database Serverless Workspace • Powered by Cloudflare Edge & R2
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Dispatches an email notification and records the notification in Cloudflare R2.
 */
export async function dispatchMentionNotification(
  env: Env,
  db: R2Database,
  notification: MentionNotification,
  appUrl?: string
): Promise<{ success: boolean; status: "sent" | "delivered" }> {
  const html = generateMentionEmailHtml(notification, appUrl);
  let status: "sent" | "delivered" = "delivered";

  let subject = `[Clocean] ${notification.sender.name} mentioned you in "${notification.documentTitle || "Document"}"`;
  if (notification.type === "task") {
    subject = `[Clocean] ${notification.sender.name} mentioned you in task "${notification.taskTitle || notification.documentTitle || "Task"}"`;
  } else if (notification.type === "invite") {
    const roleLabel = notification.inviteRole === "admin" ? "an Admin" : "a Member";
    subject = `[Clocean] ${notification.sender.name} invited you to join "${notification.workspaceName}" as ${roleLabel}`;
  } else if (notification.type === "test") {
    subject = `[Clocean] Verification test notification from ${notification.sender.name}`;
  }

  // 1. Production Option: Cloudflare Email Routing / send_email binding
  if (env.SEND_EMAIL && typeof env.SEND_EMAIL.send === "function") {
    try {
      await env.SEND_EMAIL.send({
        to: notification.recipientEmail,
        from: env.EMAIL_FROM || "notifications@clocean.co",
        subject,
        html,
      });
      status = "sent";
    } catch (err) {
      console.warn("Cloudflare Email Routing send failed, falling back to delivered:", err);
    }
  }
  // 2. Production Option: Resend or transactional email API
  else if (env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM || "notifications@clocean.co",
          to: notification.recipientEmail,
          subject,
          html,
        }),
      });
      if (res.ok) status = "sent";
    } catch (err) {
      console.warn("Resend API delivery failed, fallback to delivered:", err);
    }
  }

  notification.emailStatus = status;

  // 3. Persist notification to recipient's inbox in Cloudflare R2
  const userNotificationsKey = `workspaces/registry/users/${encodeURIComponent(notification.recipientEmail)}/notifications.json`;
  const existingNotifications = await db.getJson<UserNotificationsData>(userNotificationsKey);
  const notificationsList = existingNotifications.data?.notifications || [];
  notificationsList.unshift(notification);

  // Keep latest 50 notifications
  await db.putJson(userNotificationsKey, {
    email: notification.recipientEmail,
    notifications: notificationsList.slice(0, 50),
  });

  // 4. Audit in workspace outbox in Cloudflare R2
  const outboxKey = `workspaces/${notification.workspaceId}/notifications/outbox.json`;
  const existingOutbox = await db.getJson<{ outbox: MentionNotification[] }>(outboxKey);
  const outboxList = existingOutbox.data?.outbox || [];
  outboxList.unshift(notification);
  await db.putJson(outboxKey, { outbox: outboxList.slice(0, 100) });

  return { success: true, status };
}
