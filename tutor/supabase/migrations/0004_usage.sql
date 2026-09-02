-- Admin usage indicator: how much of the Supabase free tier is used.
-- Run in the SQL Editor like the earlier migrations.
--
-- SECURITY DEFINER so it can read pg_database_size and storage.objects,
-- but it refuses non-admin callers itself.

create or replace function public.get_admin_usage()
returns json
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  storage_bytes bigint;
  db_bytes bigint;
  chunk_count bigint;
  document_count bigint;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  select coalesce(sum((metadata->>'size')::bigint), 0)
    into storage_bytes
    from storage.objects
    where bucket_id = 'course-files';

  select pg_database_size(current_database()) into db_bytes;
  select count(*) into chunk_count from public.chunks;
  select count(*) into document_count from public.documents;

  return json_build_object(
    'storage_bytes', storage_bytes,
    'db_bytes', db_bytes,
    'chunk_count', chunk_count,
    'document_count', document_count
  );
end;
$$;
