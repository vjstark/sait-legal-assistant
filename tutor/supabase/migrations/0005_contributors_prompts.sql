-- Contributor role + document review workflow + editable tutor prompts.
-- Run in the Supabase SQL Editor like the earlier migrations.

-- ─────────────────────────────────────────────────────────────────
-- 1. New role: contributor — may upload documents, but they enter a
--    review queue; only admin-approved documents become course
--    material students can see.
-- ─────────────────────────────────────────────────────────────────

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'contributor', 'student'));

alter table public.invites drop constraint invites_role_check;
alter table public.invites
  add constraint invites_role_check
  check (role in ('admin', 'contributor', 'student'));

create or replace function public.is_contributor()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'contributor'
  );
$$;

-- ─────────────────────────────────────────────────────────────────
-- 2. Review state on documents. Admin uploads default to approved;
--    contributor uploads are forced to 'pending' by the insert policy.
-- ─────────────────────────────────────────────────────────────────

alter table public.documents
  add column review_status text not null default 'approved'
  check (review_status in ('pending', 'approved', 'rejected'));

-- Students see only approved material; uploaders always see their own;
-- admins see everything.
drop policy "authenticated read documents" on public.documents;
create policy "read approved documents" on public.documents
  for select using (
    review_status = 'approved'
    or public.is_admin()
    or uploaded_by = auth.uid()
  );

drop policy "admins write documents" on public.documents;
create policy "uploaders insert documents" on public.documents
  for insert with check (
    public.is_admin()
    or (
      public.is_contributor()
      and uploaded_by = auth.uid()
      and review_status = 'pending'
    )
  );

-- Contributors may withdraw their own not-yet-approved uploads.
create policy "contributors delete own pending documents" on public.documents
  for delete using (
    public.is_contributor()
    and uploaded_by = auth.uid()
    and review_status = 'pending'
  );

-- Storage: contributors may add files; only admins update/delete
-- (a contributor withdrawing an upload goes through the server, which
-- verifies ownership before removing the file).
drop policy "admins upload course files" on storage.objects;
create policy "uploaders add course files" on storage.objects
  for insert with check (
    bucket_id = 'course-files'
    and (public.is_admin() or public.is_contributor())
  );

-- ─────────────────────────────────────────────────────────────────
-- 3. Editable tutor prompts. A row here overrides the built-in
--    personality for that mode; deleting the row restores the default.
-- ─────────────────────────────────────────────────────────────────

create table public.mode_prompts (
  mode text primary key check (mode in ('teach', 'lookup', 'quiz', 'flashcards')),
  content text not null,
  updated_at timestamptz not null default now()
);

alter table public.mode_prompts enable row level security;

-- Every signed-in user's chat requests need to read the active prompt;
-- only admins change them.
create policy "authenticated read mode prompts" on public.mode_prompts
  for select using (auth.role() = 'authenticated');
create policy "admins write mode prompts" on public.mode_prompts
  for all using (public.is_admin()) with check (public.is_admin());
