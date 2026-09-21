import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";

const config = new pulumi.Config();
const accountId = config.require("accountId");
const domain = config.get("domain") || "clocean.example.com";
const allowedEmails = config.getObject<string[]>("allowedEmails") || ["team@clocean.co"];
const allowedEmailDomains = config.getObject<string[]>("allowedEmailDomains") || ["clocean.co"];

// 1. Provision Cloudflare R2 Bucket
export const storageBucket = new cloudflare.R2Bucket("clocean-storage", {
  accountId: accountId,
  name: "clocean-storage",
  location: "WNAM", // Western North America or APAC/EEUR
});

// 2. Provision Cloudflare Zero Trust / Access Application (Free for up to 50 users)
export const accessApp = new cloudflare.AccessApplication("clocean-app", {
  accountId: accountId,
  name: "Clocean Workspace",
  domain: domain,
  type: "self_hosted",
  sessionDuration: "24h",
  autoRedirectToIdentity: false,
});

// 3. Provision Cloudflare Access Policy (Allowed Team Members)
export const accessPolicy = new cloudflare.AccessPolicy("clocean-team-policy", {
  accountId: accountId,
  applicationId: accessApp.id,
  name: "Team Members Access",
  decision: "allow",
  precedence: 1,
  includes: [
    {
      emails: allowedEmails,
      emailDomains: allowedEmailDomains,
    },
  ],
});

export const r2BucketName = storageBucket.name;
export const appAudienceTag = accessApp.aud;
export const appDomain = accessApp.domain;
