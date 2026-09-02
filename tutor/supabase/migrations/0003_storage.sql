-- Storage bucket for course files (PDFs, pasted-notes .txt, audio pending
-- transcription). Run in the Supabase SQL Editor like 0001/0002.
--
-- Files live at: <course_id>/<document_id>/<filename>
-- Private bucket: reads go through signed URLs or the server client.

insert into storage.buckets (id, name, public)
values ('course-files', 'course-files', false)
on conflict (id) do nothing;

-- Admins upload/replace/delete; any signed-in user can read (the group is
-- closed by invite-only signup, same trust model as the documents table).
create policy "admins upload course files" on storage.objects
  for insert with check (bucket_id = 'course-files' and public.is_admin());

create policy "admins update course files" on storage.objects
  for update using (bucket_id = 'course-files' and public.is_admin());

create policy "admins delete course files" on storage.objects
  for delete using (bucket_id = 'course-files' and public.is_admin());

create policy "authenticated read course files" on storage.objects
  for select using (bucket_id = 'course-files' and auth.role() = 'authenticated');
