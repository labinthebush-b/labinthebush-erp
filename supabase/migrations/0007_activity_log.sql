-- Perfil de cada login (nome e foto) e log de atividades da conta.
-- Depende de 0006_shared_account.sql (current_account_id).

create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_id uuid not null references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  updated_at timestamptz not null default now()
);
create index user_profiles_account_id_idx on public.user_profiles (account_id);

alter table public.user_profiles enable row level security;
create policy "user_profiles_select_account" on public.user_profiles for select to authenticated
  using ((select public.current_account_id()) = account_id);
create policy "user_profiles_insert_self" on public.user_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id and (select public.current_account_id()) = account_id);
create policy "user_profiles_update_self" on public.user_profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and (select public.current_account_id()) = account_id);

-- Fotos: leitura pública pela URL, escrita só na pasta do próprio login.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('user-avatars', 'user-avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "user_avatars_select_self" on storage.objects for select to authenticated
  using (bucket_id = 'user-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "user_avatars_insert_self" on storage.objects for insert to authenticated
  with check (bucket_id = 'user-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "user_avatars_update_self" on storage.objects for update to authenticated
  using (bucket_id = 'user-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'user-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "user_avatars_delete_self" on storage.objects for delete to authenticated
  using (bucket_id = 'user-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- actor_id vazio = feito sem sessão de usuário (IA via /api/mcp).
create table public.activity_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  entity text not null,
  entity_id text not null,
  action text not null check (action in ('created', 'updated', 'deleted')),
  summary text,
  created_at timestamptz not null default now()
);
create index activity_log_user_created_idx on public.activity_log (user_id, created_at desc);

-- Só leitura: nenhuma policy de escrita, então ninguém edita ou apaga o histórico
-- pelo app. As linhas entram apenas pelo gatilho abaixo.
alter table public.activity_log enable row level security;
create policy "activity_log_select_account" on public.activity_log for select to authenticated
  using ((select public.current_account_id()) = user_id);

create function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec jsonb := to_jsonb(coalesce(new, old));
  account uuid := (rec ->> 'user_id')::uuid;
  label text;
begin
  -- Edição que não mudou nada além de updated_at não é atividade.
  if tg_op = 'UPDATE' and (to_jsonb(new) - 'updated_at') = (to_jsonb(old) - 'updated_at') then
    return null;
  end if;
  -- Saída de estoque gerada por uma venda: a venda já aparece no log.
  if tg_table_name = 'stock_movements' and rec ->> 'sale_id' is not null then
    return null;
  end if;
  -- Lançamentos gerados por uma venda: a venda já aparece no log. Só entra a
  -- mudança de status (ex.: marcar como pago), que é uma ação à parte.
  if tg_table_name = 'transactions' and rec -> 'relations' ->> 'saleId' is not null
    and (tg_op <> 'UPDATE' or (to_jsonb(new) ->> 'status') is not distinct from (to_jsonb(old) ->> 'status')) then
    return null;
  end if;
  -- Parcela gerada sozinha por uma regra de recorrência: ninguém a adicionou.
  if tg_table_name = 'transactions' and tg_op = 'INSERT' and rec -> 'relations' ->> 'recurrenceId' is not null then
    return null;
  end if;
  -- Login sendo apagado: as linhas somem em cascata e não há conta onde registrar.
  if not exists (select 1 from auth.users where id = account) then
    return null;
  end if;

  label := case tg_table_name
    when 'tasks' then rec ->> 'title'
    when 'transactions' then rec ->> 'description'
    when 'sales' then concat(
      'de R$ ',
      replace(to_char((rec ->> 'total_amount')::numeric / 100, 'FM9999999990.00'), '.', ','),
      ' (', rec ->> 'date', ')'
    )
    when 'stock_movements' then concat_ws(' ', rec ->> 'quantity', rec ->> 'size', rec ->> 'color')
    else rec ->> 'name'
  end;

  insert into public.activity_log (user_id, actor_id, actor_email, entity, entity_id, action, summary)
  values (
    account,
    auth.uid(),
    auth.jwt() ->> 'email',
    tg_table_name,
    rec ->> 'id',
    case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end,
    label
  );
  return null;
end;
$$;
revoke all on function public.log_activity() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['products', 'contacts', 'transactions', 'sales', 'tasks', 'campaigns', 'stock_movements']
  loop
    execute format(
      'create trigger log_activity after insert or update or delete on public.%I for each row execute function public.log_activity()',
      t
    );
  end loop;
end $$;
