import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const viteScript = path.join(rootDir, "node_modules", "vite", "bin", "vite.js");
const cypressScript = path.join(rootDir, "node_modules", "cypress", "bin", "cypress");

const preview = spawn(process.execPath, [viteScript, "preview", "--strictPort", "--port", "4173", "--host", "127.0.0.1"], {
  cwd: rootDir,
  stdio: "pipe",
});

preview.stdout.on("data", (d) => process.stdout.write(`[preview] ${d}`));
preview.stderr.on("data", (d) => process.stderr.write(`[preview err] ${d}`));

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 200 || res.status === 304) return;
    } catch {
      // waiting for preview server
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

async function main() {
  try {
    await waitForServer("http://127.0.0.1:4173");
    console.log(" Clocean preview server active on http://127.0.0.1:4173. Launching Cypress test runner...");

    const cypressArgs = process.argv.slice(2);
    const cypress = spawn(process.execPath, [cypressScript, "run", ...cypressArgs], {
      cwd: rootDir,
      stdio: "inherit",
    });

    cypress.on("exit", (code) => {
      preview.kill();
      process.exit(code ?? 1);
    });

    cypress.on("error", (err) => {
      console.error("Cypress execution error:", err);
      preview.kill();
      process.exit(1);
    });
  } catch (err) {
    console.error("Failed to start Cypress test runner:", err);
    preview.kill();
    process.exit(1);
  }
}

process.on("SIGINT", () => {
  preview.kill();
  process.exit(0);
});

process.on("SIGTERM", () => {
  preview.kill();
  process.exit(0);
});

main();
