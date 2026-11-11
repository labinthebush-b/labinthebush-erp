// Prova, no Supabase de DEV, o isolamento da conta compartilhada
// (0006_shared_account.sql) com três logins temporários: dono, sócio e estranho.
// Apaga tudo o que cria. Recusa rodar fora do projeto de DEV.
import { randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DEV_REF = "wyhrsizevngjqbbynkou";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!url.includes(DEV_REF)) throw new Error("Este script só roda no Supabase de DEV.");

const options = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(url, serviceKey, options);
const password = randomBytes(24).toString("hex");
const createdIds: string[] = [];
let failures = 0;

function check(name: string, ok: boolean) {
  console.log(`${ok ? "OK    " : "FALHOU"} ${name}`);
  if (!ok) failures++;
}

async function newUser(label: string): Promise<{ id: string; client: SupabaseClient }> {
  const email = `teste-${label}-${randomBytes(4).toString("hex")}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  createdIds.push(data.user.id);
  const client = createClient(url, anonKey, options);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

const contact = (userId: string, id: string) => ({ id, user_id: userId, name: "Teste isolamento", status: "lead" });

async function main() {
  const owner = await newUser("dono");
  const partner = await newUser("socio");
  const outsider = await newUser("estranho");

  const { error: selfJoin } = await outsider.client
    .from("account_members")
    .insert({ member_id: outsider.id, owner_id: owner.id });
  check("estranho não consegue se adicionar à conta", Boolean(selfJoin));

  const { error: linkError } = await admin.from("account_members").insert({ member_id: partner.id, owner_id: owner.id });
  if (linkError) throw linkError;

  const { data: partnerAccount } = await partner.client.rpc("current_account_id");
  check("sócio resolve para a conta do dono", partnerAccount === owner.id);
  const { data: outsiderAccount } = await outsider.client.rpc("current_account_id");
  check("estranho continua na própria conta", outsiderAccount === outsider.id);

  const ownerRow = randomUUID();
  const partnerRow = randomUUID();
  const { error: ownerInsert } = await owner.client.from("contacts").insert(contact(owner.id, ownerRow));
  check("dono cria registro", !ownerInsert);
  const { error: partnerInsert } = await partner.client.from("contacts").insert(contact(owner.id, partnerRow));
  check("sócio cria registro na conta", !partnerInsert);

  const seen = async (client: SupabaseClient) =>
    ((await client.from("contacts").select("id").eq("user_id", owner.id)).data ?? []).map((r) => r.id);
  check("sócio vê os dois registros", (await seen(partner.client)).length === 2);
  check("dono vê os dois registros", (await seen(owner.client)).length === 2);
  check("estranho não vê nada", (await seen(outsider.client)).length === 0);

  const { error: outsiderInsert } = await outsider.client.from("contacts").insert(contact(owner.id, randomUUID()));
  check("estranho não grava na conta", Boolean(outsiderInsert));
  const { data: outsiderDelete } = await outsider.client.from("contacts").delete().eq("id", ownerRow).select("id");
  check("estranho não apaga", (outsiderDelete ?? []).length === 0);
  const { data: partnerUpdate } = await partner.client
    .from("contacts")
    .update({ name: "Editado" })
    .eq("id", ownerRow)
    .select("id");
  check("sócio edita registro do dono", (partnerUpdate ?? []).length === 1);

  const file = new Blob(["x"], { type: "text/plain" });
  const { error: partnerUpload } = await partner.client.storage.from("canvas-images").upload(`${owner.id}/teste`, file);
  check("sócio envia imagem na pasta da conta", !partnerUpload);
  const { error: outsiderUpload } = await outsider.client.storage.from("canvas-images").upload(`${owner.id}/invasor`, file);
  check("estranho não envia imagem na pasta da conta", Boolean(outsiderUpload));
  await admin.storage.from("canvas-images").remove([`${owner.id}/teste`, `${owner.id}/invasor`]);

  // Log de atividades (0007_activity_log.sql)
  const logOf = async (client: SupabaseClient) =>
    (await client.from("activity_log").select("actor_id, action, entity_id").eq("user_id", owner.id)).data ?? [];
  const partnerLog = await logOf(partner.client);
  check(
    "log registra o autor certo",
    partnerLog.some((r) => r.entity_id === partnerRow && r.action === "created" && r.actor_id === partner.id) &&
      partnerLog.some((r) => r.entity_id === ownerRow && r.action === "created" && r.actor_id === owner.id)
  );
  check(
    "log registra a edição do sócio",
    partnerLog.some((r) => r.entity_id === ownerRow && r.action === "updated" && r.actor_id === partner.id)
  );
  check("estranho não vê o log", (await logOf(outsider.client)).length === 0);
  const { error: forgedLog } = await partner.client.from("activity_log").insert({
    user_id: owner.id,
    entity: "contacts",
    entity_id: "x",
    action: "created",
  });
  check("ninguém escreve no log pelo app", Boolean(forgedLog));
  const { data: erased } = await partner.client.from("activity_log").delete().eq("user_id", owner.id).select("id");
  check("ninguém apaga o log pelo app", (erased ?? []).length === 0);

  // O gatilho do log roda em toda tabela: uma falha nele impediria salvar ali.
  const now = new Date().toISOString();
  const base = { user_id: owner.id, created_at: now, updated_at: now };
  const productId = randomUUID();
  const rows: Record<string, Record<string, unknown>> = {
    products: { id: productId, name: "Produto", status: "ativo", cost_components: [], ...base },
    tasks: { id: randomUUID(), title: "Tarefa", status: "pendente", priority: "media", ...base },
    campaigns: { id: randomUUID(), name: "Campanha", channel: "outro", start_date: "2026-01-01", utm_source: "a", utm_medium: "b", utm_campaign: "c", ...base },
    stock_movements: { id: randomUUID(), product_id: productId, quantity: 1, kind: "entrada", date: "2026-01-01", ...base },
    sales: { id: randomUUID(), date: "2026-01-01", channel: "outro", total_amount: 12345, transaction_id: randomUUID(), ...base },
    transactions: { id: randomUUID(), type: "income", amount: 100, date: "2026-01-01", category: "venda", payment_source: "caixa", status: "pendente", description: "Lançamento", ...base },
  };
  for (const [table, row] of Object.entries(rows)) {
    const { error: insertError } = await partner.client.from(table).insert(row);
    check(`gatilho: sócio cria em ${table}`, !insertError);
    if (insertError) console.error(insertError.message);
  }
  for (const table of ["transactions", "sales", "tasks", "campaigns", "stock_movements", "products"]) {
    const { error: updateError } = await partner.client.from(table).update({ updated_at: new Date(0).toISOString() }).eq("id", rows[table].id);
    check(`gatilho: sócio edita em ${table}`, !updateError);
    const { error: deleteError } = await partner.client.from(table).delete().eq("id", rows[table].id);
    check(`gatilho: sócio apaga em ${table}`, !deleteError);
  }
  const { data: saleLog } = await partner.client.from("activity_log").select("summary").eq("entity", "sales").eq("action", "created").eq("user_id", owner.id);
  check("log da venda mostra valor e data", saleLog?.[0]?.summary === "de R$ 123,45 (2026-01-01)");

  const { error: partnerProfile } = await partner.client
    .from("user_profiles")
    .insert({ user_id: partner.id, account_id: owner.id, display_name: "Sócio" });
  check("sócio salva o próprio perfil", !partnerProfile);
  const { error: forgedProfile } = await partner.client
    .from("user_profiles")
    .insert({ user_id: owner.id, account_id: owner.id, display_name: "Falso" });
  check("sócio não cria perfil em nome de outro", Boolean(forgedProfile));
  const { data: ownerSeesProfile } = await owner.client.from("user_profiles").select("user_id").eq("account_id", owner.id);
  check("dono vê o perfil do sócio", (ownerSeesProfile ?? []).length === 1);
  const { data: outsiderSeesProfile } = await outsider.client.from("user_profiles").select("user_id").eq("account_id", owner.id);
  check("estranho não vê o perfil", (outsiderSeesProfile ?? []).length === 0);
  const photo = new Blob(["x"], { type: "image/png" });
  const { error: ownPhoto } = await partner.client.storage.from("user-avatars").upload(`${partner.id}/avatar`, photo);
  check("sócio envia a própria foto", !ownPhoto);
  const { error: otherPhoto } = await partner.client.storage.from("user-avatars").upload(`${owner.id}/avatar`, photo);
  check("sócio não envia foto na pasta de outro", Boolean(otherPhoto));
  await admin.storage.from("user-avatars").remove([`${partner.id}/avatar`, `${owner.id}/avatar`]);

  await admin.from("account_members").delete().eq("member_id", partner.id);
  check("sócio removido perde o acesso", (await seen(partner.client)).length === 0);
}

main()
  .catch((error) => {
    console.error(error);
    failures++;
  })
  .finally(async () => {
    for (const id of createdIds) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) {
        console.error(`Login temporário ${id} não foi apagado: ${error.message}`);
        failures++;
      }
    }
    console.log(failures ? `${failures} falha(s).` : "Tudo certo.");
    process.exitCode = failures ? 1 : 0;
  });
