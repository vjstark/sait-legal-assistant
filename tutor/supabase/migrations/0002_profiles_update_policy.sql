-- Fixes onboarding/settings silently failing: the initial migration only
-- gave users SELECT on their own profiles row, never UPDATE.
-- Run this in the Supabase SQL Editor the same way as 0001.

create policy "update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Prevent a student from self-promoting to admin via that same policy —
-- everything except `role` stays updatable by the row's own owner.
revoke update (role) on public.profiles from authenticated;
