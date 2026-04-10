import { createClient } from './client';
import type { Project, ProjectNote, ShotList, ShotListItem, CalendarEvent, CalendarEventType, Profile, TeamMember, TeamTopic, TeamMessage, ProjectFile, ProjectFileTab, CrewContact, ProjectLocation, WrapNote, BudgetLine } from '@/types';

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

// ─── Calendar Events ─────────────────────────────────────────────────────────

export async function getCalendarEvents(projectId?: string) {
  let query = db()
    .from('calendar_events')
    .select('*, projects(id, title, status)')
    .order('start_time', { ascending: true });

  if (projectId) {
    query = (query as any).eq('project_id', projectId);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }

  return (data || []).map((row: any) => ({
    ...row,
    type: row.event_type as CalendarEventType,
    start_date: row.start_time,
    end_date: row.end_time,
    project: row.projects ?? undefined,
  })) as CalendarEvent[];
}

export async function createCalendarEvent(event: {
  project_id?: string;
  title: string;
  description?: string;
  type: CalendarEventType;
  start_date: string;
  end_date?: string;
  location?: string;
}) {
  const { data, error } = await db()
    .from('calendar_events')
    .insert({
      project_id: event.project_id || null,
      title: event.title,
      description: event.description || null,
      event_type: event.type,
      start_time: event.start_date,
      end_time: event.end_date || event.start_date,
      location: event.location || null,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    ...data,
    type: (data as any).event_type as CalendarEventType,
    start_date: (data as any).start_time,
    end_date: (data as any).end_time,
  } as CalendarEvent;
}

export async function deleteCalendarEvent(id: string) {
  const { error } = await db()
    .from('calendar_events')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function updateCalendarEvent(id: string, updates: {
  title?: string;
  type?: CalendarEventType;
  description?: string;
  location?: string;
  start_date?: string;
  end_date?: string;
}) {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.type !== undefined) dbUpdates.event_type = updates.type;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.location !== undefined) dbUpdates.location = updates.location;
  if (updates.start_date !== undefined) dbUpdates.start_time = updates.start_date;
  if (updates.end_date !== undefined) dbUpdates.end_time = updates.end_date;

  const { data, error } = await db()
    .from('calendar_events')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  return {
    ...data,
    type: (data as any).event_type as CalendarEventType,
    start_date: (data as any).start_time,
    end_date: (data as any).end_time,
  } as CalendarEvent;
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export async function getProfile(): Promise<Profile | null> {
  const client = db();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;

  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return { ...data, email: user.email } as Profile;
}

export async function updateProfile(updates: Partial<Omit<Profile, 'id' | 'created_at'>>) {
  const client = db();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await client
    .from('profiles')
    .upsert({ id: user.id, ...updates, updated_at: new Date().toISOString() })
    .select()
    .single();

  if (error) throw error;
  return { ...data, email: user.email } as Profile;
}

// ─── Team ─────────────────────────────────────────────────────────────────────

export async function getTeamMembers(): Promise<TeamMember[]> {
  const { data, error } = await db().from('team_members').select('*').order('invited_at', { ascending: true });
  if (error) { if (isMissingTableError(error)) return []; throw error; }
  return data as TeamMember[];
}

export async function inviteTeamMember(email: string, name: string, role: TeamMember['role'] = 'member'): Promise<TeamMember> {
  const { data, error } = await db()
    .from('team_members')
    .insert({ email, name, role, status: 'pending' })
    .select().single();
  if (error) throw error;
  return data as TeamMember;
}

export async function removeTeamMember(id: string): Promise<void> {
  const { error } = await db().from('team_members').delete().eq('id', id);
  if (error) throw error;
}

export async function updateTeamMemberRole(id: string, role: TeamMember['role']): Promise<TeamMember> {
  const { data, error } = await db()
    .from('team_members').update({ role }).eq('id', id).select().single();
  if (error) throw error;
  return data as TeamMember;
}

export async function getTeamTopics(): Promise<TeamTopic[]> {
  const { data, error } = await db().from('team_topics').select('*').order('created_at', { ascending: true });
  if (error) { if (isMissingTableError(error)) return []; throw error; }
  return data as TeamTopic[];
}

export async function createTeamTopic(name: string, description: string, emoji = '💬'): Promise<TeamTopic> {
  const { data, error } = await db()
    .from('team_topics').insert({ name, description, emoji }).select().single();
  if (error) throw error;
  return data as TeamTopic;
}

export async function deleteTeamTopic(id: string): Promise<void> {
  const { error } = await db().from('team_topics').delete().eq('id', id);
  if (error) throw error;
}

export async function getTeamMessages(topicId: string): Promise<TeamMessage[]> {
  const { data, error } = await db()
    .from('team_messages')
    .select('*')
    .eq('topic_id', topicId)
    .order('created_at', { ascending: true });
  if (error) { if (isMissingTableError(error)) return []; throw error; }

  const messages = (data ?? []) as TeamMessage[];
  const authorIds = [...new Set(messages.map((m) => m.author_id).filter(Boolean))] as string[];

  if (authorIds.length > 0) {
    const { data: profiles } = await db()
      .from('profiles')
      .select('id, full_name, avatar_url, email')
      .in('id', authorIds);
    if (profiles) {
      const map = Object.fromEntries(profiles.map((p: any) => [p.id, p]));
      return messages.map((m) => ({ ...m, author: m.author_id ? map[m.author_id] : undefined }));
    }
  }

  return messages;
}

export async function sendTeamMessage(topicId: string, content: string): Promise<TeamMessage> {
  const client = db();
  const { data: { user } } = await client.auth.getUser();

  const { data, error } = await client
    .from('team_messages')
    .insert({ topic_id: topicId, content, author_id: user?.id ?? null })
    .select()
    .single();
  if (error) throw error;

  let author: TeamMessage['author'] = undefined;
  if (user) {
    const { data: profile } = await client.from('profiles').select('id, full_name, avatar_url').eq('id', user.id).maybeSingle();
    author = { id: user.id, email: user.email ?? undefined, full_name: profile?.full_name ?? user.email ?? undefined, avatar_url: profile?.avatar_url };
  }

  return { ...(data as TeamMessage), author };
}

export async function deleteTeamMessage(id: string): Promise<void> {
  const { error } = await db().from('team_messages').delete().eq('id', id);
  if (error) throw error;
}

// ─── Project Files ────────────────────────────────────────────────────────────

export async function getProjectFiles(projectId: string, tab?: ProjectFileTab): Promise<ProjectFile[]> {
  let q = db().from('project_files').select('*').eq('project_id', projectId);
  if (tab) q = q.eq('tab', tab);
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) { if (isMissingTableError(error)) return []; throw error; }
  return (data ?? []) as ProjectFile[];
}

export async function createProjectFile(file: Omit<ProjectFile, 'id' | 'created_at'>): Promise<ProjectFile> {
  const { data, error } = await db().from('project_files').insert(file).select().single();
  if (error) throw error;
  return data as ProjectFile;
}

export async function deleteProjectFile(id: string): Promise<void> {
  const { error } = await db().from('project_files').delete().eq('id', id);
  if (error) throw error;
}

// ─── Crew ─────────────────────────────────────────────────────────────────────

export async function getCrewContacts(projectId: string): Promise<CrewContact[]> {
  const { data, error } = await db().from('crew_contacts').select('*').eq('project_id', projectId).order('sort_order').order('created_at');
  if (error) { if (isMissingTableError(error)) return []; throw error; }
  return (data ?? []) as CrewContact[];
}

export async function createCrewContact(contact: Omit<CrewContact, 'id' | 'created_at'>): Promise<CrewContact> {
  const { data, error } = await db().from('crew_contacts').insert(contact).select().single();
  if (error) throw error;
  return data as CrewContact;
}

export async function updateCrewContact(id: string, updates: Partial<CrewContact>): Promise<CrewContact> {
  const { data, error } = await db().from('crew_contacts').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as CrewContact;
}

export async function deleteCrewContact(id: string): Promise<void> {
  const { error } = await db().from('crew_contacts').delete().eq('id', id);
  if (error) throw error;
}

// ─── Locations ───────────────────────────────────────────────────────────────

export async function getProjectLocations(projectId: string): Promise<ProjectLocation[]> {
  const { data, error } = await db().from('project_locations').select('*').eq('project_id', projectId).order('sort_order').order('created_at');
  if (error) { if (isMissingTableError(error)) return []; throw error; }
  return (data ?? []) as ProjectLocation[];
}

export async function createProjectLocation(location: Omit<ProjectLocation, 'id' | 'created_at'>): Promise<ProjectLocation> {
  const { data, error } = await db().from('project_locations').insert(location).select().single();
  if (error) throw error;
  return data as ProjectLocation;
}

export async function updateProjectLocation(id: string, updates: Partial<ProjectLocation>): Promise<ProjectLocation> {
  const { data, error } = await db().from('project_locations').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as ProjectLocation;
}

export async function deleteProjectLocation(id: string): Promise<void> {
  const { error } = await db().from('project_locations').delete().eq('id', id);
  if (error) throw error;
}

// ─── Wrap Notes ───────────────────────────────────────────────────────────────

export async function getWrapNotes(projectId: string): Promise<WrapNote[]> {
  const { data, error } = await db().from('wrap_notes').select('*').eq('project_id', projectId).order('production_day', { ascending: false });
  if (error) { if (isMissingTableError(error)) return []; throw error; }
  return (data ?? []) as WrapNote[];
}

export async function upsertWrapNote(note: Omit<WrapNote, 'id' | 'created_at' | 'updated_at'>): Promise<WrapNote> {
  const { data, error } = await db().from('wrap_notes').upsert({ ...note, updated_at: new Date().toISOString() }, { onConflict: 'project_id,production_day' }).select().single();
  if (error) throw error;
  return data as WrapNote;
}

export async function deleteWrapNote(id: string): Promise<void> {
  const { error } = await db().from('wrap_notes').delete().eq('id', id);
  if (error) throw error;
}

// ─── Budget ───────────────────────────────────────────────────────────────────

export async function getBudgetLines(projectId: string): Promise<BudgetLine[]> {
  const { data, error } = await db().from('budget_lines').select('*').eq('project_id', projectId).order('category').order('sort_order');
  if (error) { if (isMissingTableError(error)) return []; throw error; }
  return (data ?? []) as BudgetLine[];
}

export async function createBudgetLine(line: Omit<BudgetLine, 'id' | 'created_at' | 'updated_at'>): Promise<BudgetLine> {
  const { data, error } = await db().from('budget_lines').insert(line).select().single();
  if (error) throw error;
  return data as BudgetLine;
}

export async function updateBudgetLine(id: string, updates: Partial<BudgetLine>): Promise<BudgetLine> {
  const { data, error } = await db().from('budget_lines').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) throw error;
  return data as BudgetLine;
}

export async function deleteBudgetLine(id: string): Promise<void> {
  const { error } = await db().from('budget_lines').delete().eq('id', id);
  if (error) throw error;
}