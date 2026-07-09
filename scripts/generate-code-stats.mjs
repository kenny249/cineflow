// Runs at build time (npm `prebuild`) when the .git directory is present —
// Vercel strips .git from the runtime filesystem, so any git-derived stat must
// be computed here and baked into a JSON the API route reads at runtime.
//
// Computes total churn (every line added + deleted across history), commit
// count, and the first-commit date. Falls back gracefully if git or full
// history isn't available (e.g. a shallow CI clone).
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "lib", "code-stats-git.json");

function git(cmd) {
  return execSync(`git ${cmd}`, { cwd: root, timeout: 15000, maxBuffer: 64 * 1024 * 1024 }).toString();
}

const stats = { linesChanged: 0, commitCount: 0, firstCommitDate: "", shallow: false, generatedAt: new Date().toISOString() };

try {
  // Best-effort: deepen a shallow clone so churn reflects full history.
  try {
    if (git("rev-parse --is-shallow-repository").trim() === "true") {
      stats.shallow = true;
      try { execSync("git fetch --unshallow", { cwd: root, timeout: 30000 }); stats.shallow = false; } catch { /* offline / no creds — use what we have */ }
    }
  } catch { /* older git without is-shallow-repository */ }

  stats.commitCount = parseInt(git("rev-list --count HEAD").trim(), 10) || 0;

  const first = git('log --reverse --format=%ci HEAD').split("\n").find(Boolean);
  if (first) stats.firstCommitDate = new Date(first.trim()).toISOString();

  // numstat: each changed file prints "<added>\t<deleted>\t<path>" ("-" for binary).
  const numstat = git('log --numstat --format=""');
  let churn = 0;
  for (const line of numstat.split("\n")) {
    const m = line.match(/^(\d+)\t(\d+)\t/);
    if (m) churn += parseInt(m[1], 10) + parseInt(m[2], 10);
  }
  stats.linesChanged = churn;
} catch (e) {
  console.warn("[generate-code-stats] git unavailable, writing zeros:", e?.message ?? e);
}

writeFileSync(out, JSON.stringify(stats, null, 2) + "\n");
console.log(`[generate-code-stats] ${stats.linesChanged.toLocaleString()} lines changed · ${stats.commitCount} commits${stats.shallow ? " (shallow history)" : ""}`);
