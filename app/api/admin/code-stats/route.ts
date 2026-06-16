import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function requireAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = getAdmin();
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
  return profile?.is_admin ? user : null;
}

const SCAN_DIRS = ["app", "components", "lib", "types", "hooks", "contexts", "styles"];
const CODE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".sql"]);
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", "build", ".vercel"]);

function isBlankOrComment(line: string): boolean {
  const t = line.trim();
  return t === "" || t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("--");
}

function scanDir(root: string, dir: string): { files: number; lines: number; effectiveLines: number; byExt: Record<string, number> } {
  let files = 0;
  let lines = 0;
  let effectiveLines = 0;
  const byExt: Record<string, number> = {};

  function walk(current: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch { return; }

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (!CODE_EXTS.has(ext)) continue;
        try {
          const content = fs.readFileSync(full, "utf8");
          const allLines = content.split("\n");
          const effective = allLines.filter((l) => !isBlankOrComment(l)).length;
          files++;
          lines += allLines.length;
          effectiveLines += effective;
          byExt[ext] = (byExt[ext] ?? 0) + allLines.length;
        } catch { /* skip unreadable files */ }
      }
    }
  }

  walk(path.join(root, dir));
  return { files, lines, effectiveLines, byExt };
}

export async function GET() {
  const caller = await requireAdmin();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const root = process.cwd();

  let totalFiles = 0;
  let totalLines = 0;
  let totalEffectiveLines = 0;
  const byExt: Record<string, number> = {};
  const byDir: Record<string, number> = {};

  for (const dir of SCAN_DIRS) {
    const dirPath = path.join(root, dir);
    if (!fs.existsSync(dirPath)) continue;
    const result = scanDir(root, dir);
    totalFiles += result.files;
    totalLines += result.lines;
    totalEffectiveLines += result.effectiveLines;
    byDir[dir] = result.lines;
    for (const [ext, count] of Object.entries(result.byExt)) {
      byExt[ext] = (byExt[ext] ?? 0) + count;
    }
  }

  // Count specific categories
  const apiRoutes = countFiles(path.join(root, "app", "api"), "route.ts") +
                    countFiles(path.join(root, "app", "api"), "route.tsx");
  const components = countFiles(path.join(root, "components"), ".tsx") +
                     countFiles(path.join(root, "components"), ".ts");
  const migrations = countFiles(path.join(root, "supabase", "migrations"), ".sql");
  const appPages = countFiles(path.join(root, "app"), "page.tsx") +
                   countFiles(path.join(root, "app"), "page.ts");

  // Estimated hours: AI-assisted development runs ~300 effective lines/hour
  const estimatedHours = Math.round(totalEffectiveLines / 300);

  // Git data — only available in local dev, not on Vercel (no .git directory at runtime)
  let commitCount = 0;
  let projectAgeDays = 0;
  let projectStartDate = "";
  if (!process.env.VERCEL) {
    try {
      const { execSync } = await import("child_process");
      const output = execSync("git rev-list --count HEAD", { cwd: root, timeout: 3000 }).toString().trim();
      commitCount = parseInt(output) || 0;
      const firstCommit = execSync("git log --reverse --format=%ci HEAD | head -1", { cwd: root, timeout: 3000 }).toString().trim();
      if (firstCommit) {
        const start = new Date(firstCommit);
        projectAgeDays = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
        projectStartDate = start.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      }
    } catch { /* git not available */ }
  }

  return NextResponse.json({
    totalFiles,
    totalLines,
    totalEffectiveLines,
    byDir,
    byExt,
    apiRoutes,
    components,
    migrations,
    appPages,
    estimatedHours,
    projectAgeDays,
    projectStartDate,
    commitCount,
  });
}

function countFiles(dir: string, suffix: string): number {
  let count = 0;
  function walk(current: string) {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(current, { withFileTypes: true }); }
    catch { return; }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(suffix)) count++;
    }
  }
  if (fs.existsSync(dir)) walk(dir);
  return count;
}
