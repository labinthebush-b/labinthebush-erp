-- Log de atividades: mudanças feitas pela IA (/api/mcp) aparecem em nome de
-- quem é dono da chave, marcadas com o nome da chave (ex.: "Claude").
-- Depende de 0002 (ai_api_keys), 0006 (account_members) e 0007 (activity_log).
--
-- Como o gatilho sabe que foi a IA: o /api/mcp grava com a service role (sem
-- sessão, auth.uid() é nulo) e manda o header x-erp-ai-key-id com o id da
-- chave já validada. O header só é lido quando a requisição é da service role
-- — um usuário logado não consegue se passar por outro mandando o header — e a
-- chave precisa pertencer à mesma conta do registro alterado.

alter table public.activity_log add column via text;

create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec jsonb := to_jsonb(coalesce(new, old));
  account uuid := (rec ->> 'user_id')::uuid;
  label text;
  v_actor uuid := auth.uid();
  v_actor_email text := auth.jwt() ->> 'email';
  v_via text;
  v_key text;
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

  if v_actor is null and coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    v_key := nullif(current_setting('request.headers', true), '')::json ->> 'x-erp-ai-key-id';
    if v_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select k.user_id, k.name into v_actor, v_via
      from public.ai_api_keys k
      where k.id = v_key::uuid
        and (k.user_id = account
          or exists (select 1 from public.account_members m where m.member_id = k.user_id and m.owner_id = account));
      if v_actor is not null then
        select u.email into v_actor_email from auth.users u where u.id = v_actor;
        v_via := coalesce(nullif(trim(v_via), ''), 'IA');
      end if;
    end if;
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

  insert into public.activity_log (user_id, actor_id, actor_email, entity, entity_id, action, summary, via)
  values (
    account,
    v_actor,
    v_actor_email,
    tg_table_name,
    rec ->> 'id',
    case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end,
    label,
    v_via
  );
  return null;
end;
$$;
revoke all on function public.log_activity() from public, anon, authenticated;
