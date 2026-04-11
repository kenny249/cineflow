import { createClient } from './client';
import type { Project, ProjectNote, ShotList, ShotListItem, CalendarEvent, CalendarEventType, Profile, TeamMember, TeamTopic, TeamMessage, ProjectFile, ProjectFileTab, CrewContact, ProjectLocation, WrapNote, BudgetLine, Invoice, InvoiceStatus, Revision, RevisionComment, ReviewToken, StoryboardFrame, ActivityItem, ActivityType } from '@/types';

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

  logActivity({ project_id: data.id, type: 'project_created', description: 'Created project' }).catch(() => {});
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
  const { data, error } = await db().from('invoices').insert(invoice).select().single();
  if (error) throw error;
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
  const { data, error } = await db()
    .from('revisions')
    .insert(revision)
    .select()
    .single();
  if (error) throw error;
  logActivity({ project_id: (data as Revision).project_id, type: 'revision_uploaded', description: `Uploaded revision "${(data as Revision).title}"` }).catch(() => {});
  return { ...(data as Revision), comments: [] };
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
}): Promise<RevisionComment> {
  const { data, error } = await db()
    .from('revision_comments')
    .insert(comment)
    .select()
    .single();
  if (error) throw error;
  return data as RevisionComment;
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
  const { data, error } = await db()
    .from('activity_log')
    .select('*, projects(id, title), profiles(id, full_name, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(limit);
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