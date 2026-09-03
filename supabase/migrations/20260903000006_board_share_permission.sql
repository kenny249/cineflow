-- Sharing only ever meant "anyone with the link can view" — no way to let
-- an anonymous visitor actually edit. Nullable-safe default of 'view' so
-- every existing share link keeps behaving exactly as it does today.
alter table boards add column if not exists share_permission text not null default 'view'
  check (share_permission in ('view', 'edit'));
