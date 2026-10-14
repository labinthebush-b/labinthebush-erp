# Plano — Aba Marketing como leitura e análise (atribuição)

Status: **etapa 1 implementada no DEV (2026-10-14), aguardando validação.** Etapas 2–8 só começam depois de validar a anterior.

Princípios: sem API de IA (painel "Estrategista com IA" removido; "O que fazer agora" segue com regras fixas). A aba mostra, compara e registra origem e aprendizados — não planeja posts nem gerencia testes. Amostra pequena é sinalizada na tela.

## Tabelas e campos novos

| Etapa | Migration | O que muda |
|---|---|---|
| 1 Campanhas | **0005** | `campaigns` (nome, canal instagram/site/dm/outro, início, fim, custo opcional, observação, `utm_source`, `utm_medium`, `utm_campaign` único por usuário). `instagram_posts` (id do post no Instagram, `campaign_id` opcional, `tags` jsonb — as tags já ficam prontas para a etapa 5). |
| 2 Origem (UTM) | 0006 | `sales` e `contacts` ganham `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `campaign_id`. Sem UTM = "direto". |
| 3 Fonte do lead | 0006 (junto) | `contacts.origin` (utm, dm_post, dm_direto, indicacao, evento, outro) + `origin_post_id`. Venda herda a origem do contato quando não tiver a própria. |
| 4 Cupons | 0007 | `coupons` (código, `campaign_id`, `post_id`, tipo de desconto — pode ser 0 —, valor, validade, limite de uso). `sales.coupon_id`. O desconto da venda continua no modelo atual (`discounts`), o cupom só aponta para ele e preenche a origem. |
| 5 Posts | — (usa 0005) | Métricas por post lidas ao vivo do Instagram (sem tabela de métrica). Tags e campanha ficam em `instagram_posts`. |
| 6 Comparação / Produto | 0008 | `marketing_learnings` (texto do aprendizado + ids dos posts comparados). Produto × marketing usa GA4 `itemName` + vendas + estoque já existentes. |
| 7 Segmentos | — | Calculados na hora a partir do ERP (sem tabela); export CSV. Estrutura RFM pronta, desligada até haver volume. |
| 8 Automação | 0009 | `contact_consents` (contato, canal, consentido, data, origem do consentimento — LGPD), `automations` (gatilho, segmento, canal, mensagem, ativa), `automation_sends` (envio, status, venda atribuída). |

## Dependências externas (documentadas, não assumidas)

- **Plataforma do site (Nuvemshop)** — etapa 2. O ERP só recebe a UTM se a loja repassar: (a) a API de pedidos da Nuvemshop pode trazer a URL de entrada do cliente — **a confirmar** com um pedido real; ou (b) script na loja que guarda a UTM no navegador e a envia no checkout — **depende de a Nuvemshop permitir script/campo extra no checkout**, a confirmar no plano contratado; ou (c) registro manual no ERP (sempre possível). Hoje as vendas são lançadas à mão no ERP, então até (a)/(b) existirem a origem vem de cupom (etapa 4) ou é marcada manualmente (etapa 3).
- **Google Analytics 4** — já conectado (leitura). Visitas por campanha usam a dimensão `sessionCampaignName`; dependem de o link usado ter a UTM. Evento `purchase` hoje **não** chega do site (ver "O que fazer agora").
- **Instagram** — conta profissional já conectada; métricas de conta e de post funcionam com o acesso atual (testado). Cliques em link de post não existem como métrica de post no feed (só `link_clicks` em stories) — documentado na etapa 5. O token expira (~60 dias).
- **Provedor de mensagens** — etapa 8, a escolher: e-mail (ex.: Brevo/Resend — sem aprovação), WhatsApp (API oficial da Meta — exige conta Business verificada e modelos de mensagem aprovados), SMS (ex.: Zenvia/Twilio). Começa só com carrinho abandonado, e carrinho abandonado **depende da etapa 2** (o ERP precisa saber do carrinho, o que hoje só o site sabe).

## Etapa 1 — o que foi entregue

- Cadastro de campanhas (nome, canal, datas, custo, observação) com UTM gerada a partir do nome, único por usuário.
- Link rastreável da campanha pelo gerador existente, com source/medium/campaign travados na campanha e `content` livre.
- Ligar posts do Instagram à campanha (lista dos posts recentes da conta).
- Página da campanha: alcance dos posts ligados e visitas ao site (GA4, por `utm_campaign`) **ao vivo**; contatos, vendas e receita atribuídos aparecem como "a partir da etapa 2/3/4" até existirem os campos de origem. Custo por visita quando há custo.
