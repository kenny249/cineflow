import { createClient } from './client';
import type { Project, ProjectNote, ShotList, ShotListItem } from '@/types';

// Lazy getter — avoids module-level instantiation during Next.js build-time
// static analysis, which runs before env vars are injected.
const db = () => createClient();

// ─── Projects ────────────────────────────────────────────────────────────────

export async function getProjects() {
  const { data, error } = await db()
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Project[];
}

export async function getProject(id: string) {
  const { data, error } = await db()
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Project;
}

export async function createProject(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await db()
    .from('projects')
    .insert(project)
    .select()
    .single();

  if (error) {
    const message = error.message || "Failed to create project";
    throw new Error(message);
  }

  return data as Project;
}

function isMissingTableError(error: any) {
  return error?.code === "PGRST205" || /Could not find the table/i.test(error?.message || "");
}

export async function updateProject(id: string, updates: Partial<Project>) {
  const { data, error } = await db()
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Project;
}

export async function deleteProject(id: string) {
  const { error } = await db()
    .from('projects')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ─── Project Notes ───────────────────────────────────────────────────────────

export async function getProjectNotes(projectId: string) {
  const { data, error } = await db()
    .from('project_notes')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
  return data as ProjectNote[];
}

export async function createProjectNote(note: Omit<ProjectNote, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await db()
    .from('project_notes')
    .insert(note)
    .select()
    .single();

  if (error) throw error;
  return data as ProjectNote;
}

export async function updateProjectNote(id: string, updates: Partial<ProjectNote>) {
  const { data, error } = await db()
    .from('project_notes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as ProjectNote;
}

export async function deleteProjectNote(id: string) {
  const { error } = await db()
    .from('project_notes')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ─── Shot Lists ──────────────────────────────────────────────────────────────

export async function getShotLists(projectId: string) {
  const { data, error } = await db()
    .from('shot_lists')
    .select(`*, shot_list_items (*)`)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
  return data as ShotList[];
}

export async function getShotList(id: string) {
  const { data, error } = await db()
    .from('shot_lists')
    .select(`
      *,
      shot_list_items (*)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as ShotList & { shot_list_items: ShotListItem[] };
}

export async function createShotList(shotList: Omit<ShotList, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await db()
    .from('shot_lists')
    .insert(shotList)
    .select()
    .single();

  if (error) throw error;
  return data as ShotList;
}

export async function updateShotList(id: string, updates: Partial<ShotList>) {
  const { data, error } = await db()
    .from('shot_lists')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as ShotList;
}

export async function deleteShotList(id: string) {
  const { error } = await db()
    .from('shot_lists')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ─── Shot List Items ─────────────────────────────────────────────────────────

export async function getShotListItems(shotListId: string) {
  const { data, error } = await db()
    .from('shot_list_items')
    .select('*')
    .eq('shot_list_id', shotListId)
    .order('shot_number', { ascending: true });

  if (error) throw error;
  return data as ShotListItem[];
}

export async function createShotListItem(item: Omit<ShotListItem, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await db()
    .from('shot_list_items')
    .insert(item)
    .select()
    .single();

  if (error) throw error;
  return data as ShotListItem;
}

export async function updateShotListItem(id: string, updates: Partial<ShotListItem>) {
  const { data, error } = await db()
    .from('shot_list_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as ShotListItem;
}

export async function deleteShotListItem(id: string) {
  const { error } = await db()
    .from('shot_list_items')
    .delete()
    .eq('id', id);

  if (error) throw error;
}