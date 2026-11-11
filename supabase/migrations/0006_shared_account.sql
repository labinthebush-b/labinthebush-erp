-- Conta compartilhada entre sócios: um login "membro" enxerga e edita os dados
-- de um login "dono". Os dados não mudam: user_id continua sendo o dono, e só
-- muda quem é aceito como ele. Sem linha em account_members, tudo continua
-- exatamente como antes (cada login é dono de si mesmo).

create table public.account_members (
  member_id uuid primary key references auth.users(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint account_members_not_self check (member_id <> owner_id)
);
create index account_members_owner_id_idx on public.account_members (owner_id);

-- RLS ligado e nenhuma policy de escrita de propósito: ninguém consegue se
-- adicionar à conta de outra pessoa pelo app. Só o SQL Editor/service role
-- adiciona ou remove membros.
alter table public.account_members enable row level security;
create policy "account_members_select_own" on public.account_members
  for select to authenticated using ((select auth.uid()) = member_id);

-- security definer: as policies de todas as tabelas chamam esta função, que lê
-- account_members independentemente do RLS dessa tabela.
create function public.current_account_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select owner_id from public.account_members where member_id = auth.uid()),
    auth.uid()
  );
$$;
revoke all on function public.current_account_id() from public, anon;
grant execute on function public.current_account_id() to authenticated;

-- Troca auth.uid() por current_account_id() em todas as policies de dados.
do $$
declare
  p record;
begin
  for p in
    select tablename, policyname, cmd
    from pg_policies
    where schemaname = 'public'
      and policyname like '%\_own'
      and tablename <> 'account_members'
  loop
    if p.cmd in ('SELECT', 'DELETE') then
      execute format('alter policy %I on public.%I using ((select public.current_account_id()) = user_id)', p.policyname, p.tablename);
    elsif p.cmd = 'INSERT' then
      execute format('alter policy %I on public.%I with check ((select public.current_account_id()) = user_id)', p.policyname, p.tablename);
    elsif p.cmd = 'UPDATE' then
      execute format('alter policy %I on public.%I using ((select public.current_account_id()) = user_id) with check ((select public.current_account_id()) = user_id)', p.policyname, p.tablename);
    end if;
  end loop;
end $$;

-- Imagens do Canvas: a pasta no bucket é o id do dono da conta.
alter policy "canvas_images_select_own" on storage.objects
  using (bucket_id = 'canvas-images' and (storage.foldername(name))[1] = (select public.current_account_id())::text);
alter policy "canvas_images_insert_own" on storage.objects
  with check (bucket_id = 'canvas-images' and (storage.foldername(name))[1] = (select public.current_account_id())::text);
alter policy "canvas_images_update_own" on storage.objects
  using (bucket_id = 'canvas-images' and (storage.foldername(name))[1] = (select public.current_account_id())::text)
  with check (bucket_id = 'canvas-images' and (storage.foldername(name))[1] = (select public.current_account_id())::text);
alter policy "canvas_images_delete_own" on storage.objects
  using (bucket_id = 'canvas-images' and (storage.foldername(name))[1] = (select public.current_account_id())::text);
