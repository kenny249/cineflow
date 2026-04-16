import { createClient } from './client';
import type { Project, ProjectNote, ShotList, ShotListItem, CalendarEvent, CalendarEventType, Profile, TeamMember, TeamTopic, TeamMessage, ProjectFile, ProjectFileTab, CrewContact, ProjectLocation, WrapNote, BudgetLine, Invoice, InvoiceStatus, Revision, RevisionComment, ReviewToken, StoryboardFrame, ActivityItem, ActivityType, VideoDeliverable, ClientPortal, Retainer, RetainerMonth, RetainerDeliverable, RetainerTemplateItem } from '@/types';

// Lazy getter — avoids module-level instantiation during Next.js build-time
// static analysis, which runs before env vars are injected.
const db = () => createClient();

// ─── Projects ────────────────────────────────────────────────────────────────

export async function getProjects() {
  const client = db();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return [] as Project[];

  const { data, error } = await client
    .from('projects')
    .select('*')
    .eq('created_by', user.id)
    .is('deleted_at', null)
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

  logActivity({ project_id: data.id, type: 'project_created', description: 'Created project' }).catch(() => {});
  // Fire-and-forget notification
  db().auth.getUser().then(({ data: { user } }) => {
    if (user) createNotification({ user_id: user.id, type: 'project_created', title: `Project "${data.title}" created`, href: `/projects/${data.id}` }).catch(() => {});
  });
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
  if (updates.status) {
    logActivity({ project_id: id, type: 'status_changed', description: `Status changed to "${updates.status}"`, metadata: { status: updates.status } }).catch(() => {});
    // Fire-and-forget notification for status changes
    db().auth.getUser().then(({ data: { user } }) => {
      if (user) createNotification({ user_id: user.id, type: 'status_changed', title: `"${(data as Project).title}" → ${updates.status}`, description: `Project status updated`, href: `/projects/${id}` }).catch(() => {});
    });
  } else {
    logActivity({ project_id: id, type: 'project_updated', description: 'Project updated' }).catch(() => {});
  }
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
  logActivity({ project_id: (data as ProjectNote).project_id, type: 'note_added', description: `Added note "${(data as ProjectNote).title || 'Untitled'}"` }).catch(() => {});
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
  const client = db();
  const { data: { user } } = await client.auth.getUser();

  let query = client
    .from('calendar_events')
    .select('*, projects(id, title, status)')
    .order('start_time', { ascending: true });

  if (projectId) {
    query = (query as any).eq('project_id', projectId);
  } else if (user) {
    // Without a project filter, restrict to events the user created
    query = (query as any).eq('created_by', user.id);
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
    meeting_link: row.meeting_link ?? undefined,
    recurrence_rule: row.recurrence_rule ?? undefined,
    recurrence_end_date: row.recurrence_end_date ?? undefined,
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
  meeting_link?: string;
  recurrence_rule?: string;
  recurrence_end_date?: string;
}) {
  const client = db();
  const { data: { user } } = await client.auth.getUser();
  const { data, error } = await client
    .from('calendar_events')
    .insert({
      project_id: event.project_id || null,
      title: event.title,
      description: event.description || null,
      event_type: event.type,
      start_time: event.start_date,
      end_time: event.end_date || event.start_date,
      location: event.location || null,
      meeting_link: event.meeting_link || null,
      recurrence_rule: event.recurrence_rule || null,
      recurrence_end_date: event.recurrence_end_date || null,
      created_by: user?.id ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message || "Failed to create event");

  return {
    ...data,
    type: (data as any).event_type as CalendarEventType,
    start_date: (data as any).start_time,
    end_date: (data as any).end_time,
    meeting_link: (data as any).meeting_link ?? undefined,
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
  meeting_link?: string;
  start_date?: string;
  end_date?: string;
}) {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.type !== undefined) dbUpdates.event_type = updates.type;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.location !== undefined) dbUpdates.location = updates.location;
  if (updates.meeting_link !== undefined) dbUpdates.meeting_link = updates.meeting_link || null;
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

// ─── Storyboard ───────────────────────────────────────────────────────────────

export async function getStoryboardFrames(projectId: string) {
  const { data, error } = await db()
    .from('storyboard_frames')
    .select('*')
    .eq('project_id', projectId)
    .order('frame_number', { ascending: true });
  if (error) { if (isMissingTableError(error)) return []; throw error; }
  return data as StoryboardFrame[];
}

export async function createStoryboardFrame(frame: Omit<StoryboardFrame, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await db()
    .from('storyboard_frames')
    .insert(frame)
    .select()
    .single();
  if (error) throw error;
  return data as StoryboardFrame;
}

export async function updateStoryboardFrame(id: string, updates: Partial<StoryboardFrame>) {
  const { data, error } = await db()
    .from('storyboard_frames')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as StoryboardFrame;
}

export async function deleteStoryboardFrame(id: string) {
  const { error } = await db().from('storyboard_frames').delete().eq('id', id);
  if (error) throw error;
}

export async function reorderStoryboardFrames(frames: { id: string; frame_number: number }[]) {
  const updates = frames.map(f =>
    db().from('storyboard_frames').update({ frame_number: f.frame_number }).eq('id', f.id)
  );
  await Promise.all(updates);
}

// ─── Team ─────────────────────────────────────────────────────────────────────

export async function getTeamMembers(): Promise<TeamMember[]> {
  const { data, error } = await db().from('team_members').select('*').order('invited_at', { ascending: true });
  if (error) { if (isMissingTableError(error)) return []; throw error; }
  return data as TeamMember[];
}

export async function inviteTeamMember(email: string, name: string, role: TeamMember['role'] = 'member'): Promise<TeamMember> {
  const client = db();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await client
    .from('team_members')
    .insert({ email, name, role, status: 'pending', invited_by: user.id })
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
  const { data: { user } } = await db().auth.getUser();
  const { data, error } = await db()
    .from('team_topics').insert({ name, description, emoji, created_by: user?.id }).select().single();
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
  // Manually check for existing record to avoid needing a UNIQUE constraint
  const { data: existing } = await db()
    .from('wrap_notes')
    .select('id')
    .eq('project_id', note.project_id)
    .eq('production_day', note.production_day)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await db()
      .from('wrap_notes')
      .update({ content: note.content, issues: note.issues, outstanding: note.outstanding, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data as WrapNote;
  } else {
    const { data, error } = await db()
      .from('wrap_notes')
      .insert({ ...note, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return data as WrapNote;
  }
}

export async function deleteWrapNote(id: string): Promise<void> {
  const { error } = await db().from('wrap_notes').delete().eq('id', id);
  if (error) throw error;
}

// ─── Project Membership Helper ───────────────────────────────────────────────
// Ensures the current user is in project_members (needed for budget RLS).
export async function ensureProjectOwner(projectId: string): Promise<void> {
  try {
    const { data: { user } } = await db().auth.getUser();
    if (!user) return;
    await db()
      .from('project_members')
      .upsert({ project_id: projectId, user_id: user.id, role: 'owner' }, { onConflict: 'project_id,user_id', ignoreDuplicates: true });
  } catch { /* silent — if it fails, budget ops will surface the real error */ }
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

// ─── Invoices ────────────────────────────────────────────────────────────────

export async function getInvoices(): Promise<Invoice[]> {
  const { data, error } = await db().from('invoices').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Invoice[];
}

export async function getInvoicesByProject(projectId: string): Promise<Invoice[]> {
  const { data, error } = await db().from('invoices').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Invoice[];
}

export async function createInvoice(invoice: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>): Promise<Invoice> {
  const client = db();
  const { data: { user } } = await client.auth.getUser();
  const { data, error } = await client
    .from('invoices')
    .insert({ ...invoice, created_by: user?.id })
    .select()
    .single();
  if (error) throw new Error(error.message || 'Failed to create invoice');
  return data as Invoice;
}

export async function updateInvoice(id: string, updates: Partial<Invoice>): Promise<Invoice> {
  const { data, error } = await db().from('invoices').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) throw error;
  return data as Invoice;
}

export async function deleteInvoice(id: string): Promise<void> {
  const { error } = await db().from('invoices').delete().eq('id', id);
  if (error) throw error;
}

// ─── Revisions ───────────────────────────────────────────────────────────────

export async function getProjectRevisions(projectId: string): Promise<Revision[]> {
  const { data, error } = await db()
    .from('revisions')
    .select('*, revision_comments(*)')
    .eq('project_id', projectId)
    .order('version_number', { ascending: false });
  if (error) { if (isMissingTableError(error)) return []; throw error; }
  return (data ?? []).map((r: any) => ({
    ...r,
    comments: ((r.revision_comments ?? []) as any[]).sort(
      (a, b) => (a.timestamp_seconds ?? 0) - (b.timestamp_seconds ?? 0)
    ),
  })) as Revision[];
}

export async function createRevision(
  revision: Omit<Revision, 'id' | 'created_at' | 'updated_at' | 'comments'>
): Promise<Revision> {
  const client = db();
  const { data: { user } } = await client.auth.getUser();
  const { data, error } = await client
    .from('revisions')
    .insert(revision)
    .select()
    .single();
  if (error) throw error;
  const rev = data as Revision;
  logActivity({ project_id: rev.project_id, type: 'revision_uploaded', description: `Uploaded revision "${rev.title}"` }).catch(() => {});
  if (user) {
    createNotification({ user_id: user.id, type: 'revision_uploaded', title: `Revision "${rev.title}" uploaded`, description: `Ready for review`, href: `/projects/${rev.project_id}` }).catch(() => {});
  }
  return { ...rev, comments: [] };
}

export async function updateRevisionStatus(id: string, status: Revision['status']): Promise<void> {
  const client = db();
  const { data: { user } } = await client.auth.getUser();
  const { data, error } = await client.from('revisions').update({ status, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) throw error;
  if (user && status === 'approved') {
    createNotification({ user_id: user.id, type: 'revision_approved', title: `Revision approved`, description: `"${(data as Revision).title}" was approved`, href: `/projects/${(data as Revision).project_id}` }).catch(() => {});
    logActivity({ project_id: (data as Revision).project_id, type: 'revision_approved', description: `Revision "${(data as Revision).title}" approved` }).catch(() => {});
  }
}

export async function updateRevision(
  id: string,
  updates: Partial<Omit<Revision, 'comments'>>
): Promise<Revision> {
  const { data, error } = await db()
    .from('revisions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Revision;
}

export async function deleteRevision(id: string): Promise<void> {
  const { error } = await db().from('revisions').delete().eq('id', id);
  if (error) throw error;
}

export async function createRevisionComment(comment: {
  revision_id: string;
  content: string;
  timestamp_seconds?: number;
  author_name?: string;
  parent_id?: string;
}): Promise<RevisionComment> {
  const { data, error } = await db()
    .from('revision_comments')
    .insert(comment)
    .select()
    .single();
  if (error) throw error;
  // Log comment activity — look up project_id from the revision
  try {
    const { data: rev } = await db().from('revisions').select('project_id').eq('id', comment.revision_id).single();
    if (rev?.project_id) {
      logActivity({ project_id: rev.project_id, type: 'comment_added', description: 'Comment added on revision' }).catch(() => {});
    }
  } catch { /* ignore */ }
  return data as RevisionComment;
}

export async function getRevisionComments(revisionId: string): Promise<RevisionComment[]> {
  const { data, error } = await db()
    .from('revision_comments')
    .select('*')
    .eq('revision_id', revisionId)
    .order('created_at');
  if (error) { if (isMissingTableError(error)) return []; throw error; }
  // Build threaded structure: top-level + replies
  const all = (data ?? []) as RevisionComment[];
  const top = all.filter((c) => !c.parent_id);
  const replies = all.filter((c) => c.parent_id);
  return top.map((c) => ({
    ...c,
    replies: replies.filter((r) => r.parent_id === c.id),
  }));
}

export async function deleteRevisionComment(id: string): Promise<void> {
  const { error } = await db().from('revision_comments').delete().eq('id', id);
  if (error) throw error;
}

// ─── Review Tokens ────────────────────────────────────────────────────────────

export async function createReviewToken(payload: {
  project_id: string;
  client_name: string;
  client_email: string;
}): Promise<ReviewToken> {
  const { data, error } = await db()
    .from('review_tokens')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as ReviewToken;
}

export async function getProjectReviewToken(projectId: string): Promise<ReviewToken | null> {
  const { data, error } = await db()
    .from('review_tokens')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) { if (isMissingTableError(error)) return null; throw error; }
  return data as ReviewToken | null;
}

export async function revokeReviewToken(id: string): Promise<void> {
  const { error } = await db()
    .from('review_tokens')
    .update({ is_active: false })
    .eq('id', id);
  if (error) throw error;
}

// ─── Activity Log ─────────────────────────────────────────────────────────────

export async function getActivityLog(limit = 20): Promise<ActivityItem[]> {
  const client = db();
  const { data: { user } } = await client.auth.getUser();

  let q = client
    .from('activity_log')
    .select('*, projects(id, title), profiles(id, full_name, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(limit);

  // Scope to projects the current user owns
  if (user) {
    q = (q as any).eq('user_id', user.id);
  }

  const { data, error } = await q;
  if (error) { if (isMissingTableError(error)) return []; throw error; }
  return (data || []).map((row: any) => ({
    id: row.id,
    project_id: row.project_id,
    user_id: row.user_id,
    type: row.type as ActivityType,
    description: row.description,
    metadata: row.metadata,
    created_at: row.created_at,
    project: row.projects ?? undefined,
    user: row.profiles ?? undefined,
  })) as ActivityItem[];
}

// ─── Beta Feedback ───────────────────────────────────────────────────────────

export async function submitBetaFeedback(payload: {
  usage_frequency: string;
  top_features: string[];
  workflow_fit: string;
  would_pay: string;
  price_range: string;
  pricing_model: string;
  missing_feature?: string;
  star_rating?: number;
}) {
  const { error } = await db().from('beta_feedback').insert(payload);
  if (error) throw error;
}

export async function logActivity(item: {
  project_id: string;
  type: ActivityType;
  description: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = db();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('activity_log').insert({
      project_id: item.project_id,
      user_id: user?.id ?? null,
      type: item.type,
      description: item.description,
      metadata: item.metadata ?? {},
    });
  } catch { /* fire-and-forget */ }
}

// ─── Client Contacts ──────────────────────────────────────────────────────────

export interface ClientContact {
  id: string;
  user_id: string;
  client_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function getClientContacts(): Promise<ClientContact[]> {
  const client = db();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return [];
  const { data, error } = await client
    .from('client_contacts')
    .select('*')
    .eq('user_id', user.id);
  if (error) { if (isMissingTableError(error)) return []; throw error; }
  return (data ?? []) as ClientContact[];
}

export async function upsertClientContact(
  clientName: string,
  contact: { contact_name?: string; email?: string; phone?: string; website?: string; notes?: string }
): Promise<ClientContact> {
  const client = db();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await client
    .from('client_contacts')
    .upsert(
      { user_id: user.id, client_name: clientName, ...contact, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,client_name' }
    )
    .select()
    .single();
  if (error) throw error;
  return data as ClientContact;
}

// ─── Project Deliverables ─────────────────────────────────────────────────────

export interface ProjectDeliverable {
  id: string;
  project_id: string;
  label: string;
  done: boolean;
  sort_order: number;
  created_at: string;
}

export async function getProjectDeliverables(projectId: string): Promise<ProjectDeliverable[]> {
  const { data, error } = await db()
    .from('project_deliverables')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order')
    .order('created_at');
  if (error) { if (isMissingTableError(error)) return []; throw error; }
  return (data ?? []) as ProjectDeliverable[];
}

export async function createProjectDeliverable(projectId: string, label: string): Promise<ProjectDeliverable> {
  const { data: existing } = await db()
    .from('project_deliverables')
    .select('sort_order')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort_order = (existing?.sort_order ?? -1) + 1;
  const { data, error } = await db()
    .from('project_deliverables')
    .insert({ project_id: projectId, label, done: false, sort_order })
    .select()
    .single();
  if (error) throw error;
  return data as ProjectDeliverable;
}

export async function updateProjectDeliverable(id: string, updates: { label?: string; done?: boolean }): Promise<ProjectDeliverable> {
  const { data, error } = await db()
    .from('project_deliverables')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as ProjectDeliverable;
}

export async function deleteProjectDeliverable(id: string): Promise<void> {
  const { error } = await db().from('project_deliverables').delete().eq('id', id);
  if (error) throw error;
}

// ─── Tasks (DB-backed daily tasks) ───────────────────────────────────────────

export interface DbTask {
  id: string;
  user_id: string;
  title: string;
  done: boolean;
  priority: 'high' | 'medium' | 'low';
  date: string; // YYYY-MM-DD
  created_at: string;
}

export async function getTasks(date?: string): Promise<DbTask[]> {
  const client = db();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return [];
  let q = client.from('tasks').select('*').eq('user_id', user.id).order('created_at');
  if (date) q = (q as any).eq('date', date);
  const { data, error } = await q;
  if (error) { if (isMissingTableError(error)) return []; throw error; }
  return (data ?? []) as DbTask[];
}

export async function createTask(task: { title: string; priority: 'high' | 'medium' | 'low'; date: string }): Promise<DbTask> {
  const client = db();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await client
    .from('tasks')
    .insert({ user_id: user.id, title: task.title, priority: task.priority, date: task.date, done: false })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as DbTask;
}

export async function updateTask(id: string, updates: { done?: boolean; title?: string; priority?: string }): Promise<DbTask> {
  const { data, error } = await db().from('tasks').update(updates).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data as DbTask;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await db().from('tasks').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  description?: string;
  href?: string;
  read: boolean;
  created_at: string;
}

export async function getNotifications(): Promise<AppNotification[]> {
  const client = db();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return [];
  const { data, error } = await client
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) { if (isMissingTableError(error)) return []; throw error; }
  return (data ?? []) as AppNotification[];
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await db().from('notifications').update({ read: true }).eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const client = db();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return;
  const { error } = await client.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
  if (error) throw error;
}

export async function createNotification(notification: {
  user_id: string;
  type: string;
  title: string;
  description?: string;
  href?: string;
}): Promise<void> {
  try {
    const { error } = await db().from('notifications').insert(notification);
    if (error) throw error;
  } catch { /* fire-and-forget */ }
}

// ─── Soft Delete (Projects) ───────────────────────────────────────────────────

export async function softDeleteProject(id: string): Promise<void> {
  const { error } = await db()
    .from('projects')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function restoreProject(id: string): Promise<void> {
  const { error } = await db()
    .from('projects')
    .update({ deleted_at: null })
    .eq('id', id);
  if (error) throw error;
}

export async function getTrashedProjects(): Promise<Project[]> {
  const client = db();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return [];
  const { data, error } = await client
    .from('projects')
    .select('*')
    .eq('created_by', user.id)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Project[];
}

export async function permanentlyDeleteProject(id: string): Promise<void> {
  const { error } = await db().from('projects').delete().eq('id', id);
  if (error) throw error;
}

// ─── Project Templates ────────────────────────────────────────────────────────

export interface ProjectTemplate {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  type: string;
  phase_items: string[];
  tags: string[];
  created_at: string;
}

export async function getProjectTemplates(): Promise<ProjectTemplate[]> {
  const client = db();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return [];
  const { data, error } = await client
    .from('project_templates')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) { if (isMissingTableError(error)) return []; throw error; }
  return (data ?? []) as ProjectTemplate[];
}

export async function createProjectTemplate(template: {
  name: string;
  description?: string;
  type: string;
  phase_items: string[];
  tags: string[];
}): Promise<ProjectTemplate> {
  const client = db();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await client
    .from('project_templates')
    .insert({ ...template, user_id: user.id })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ProjectTemplate;
}

export async function deleteProjectTemplate(id: string): Promise<void> {
  const { error } = await db().from('project_templates').delete().eq('id', id);
  if (error) throw error;
}

// ─── Update getProjects to exclude soft-deleted ──────────────────────────────
// (filter applied in the existing getProjects — see override below)

export async function getProjectsActive(): Promise<Project[]> {
  const client = db();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return [] as Project[];
  const { data, error } = await client
    .from('projects')
    .select('*')
    .eq('created_by', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Project[];
}

// ─── Recurring Calendar Events helper ────────────────────────────────────────
// Expands a base event with recurrence_rule into virtual occurrences for a given month window.

export function expandRecurringEvents(events: CalendarEvent[], viewYear: number, viewMonth: number): CalendarEvent[] {
  const result: CalendarEvent[] = [];
  const windowStart = new Date(viewYear, viewMonth, 1);
  const windowEnd   = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59);

  for (const ev of events) {
    result.push(ev);
    if (!ev.recurrence_rule) continue;

    const base = new Date(ev.start_date);
    const endBase = ev.end_date ? new Date(ev.end_date) : new Date(ev.start_date);
    const duration = endBase.getTime() - base.getTime();
    const recEnd = ev.recurrence_end_date ? new Date(ev.recurrence_end_date) : windowEnd;

    let cursor = new Date(base);
    let safety = 0;
    while (safety++ < 500) {
      // Advance cursor by recurrence interval
      if (ev.recurrence_rule === 'daily')        cursor.setDate(cursor.getDate() + 1);
      else if (ev.recurrence_rule === 'weekly')  cursor.setDate(cursor.getDate() + 7);
      else if (ev.recurrence_rule === 'monthly') cursor.setMonth(cursor.getMonth() + 1);
      else break;

      if (cursor > recEnd || cursor > windowEnd) break;
      if (cursor < windowStart) continue;

      const occEnd = new Date(cursor.getTime() + duration);
      result.push({
        ...ev,
        id: `${ev.id}_occ_${cursor.getTime()}`,
        start_date: cursor.toISOString(),
        end_date: occEnd.toISOString(),
      });
    }
  }
  return result;
}

// ─── Video Deliverables ───────────────────────────────────────────────────────

export async function getVideoDeliverables(projectId: string): Promise<VideoDeliverable[]> {
  const { data, error } = await db()
    .from('video_deliverables')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) { if (isMissingTableError(error)) return []; throw error; }
  return (data ?? []) as VideoDeliverable[];
}

export async function createVideoDeliverable(deliverable: {
  project_id: string;
  title: string;
  type: string;
  url: string;
  notes?: string;
}): Promise<VideoDeliverable> {
  const client = db();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await client
    .from('video_deliverables')
    .insert({ ...deliverable, created_by: user.id, status: 'draft' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as VideoDeliverable;
}

export async function updateVideoDeliverable(
  id: string,
  updates: Partial<Pick<VideoDeliverable, 'title' | 'type' | 'url' | 'notes' | 'status' | 'delivered_at'>>
): Promise<void> {
  const { error } = await db()
    .from('video_deliverables')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteVideoDeliverable(id: string): Promise<void> {
  const { error } = await db().from('video_deliverables').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Client Portals ───────────────────────────────────────────────────────────

export async function getClientPortal(clientName: string): Promise<ClientPortal | null> {
  const client = db();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const { data, error } = await client
    .from('client_portals')
    .select('*')
    .eq('created_by', user.id)
    .eq('client_name', clientName)
    .single();
  if (error) { if (error.code === 'PGRST116') return null; throw error; }
  return data as ClientPortal;
}

export async function getOrCreateClientPortal(clientName: string): Promise<ClientPortal> {
  const client = db();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  // Try to get existing portal
  const { data: existing } = await client
    .from('client_portals')
    .select('*')
    .eq('created_by', user.id)
    .eq('client_name', clientName)
    .single();
  if (existing) return existing as ClientPortal;
  // Create new portal
  const { data, error } = await client
    .from('client_portals')
    .insert({ created_by: user.id, client_name: clientName })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ClientPortal;
}

export async function getClientPortals(): Promise<ClientPortal[]> {
  const client = db();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return [];
  const { data, error } = await client
    .from('client_portals')
    .select('*')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false });
  if (error) { if (isMissingTableError(error)) return []; throw error; }
  return (data ?? []) as ClientPortal[];
}

// ─── Retainers ────────────────────────────────────────────────────────────────

export async function getRetainers(): Promise<Retainer[]> {
  const client = db();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return [];
  const { data, error } = await client
    .from('retainers')
    .select('*')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false });
  if (error) { if (isMissingTableError(error)) return []; throw error; }
  return (data ?? []) as Retainer[];
}

export async function getRetainer(id: string): Promise<Retainer | null> {
  const { data, error } = await db()
    .from('retainers')
    .select('*')
    .eq('id', id)
    .single();
  if (error) { if (error.code === 'PGRST116') return null; throw error; }
  return data as Retainer;
}

export async function createRetainer(payload: {
  client_name: string;
  monthly_rate?: number;
  template: RetainerTemplateItem[];
  notes?: string;
  start_date?: string;
}): Promise<Retainer> {
  const client = db();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await client
    .from('retainers')
    .insert({ ...payload, created_by: user.id })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Retainer;
}

export async function updateRetainer(id: string, updates: Partial<Pick<Retainer, 'client_name' | 'monthly_rate' | 'template' | 'notes' | 'is_active' | 'start_date'>>): Promise<void> {
  const { error } = await db()
    .from('retainers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteRetainer(id: string): Promise<void> {
  const { error } = await db().from('retainers').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Retainer Months ─────────────────────────────────────────────────────────

export async function getRetainerMonths(retainerId: string): Promise<RetainerMonth[]> {
  const { data, error } = await db()
    .from('retainer_months')
    .select('*')
    .eq('retainer_id', retainerId)
    .order('month_year', { ascending: false });
  if (error) { if (isMissingTableError(error)) return []; throw error; }
  return (data ?? []) as RetainerMonth[];
}

export async function createRetainerMonth(payload: {
  retainer_id: string;
  month_year: string;
  shoot_date?: string;
  template: RetainerTemplateItem[];
}): Promise<RetainerMonth> {
  const client = db();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Create the month record
  const { data: month, error } = await client
    .from('retainer_months')
    .insert({ retainer_id: payload.retainer_id, month_year: payload.month_year, created_by: user.id, shoot_date: payload.shoot_date })
    .select()
    .single();
  if (error) throw new Error(error.message);

  // Auto-populate deliverables from template
  const deliverables: { month_id: string; created_by: string; title: string; type: string; sort_order: number }[] = [];
  let sortOrder = 0;
  for (const item of payload.template) {
    const mode = item.mode ?? (item.type === 'photo' || item.type === 'story' ? 'batch' : 'individual');
    if (mode === 'batch') {
      // One row for the whole batch — e.g. "Photos · 25"
      deliverables.push({
        month_id: month.id,
        created_by: user.id,
        title: item.quantity > 1 ? `${item.label} · ${item.quantity}` : item.label,
        type: item.type,
        sort_order: sortOrder++,
      });
    } else {
      // One row per individual deliverable
      for (let i = 1; i <= item.quantity; i++) {
        const suffix = item.quantity > 1 ? ` ${i}` : '';
        deliverables.push({
          month_id: month.id,
          created_by: user.id,
          title: `${item.label}${suffix}`,
          type: item.type,
          sort_order: sortOrder++,
        });
      }
    }
  }
  if (deliverables.length > 0) {
    await client.from('retainer_deliverables').insert(deliverables);
  }

  return month as RetainerMonth;
}

export async function updateRetainerMonth(id: string, updates: Partial<Pick<RetainerMonth, 'status' | 'shoot_date' | 'notes'>>): Promise<void> {
  const { error } = await db()
    .from('retainer_months')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Retainer Deliverables ───────────────────────────────────────────────────

export async function getRetainerDeliverables(monthId: string): Promise<RetainerDeliverable[]> {
  const { data, error } = await db()
    .from('retainer_deliverables')
    .select('*')
    .eq('month_id', monthId)
    .order('sort_order', { ascending: true });
  if (error) { if (isMissingTableError(error)) return []; throw error; }
  return (data ?? []) as RetainerDeliverable[];
}

export async function createRetainerDeliverable(payload: {
  month_id: string;
  title: string;
  type: string;
  sort_order?: number;
}): Promise<RetainerDeliverable> {
  const client = db();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await client
    .from('retainer_deliverables')
    .insert({ ...payload, created_by: user.id })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as RetainerDeliverable;
}

export async function updateRetainerDeliverable(id: string, updates: { status?: string; title?: string; notes?: string }): Promise<void> {
  const { error } = await db()
    .from('retainer_deliverables')
    .update(updates)
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteRetainerDeliverable(id: string): Promise<void> {
  const { error } = await db().from('retainer_deliverables').delete().eq('id', id);
  if (error) throw new Error(error.message);
}