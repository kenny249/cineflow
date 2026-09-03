import type { SupabaseClient } from "@supabase/supabase-js";

// Supabase's .list() only goes one level deep and doesn't distinguish
// files from folders in its types — in practice, entries with a null `id`
// are folders (confirmed against this project's actual storage behavior).
// This walks a prefix all the way down and returns every real file path
// under it, so a single "delete everything under this project" call
// doesn't miss anything nested (e.g. project-files' docs/, revisions/,
// client-logo/ subfolders).
async function listAllFiles(admin: SupabaseClient, bucket: string, prefix: string): Promise<string[]> {
  const { data: entries } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (!entries || entries.length === 0) return [];
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id === null) {
      files.push(...(await listAllFiles(admin, bucket, fullPath)));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

/** Deletes every file under a given prefix (folder) in a bucket, recursively. */
export async function deleteStoragePrefix(admin: SupabaseClient, bucket: string, prefix: string): Promise<void> {
  const files = await listAllFiles(admin, bucket, prefix);
  if (files.length === 0) return;
  const chunkSize = 100;
  for (let i = 0; i < files.length; i += chunkSize) {
    await admin.storage.from(bucket).remove(files.slice(i, i + chunkSize));
  }
}
