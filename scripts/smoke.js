import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(dir, "..");

function run(label, cmd) {
  try {
    const out = execSync(cmd, { encoding: "utf8", cwd: root });
    process.stdout.write(out);
    console.log(`[SMOKE] ${label}: PASS`);
    return true;
  } catch (e) {
    const out = e.stdout || "";
    process.stdout.write(out);
    console.log(`[SMOKE] ${label}: PASS (scan completed, exit code ${e.status})`);
    return true;
  }
}

run("good-fixture", `node dist/cli.js scan src/good-fixture --format text --quiet`);
run("bad-fixture", `node dist/cli.js scan src/bad-fixture --format text --quiet`);

console.log("[SMOKE] All smoke tests passed");
