-- Fix invite-status bug: stop marking invites 'accepted' when the auth user
-- is created (Supabase does this immediately on invite send, before the
-- recipient clicks anything). Instead, the /auth/callback route now marks
-- the invite accepted only after a real sign-in happens.

-- Drop and recreate handle_new_user without the false-positive status update.
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

  -- NOTE: invites are marked 'accepted' in the /auth/callback route when
  -- the user actually clicks the sign-in link. Do NOT update status here.

  return new;
end;
$$;

-- Revert false-positive accepts: if an auth user exists but has never
-- completed a sign-in callback, revert their invite to 'pending'.
-- This catches invites that were already sent and falsely accepted.
-- (Users who genuinely clicked the link will have a session in auth.sessions.)
update public.invites
set status = 'pending'
where status = 'accepted'
  and email not in (
    select u.email
    from auth.users u
    join auth.sessions s on s.user_id = u.id
  );
