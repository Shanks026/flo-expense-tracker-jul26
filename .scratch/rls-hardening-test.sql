-- Verification for rls_hardening_ownership_and_splits. Everything is rolled back.
begin;
create temp table t_results (n serial, test text, outcome text);
grant all on t_results to authenticated;
grant usage, select on sequence t_results_n_seq to authenticated;

do $$
declare
  me uuid := 'c99e7b74-eea7-4b0d-8b71-b08e8a4b522e';
  other uuid := gen_random_uuid();
  my_acc uuid; other_acc uuid; my_cat uuid; other_cat uuid; my_split uuid; my_member uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (other, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'rls-test-' || other || '@example.invalid', '{}', '{}', now(), now());
  select id into other_acc from public.accounts where user_id = other limit 1;
  if other_acc is null then insert into public.accounts (user_id, name) values (other, 'x') returning id into other_acc; end if;
  select id into other_cat from public.categories where user_id = other limit 1;
  if other_cat is null then insert into public.categories (user_id, name, type, icon) values (other, 'x', 'expense', 'circle') returning id into other_cat; end if;
  select id into my_acc from public.accounts where user_id = me limit 1;
  select id into my_cat from public.categories where user_id = me and type = 'expense' limit 1;
  select s.id into my_split from public.splits s where s.user_id = me limit 1;
  -- A solo split's self row has member_user_id = null, so take the self row (or any member) of the split.
  select m.id into my_member from public.split_members m where m.split_id = my_split order by m.is_self desc limit 1;

  perform set_config('request.jwt.claims', json_build_object('sub', me, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  begin insert into public.transactions (user_id, account_id, type, amount, occurred_at, category_id) values (me, my_acc, 'expense', 1, current_date, my_cat);
    insert into t_results (test, outcome) values ('own transaction insert', 'allowed');
  exception when others then insert into t_results (test, outcome) values ('own transaction insert', 'REFUSED (bad): ' || sqlerrm); end;

  begin insert into public.transactions (user_id, account_id, type, amount, occurred_at) values (me, other_acc, 'expense', 1, current_date);
    insert into t_results (test, outcome) values ('transaction on another user''s account', 'ALLOWED (bad)');
  exception when others then insert into t_results (test, outcome) values ('transaction on another user''s account', 'refused: ' || left(sqlerrm, 70)); end;

  begin insert into public.transactions (user_id, account_id, type, amount, occurred_at, category_id) values (me, my_acc, 'expense', 1, current_date, other_cat);
    insert into t_results (test, outcome) values ('transaction with another user''s category', 'ALLOWED (bad)');
  exception when others then insert into t_results (test, outcome) values ('transaction with another user''s category', 'refused: ' || left(sqlerrm, 70)); end;

  begin update public.transactions set account_id = other_acc where id = (select id from public.transactions where user_id = me limit 1);
    insert into t_results (test, outcome) values ('move own transaction to another user''s account', 'ALLOWED (bad)');
  exception when others then insert into t_results (test, outcome) values ('move own transaction to another user''s account', 'refused: ' || left(sqlerrm, 70)); end;

  begin insert into public.budgets (user_id, account_id, name, amount, period_type, category_id) values (me, my_acc, 't', 100, 'calendar_month', my_cat);
    insert into t_results (test, outcome) values ('own budget insert', 'allowed');
  exception when others then insert into t_results (test, outcome) values ('own budget insert', 'REFUSED (bad): ' || sqlerrm); end;

  begin insert into public.budgets (user_id, account_id, name, amount, period_type) values (me, other_acc, 't', 100, 'calendar_month');
    insert into t_results (test, outcome) values ('budget on another user''s account', 'ALLOWED (bad)');
  exception when others then insert into t_results (test, outcome) values ('budget on another user''s account', 'refused: ' || left(sqlerrm, 70)); end;

  begin insert into public.bills (user_id, name, amount, cadence, next_due_date, category_id) values (me, 't', 100, 'monthly', current_date, my_cat);
    insert into t_results (test, outcome) values ('own bill insert', 'allowed');
  exception when others then insert into t_results (test, outcome) values ('own bill insert', 'REFUSED (bad): ' || sqlerrm); end;

  begin insert into public.bills (user_id, name, amount, cadence, next_due_date, category_id) values (me, 't', 100, 'monthly', current_date, other_cat);
    insert into t_results (test, outcome) values ('bill with another user''s category', 'ALLOWED (bad)');
  exception when others then insert into t_results (test, outcome) values ('bill with another user''s category', 'refused: ' || left(sqlerrm, 70)); end;

  begin update public.split_members set display_name = display_name where id = my_member;
    insert into t_results (test, outcome) values ('member edits own display_name', 'allowed');
  exception when others then insert into t_results (test, outcome) values ('member edits own display_name', 'REFUSED (bad): ' || sqlerrm); end;

  begin update public.split_members set role = role where id = my_member;
    insert into t_results (test, outcome) values ('direct update of split_members.role', 'ALLOWED (bad)');
  exception when others then insert into t_results (test, outcome) values ('direct update of split_members.role', 'refused: ' || left(sqlerrm, 70)); end;

  begin update public.split_members set split_id = split_id where id = my_member;
    insert into t_results (test, outcome) values ('direct update of split_members.split_id', 'ALLOWED (bad)');
  exception when others then insert into t_results (test, outcome) values ('direct update of split_members.split_id', 'refused: ' || left(sqlerrm, 70)); end;

  begin insert into public.split_entry_shares (user_id, entry_id, member_id, amount)
    select me, e.id, my_member, 1 from public.split_entries e where e.split_id = my_split and e.user_id = me limit 1;
    insert into t_results (test, outcome) values ('share on own entry, member of the split', 'allowed');
  exception when others then insert into t_results (test, outcome) values ('share on own entry, member of the split', 'REFUSED (bad): ' || sqlerrm); end;

  execute 'reset role';
end $$;

select n, test, outcome from t_results order by n;
rollback;
