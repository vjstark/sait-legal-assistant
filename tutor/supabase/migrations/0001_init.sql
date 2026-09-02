-- AI Law Study Tutor — initial schema
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run).

create extension if not exists vector;

-- ─────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role text not null check (role in ('admin', 'student')) default 'student',
  learning_preferences jsonb,
  created_at timestamptz not null default now()
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null check (role in ('admin', 'student')) default 'student',
  invited_by uuid references public.profiles(id),
  status text not null check (status in ('pending', 'accepted')) default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  term text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  category text not null check (
    category in (
      'textbook', 'supplementary_pdf', 'lecture_slides',
      'lecture_audio', 'past_exam', 'personal_notes', 'url_source'
    )
  ),
  storage_path text,
  source_url text,
  source_filename text,
  page_count int,
  duration_seconds int,
  status text not null check (status in ('uploaded', 'processing', 'ready', 'error')) default 'uploaded',
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- NOTE: verify voyage-law-2's actual output dimension before Phase 3 ingestion —
-- 1024 is carried over from voyage-3-large's documented default and needs confirming
-- against Voyage's docs for voyage-law-2 specifically. If it differs, this column
-- (and every embedding call) must match exactly.
create table public.chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  content text not null,
  embedding vector(1024) not null,
  page_number int,
  timestamp_seconds int,
  chunk_index int not null,
  created_at timestamptz not null default now()
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  question text not null,
  student_answer text not null,
  score numeric not null check (score >= 0 and score <= 1),
  ai_feedback text,
  topic text,
  created_at timestamptz not null default now()
);

create table public.flashcard_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  card_front text not null,
  card_back text not null,
  topic text,
  self_rating text check (self_rating in ('again', 'hard', 'good', 'easy')),
  reviewed_at timestamptz not null default now()
);

create table public.message_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  mode text not null check (mode in ('teach', 'quiz', 'flashcards', 'lookup')),
  topic text,
  rating text not null check (rating in ('up', 'down')),
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────

create index chunks_course_id_idx on public.chunks (course_id);
create index chunks_embedding_hnsw_idx on public.chunks using hnsw (embedding vector_cosine_ops);
create index documents_course_id_idx on public.documents (course_id);
create index quiz_attempts_user_course_idx on public.quiz_attempts (user_id, course_id);
create index flashcard_reviews_user_course_idx on public.flashcard_reviews (user_id, course_id);

-- ─────────────────────────────────────────────────────────────────
-- Helper: is_admin() — SECURITY DEFINER so it can read profiles
-- without recursing into the RLS policy that calls it.
-- ─────────────────────────────────────────────────────────────────

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ─────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.courses enable row level security;
alter table public.documents enable row level security;
alter table public.chunks enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.flashcard_reviews enable row level security;
alter table public.message_feedback enable row level security;

create policy "read own profile" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

create policy "admins manage invites" on public.invites
  for all using (public.is_admin()) with check (public.is_admin());

create policy "authenticated read courses" on public.courses
  for select using (auth.role() = 'authenticated');
create policy "admins write courses" on public.courses
  for insert with check (public.is_admin());
create policy "admins update courses" on public.courses
  for update using (public.is_admin());
create policy "admins delete courses" on public.courses
  for delete using (public.is_admin());

create policy "authenticated read documents" on public.documents
  for select using (auth.role() = 'authenticated');
create policy "admins write documents" on public.documents
  for insert with check (public.is_admin());
create policy "admins update documents" on public.documents
  for update using (public.is_admin());
create policy "admins delete documents" on public.documents
  for delete using (public.is_admin());

create policy "authenticated read chunks" on public.chunks
  for select using (auth.role() = 'authenticated');
create policy "admins write chunks" on public.chunks
  for insert with check (public.is_admin());
create policy "admins delete chunks" on public.chunks
  for delete using (public.is_admin());

create policy "own quiz attempts" on public.quiz_attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own flashcard reviews" on public.flashcard_reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own message feedback" on public.message_feedback
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────
-- New-user provisioning: reads a matching invite (if any) to decide
-- the role, writes the profiles row, marks the invite accepted.
-- ─────────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_invite public.invites%rowtype;
begin
  select * into matched_invite
  from public.invites
  where email = new.email and status = 'pending'
  order by created_at desc
  limit 1;

  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(matched_invite.role, 'student')
  );

  if matched_invite.id is not null then
    update public.invites set status = 'accepted' where id = matched_invite.id;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────
-- findRelevantContent tool backing: vector similarity search,
-- scoped to one course. RLS applies (SECURITY INVOKER, the default),
-- so this only returns what the calling user is allowed to see.
-- ─────────────────────────────────────────────────────────────────

create or replace function public.match_chunks(
  query_embedding vector(1024),
  match_course_id uuid,
  match_count int default 8
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  page_number int,
  timestamp_seconds int,
  similarity float
)
language sql
stable
as $$
  select
    chunks.id,
    chunks.document_id,
    chunks.content,
    chunks.page_number,
    chunks.timestamp_seconds,
    1 - (chunks.embedding <=> query_embedding) as similarity
  from public.chunks
  where chunks.course_id = match_course_id
  order by chunks.embedding <=> query_embedding
  limit match_count;
$$;

-- ─────────────────────────────────────────────────────────────────
-- getWeakTopics tool backing: always scoped to the calling user via
-- auth.uid() — no parameter for whose topics, so one student can't
-- query another's.
-- ─────────────────────────────────────────────────────────────────

create or replace function public.get_weak_topics(match_course_id uuid)
returns table (topic text, avg_score numeric, attempt_count bigint)
language sql
stable
as $$
  select topic, avg(score) as avg_score, count(*) as attempt_count
  from public.quiz_attempts
  where course_id = match_course_id
    and user_id = auth.uid()
    and topic is not null
  group by topic
  order by avg_score asc;
$$;
