// Read-only deployment check. Supply CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN
// through the environment; never print credentials or full login URLs.
const domain = process.argv[2];
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!domain || !accountId || !token) {
  console.error("Usage: CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... node scripts/check-access-experience.mjs <app-hostname>");
  process.exit(2);
}

const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/access/apps`, {
  headers: { Authorization: `Bearer ${token}` },
});
const data = await response.json();
if (!response.ok || !data.success || !Array.isArray(data.result)) {
  console.error("Could not inspect Cloudflare Access applications.");
  process.exit(2);
}

const app = data.result.find((item) => item.type === "self_hosted" && item.domain === domain);
const launcher = data.result.find((item) => item.type === "app_launcher");
if (!app) {
  console.error(`No Access application protects ${domain}.`);
  process.exit(1);
}
if (!launcher) {
  console.error("App Launcher is disabled: visiting the Access team domain shows the administrator warning.");
  process.exit(1);
}
if (!app.app_launcher_visible) {
  console.error("The Access App Launcher exists, but Clocean is not shown as a tile.");
  process.exit(1);
}
const providersResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/access/identity_providers`, {
  headers: { Authorization: `Bearer ${token}` },
});
const providers = await providersResponse.json();
if (!providersResponse.ok || !providers.success || !Array.isArray(providers.result)) {
  console.error("Could not inspect Cloudflare Access login methods.");
  process.exit(2);
}
if (!providers.result.some((item) => item.type === "onetimepin")) {
  console.error("Email-code sign-in is unavailable: no One-time PIN identity provider exists.");
  process.exit(1);
}
console.log(`Access App Launcher, Clocean tile, and email-code sign-in are configured for ${domain}.`);
