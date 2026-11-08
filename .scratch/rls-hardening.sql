-- rls_hardening_ownership_and_splits (2026-11-08)
-- Closes the audit's §3 P0/P1 RLS holes before spec 44 (ai-assistant runs as the user and leans on RLS).
--   1. split_members: a member could edit any column of their own row (role -> organizer, split_id -> another split).
--   2. Ownership: INSERT/UPDATE on transactions, budgets, plans, bills, splits checked user_id only, never that
--      account_id / transfer_account_id / category_id / plan_id are the caller's own.
--   3. split_entry_shares: anyone could write shares on someone else's entry, for any member_id.

begin;

-- ---------- helpers: "is this id mine?" (null = nothing to check) ----------
create or replace function public.is_own_account(p_id uuid) returns boolean
  language sql stable security invoker set search_path = '' as $$
  select p_id is null or exists (select 1 from public.accounts a where a.id = p_id and a.user_id = (select auth.uid()))
$$;
create or replace function public.is_own_category(p_id uuid) returns boolean
  language sql stable security invoker set search_path = '' as $$
  select p_id is null or exists (select 1 from public.categories c where c.id = p_id and c.user_id = (select auth.uid()))
$$;
create or replace function public.is_own_plan(p_id uuid) returns boolean
  language sql stable security invoker set search_path = '' as $$
  select p_id is null or exists (select 1 from public.plans p where p.id = p_id and p.user_id = (select auth.uid()))
$$;

-- ---------- 1. split_members ----------
drop policy if exists split_members_update on public.split_members;
create policy split_members_update_organizer on public.split_members for update to authenticated
  using (public.split_role(split_id) = 'organizer')
  with check (public.split_role(split_id) = 'organizer');
create policy split_members_update_self on public.split_members for update to authenticated
  using (member_user_id = (select auth.uid()))
  with check (member_user_id = (select auth.uid()));
-- Column lock: no direct UPDATE may touch role, split_id, user_id, is_self, person_id or member_user_id.
-- The app never updates split_members directly; join_split is SECURITY DEFINER and unaffected.
revoke update on public.split_members from anon, authenticated;
grant update (display_name) on public.split_members to authenticated;

-- ---------- 2. ownership checks ----------
drop policy if exists transactions_insert_own on public.transactions;
create policy transactions_insert_own on public.transactions for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.is_own_account(account_id)
    and public.is_own_account(transfer_account_id)
    and public.is_own_category(category_id)
    and public.is_own_plan(plan_id)
  );
drop policy if exists transactions_update_own on public.transactions;
create policy transactions_update_own on public.transactions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and public.is_own_account(account_id)
    and public.is_own_account(transfer_account_id)
    and public.is_own_category(category_id)
    and public.is_own_plan(plan_id)
  );

drop policy if exists budgets_insert_own on public.budgets;
create policy budgets_insert_own on public.budgets for insert to authenticated
  with check ((select auth.uid()) = user_id and public.is_own_account(account_id) and public.is_own_category(category_id));
drop policy if exists budgets_update_own on public.budgets;
create policy budgets_update_own on public.budgets for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and public.is_own_account(account_id) and public.is_own_category(category_id));

drop policy if exists plans_insert_own on public.plans;
create policy plans_insert_own on public.plans for insert to authenticated
  with check ((select auth.uid()) = user_id and public.is_own_account(account_id));
drop policy if exists plans_update_own on public.plans;
create policy plans_update_own on public.plans for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and public.is_own_account(account_id));

drop policy if exists "Users manage own bills" on public.bills;
create policy bills_own on public.bills for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and public.is_own_category(category_id));

drop policy if exists splits_insert on public.splits;
create policy splits_insert on public.splits for insert to authenticated
  with check ((select auth.uid()) = user_id and public.is_own_account(account_id) and public.is_own_plan(plan_id));
drop policy if exists splits_update on public.splits;
create policy splits_update on public.splits for update to authenticated
  using (public.split_role(id) = 'organizer')
  with check (public.split_role(id) = 'organizer' and public.is_own_account(account_id) and public.is_own_plan(plan_id));

-- ---------- 3. split_entry_shares: only the entry's author or the organizer, and member_id must be in that split ----------
drop policy if exists split_entry_shares_insert on public.split_entry_shares;
create policy split_entry_shares_insert on public.split_entry_shares for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.split_entries e
      join public.split_members m on m.id = split_entry_shares.member_id and m.split_id = e.split_id
      where e.id = split_entry_shares.entry_id
        and (e.user_id = (select auth.uid()) or public.split_role(e.split_id) = 'organizer')
    )
  );
drop policy if exists split_entry_shares_update on public.split_entry_shares;
create policy split_entry_shares_update on public.split_entry_shares for update to authenticated
  using (exists (
    select 1 from public.split_entries e
    where e.id = split_entry_shares.entry_id
      and (e.user_id = (select auth.uid()) or public.split_role(e.split_id) = 'organizer')))
  with check (exists (
    select 1 from public.split_entries e
    join public.split_members m on m.id = split_entry_shares.member_id and m.split_id = e.split_id
    where e.id = split_entry_shares.entry_id
      and (e.user_id = (select auth.uid()) or public.split_role(e.split_id) = 'organizer')));
drop policy if exists split_entry_shares_delete on public.split_entry_shares;
create policy split_entry_shares_delete on public.split_entry_shares for delete to authenticated
  using (exists (
    select 1 from public.split_entries e
    where e.id = split_entry_shares.entry_id
      and (e.user_id = (select auth.uid()) or public.split_role(e.split_id) = 'organizer')));

commit;
