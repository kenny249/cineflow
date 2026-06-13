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

function scanDir(root: string, dir: string): { files: number; lines: number; byExt: Record<string, number> } {
  let files = 0;
  let lines = 0;
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
          const lineCount = content.split("\n").length;
          files++;
          lines += lineCount;
          byExt[ext] = (byExt[ext] ?? 0) + lineCount;
        } catch { /* skip unreadable files */ }
      }
    }
  }

  walk(path.join(root, dir));
  return { files, lines, byExt };
}

export async function GET() {
  const caller = await requireAdmin();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const root = process.cwd();

  let totalFiles = 0;
  let totalLines = 0;
  const byExt: Record<string, number> = {};
  const byDir: Record<string, number> = {};

  for (const dir of SCAN_DIRS) {
    const dirPath = path.join(root, dir);
    if (!fs.existsSync(dirPath)) continue;
    const result = scanDir(root, dir);
    totalFiles += result.files;
    totalLines += result.lines;
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

  // Count pages
  const appPages = countFiles(path.join(root, "app"), "page.tsx") +
                   countFiles(path.join(root, "app"), "page.ts");

  // Estimated hours: roughly 40 meaningful lines/hour for production code
  const estimatedHours = Math.round(totalLines / 40);

  // Project age in days (first migration date as proxy)
  let projectAgeDays = 0;
  try {
    const migrationFiles = fs.readdirSync(path.join(root, "supabase", "migrations")).sort();
    if (migrationFiles[0]) {
      const dateStr = migrationFiles[0].substring(0, 8); // YYYYMMDD
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1;
      const day = parseInt(dateStr.substring(6, 8));
      const start = new Date(year, month, day);
      projectAgeDays = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
    }
  } catch { /* ignore */ }

  // Git commit count (available in dev; may not be available on Vercel)
  let commitCount = 0;
  try {
    const { execSync } = await import("child_process");
    const output = execSync("git rev-list --count HEAD", { cwd: root, timeout: 3000 }).toString().trim();
    commitCount = parseInt(output) || 0;
  } catch { commitCount = 0; }

  return NextResponse.json({
    totalFiles,
    totalLines,
    byDir,
    byExt,
    apiRoutes,
    components,
    migrations,
    appPages,
    estimatedHours,
    projectAgeDays,
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
