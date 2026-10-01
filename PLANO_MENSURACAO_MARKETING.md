# Plano de Mensuração — Módulo de Marketing (T5.1.a / T5.2.c)

**Status: proposta, aguardando aprovação do Berpz.** Documento, sem código — alimenta T5.3 (camada de dados + tela "Marketing") depois de aprovado. Tudo marcado **[DECIDIR]** depende de uma resposta sua; o resto já foi testado com chamadas reais e somente leitura, descritas em `progress.md`.

---

## 1. GA4 (T5.1)

### 1.1 Situação real hoje (propriedade `556768654`, últimos 7 dias)

| Métrica | Valor |
|---|---|
| Sessões | 14 |
| Usuários totais | 10 |
| Usuários ativos | 10 |

Eventos recebidos (contagem no período): `page_view` (34), `view_item_list` (28), `session_start` (14), `user_engagement` (14), `first_visit` (10), `scroll` (10), `view_item` (3), `form_start` (2), `add_payment_info` (1), `add_shipping_info` (1), `add_to_cart` (1), `begin_checkout` (1), `form_submit` (1), `view_cart` (1).

- ✅ `view_item`, `add_to_cart`, `begin_checkout` já chegam.
- ❌ **`purchase` não apareceu** nos últimos 7 dias — ou não houve nenhuma compra completada na loja nesse período, ou o evento não está disparando. **[DECIDIR]**: você confirma no DebugView fazendo uma compra de teste (conforme combinado, esse teste é seu, não meu).

### 1.2 Eventos que importam para o ERP

Funil de aquisição, na ordem: `view_item` → `add_to_cart` → `begin_checkout` → `purchase`. Todos já existem como *key events* padrão do GA4 para e-commerce — nenhuma configuração nova necessária além de confirmar que `purchase` dispara (1.1).

**Como cada um será usado**: a tela de Marketing (T5.3) mostra esse funil do GA4 **ao lado** das vendas já registradas no ERP (Nuvemshop/Instagram/WhatsApp) — como dois painéis lado a lado, não reconciliados automaticamente (reconciliar por pedido exigiria casar `transaction_id` do GA4 com o `id` da venda no ERP, o que não existe hoje e seria inventar um cruzamento que a especificação de T5.2.c não pediu). **[DECIDIR]**: isso é suficiente, ou você quer que eu avalie reconciliação por pedido numa fase futura?

### 1.3 Convenção de UTM

Padrão único, sempre em minúsculas e sem espaço:

```
utm_source=<canal>        (ex.: instagram, whatsapp, email)
utm_medium=<formato>      (ex.: bio, stories, post, organic)
utm_campaign=<nome>       (ex.: colecao-verao-2026, ou "organico" para tráfego constante sem campanha)
utm_content=<identificador>  (ex.: nome do criativo/link, para diferenciar dois links do mesmo post)
```

**[DECIDIR]**:
- Confirmar que esse padrão serve — ou já existe uma convenção diferente em uso?
- Definir os valores reais de `utm_campaign`/`utm_content` conforme as campanhas da marca forem surgindo (não dá para preencher isso agora, não há campanha documentada no projeto).

---

## 2. Instagram (T5.2)

### 2.1 O que a documentação oficial da Meta diz hoje

Fontes consultadas agora (API vigente, Instagram Graph API):
- Métricas de **conta**: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/insights
- Métricas de **mídia** (post/reel/story): https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-media/insights

**Conta** — métricas atuais: `accounts_engaged`, `comments`, `engaged_audience_demographics`, `follows_and_unfollows`, `follower_demographics`, `likes`, `profile_links_taps`, `reach`, `replies`, `reposts`, `saves`, `shares`, `total_interactions`, `views`. Limitações documentadas: `follows_and_unfollows`, `follower_demographics` e `engaged_audience_demographics` exigem **mínimo de 100 seguidores**; dados demográficos limitados a 45 resultados; atraso de até 48h nos dados. **Descontinuada**: `impressions` (substituída por `views`).

**Mídia** — métricas atuais: `comments`, `crossposted_views`, `facebook_views`, `follows`, `ig_reels_avg_watch_time`, `ig_reels_video_view_total_time`, `likes`, `link_clicks` (stories), `navigation` (stories), `profile_activity`, `profile_visits`, `reach`, `reels_skip_rate`, `replies` (stories), `reposts`, `saved`, `shares`, `total_interactions`, `views`. **Descontinuada**: `impressions` para mídia criada após 2 de julho de 2024. Álbuns não têm insights. Stories só têm métricas por 24h. `profile_activity` só existe para mídia criada após 26/10/2017.

Não confirmei (não estava na documentação consultada): cobertura ano a ano de retenção de dados históricos além do que os endpoints retornam por padrão — se precisar de histórico longo, isso exigiria decisão/teste à parte.

### 2.2 Métricas escolhidas, com justificativa — **todas testadas agora com chamadas reais**

**Nível de conta** (alimentam o agregado diário de T5.3):

| Métrica | Valor real testado | O que responde para a marca |
|---|---|---|
| `reach` | 81 | Quantas contas únicas viram o conteúdo da marca no período — tamanho do alcance orgânico. |
| `accounts_engaged` | 10 | Quantas contas de fato interagiram (não só viram) — força do engajamento real. |
| `total_interactions` | 13 | Soma de curtidas+comentários+salvamentos+compartilhamentos — termômetro simples de "quanto engajamento" sem abrir cada tipo. |
| `profile_links_taps` | 0 | Toques no link da bio — é o proxy mais próximo de "tráfego gerado pelo Instagram para a loja" sem UTM manual. Veio zero agora; pode ser falta de link configurado no bio. **[DECIDIR]**: confirmar se há um link ativo no bio hoje. |
| `views` | 131 | Substituta oficial de `impressions` (descontinuada) — quantas vezes o conteúdo foi exibido. |

**Não escolhidas agora**: `follows_and_unfollows`, `follower_demographics`, `engaged_audience_demographics` — exigem 100+ seguidores (documentado acima); **[DECIDIR]**: se a conta já tiver 100+ seguidores, me avise para eu testar e incluir essas também (demografia de seguidores pode ser valiosa para decisões de público).

**Nível de mídia (por post)** — testado num post real, todos retornaram dado:

| Métrica | Valor real testado |
|---|---|
| `reach` | 685 |
| `total_interactions` | 56 |
| `saved` | 3 |
| `shares` | 6 |
| `likes` | 34 |
| `comments` | 7 |

**[DECIDIR]**: a T5.2.c original perguntava se dá para relacionar um post a uma venda. Minha recomendação é **não** fazer isso agora — exigiria um identificador compartilhado entre post e venda que não existe (nem a Nuvemshop nem o Instagram dão isso de graça sem UTM manual por post, o que é um processo operacional novo, não técnico). Proponho: **T5.3 usa só as métricas de conta** (agregado diário) na primeira versão da tela; métricas por post ficam documentadas aqui, prontas, mas fora do escopo do MVP — revisitar só se você decidir que quer acompanhar post a post.

---

## 3. Resumo das decisões pendentes [DECIDIR]

1. Confirmar `purchase` disparando no GA4 (teste de compra seu, no DebugView).
2. Funil GA4 ao lado das vendas do ERP (sem reconciliação por pedido) é suficiente, ou quer reconciliação futura?
3. Aprovar a convenção de UTM proposta (seção 1.3) — os valores reais de campanha vêm depois, conforme surgirem.
4. Confirmar se há um link ativo no bio do Instagram (explica o `profile_links_taps = 0`).
5. A conta já tem 100+ seguidores? Se sim, incluo métricas de demografia.
6. Confirmar que T5.3 começa só com métricas de **conta** do Instagram (sem por-post) — meu recomendado.
