# ERP — Protocolo de Orquestração do Desenvolvimento (loop)

Este arquivo é o protocolo oficial do loop de desenvolvimento autônomo do projeto. Ele orquestra dois agentes especializados — `.claude/agents/developer.md` e `.claude/agents/tester.md` — em ciclo, tarefa por tarefa, a partir do backlog em `TODO.md`.

Uma execução do loop processa **uma tarefa por vez**, do início (seleção) ao fim (conclusão validada), e só então seleciona a próxima.

---

## FASE 1 — Selecionar tarefa

1. Ler `CLAUDE.md`.
2. Ler `TODO.md`.
3. Ler `progress.md`.
4. Identificar a **primeira tarefa executável ainda não concluída** no backlog.
5. **Não escolher tarefas futuras ou fora do escopo** — só a próxima tarefa elegível, na ordem em que aparece no `TODO.md`. Uma tarefa é elegível quando suas dependências (se houver) já estão satisfeitas.
6. **Se não houver tarefa executável** (todas concluídas, ou todas as pendentes bloqueadas por credencial/decisão/ação externa), **parar** e informar isso claramente — não inventar trabalho, não "adiantar" uma tarefa bloqueada.

## FASE 2 — Developer

Delegar a implementação da tarefa selecionada ao agente `.claude/agents/developer.md`.

- O Developer trabalha **somente** na tarefa selecionada nesta fase — nada além dela.
- O Developer segue seu próprio protocolo interno (ler o código existente e suas dependências antes de alterar, implementar a menor mudança que atenda aos critérios de conclusão, não inventar funcionalidade, não enfraquecer teste existente).

## FASE 3 — Verificação inicial

Depois que o Developer terminar, antes de acionar o Tester:

1. Executar `npm test`.
2. Executar `npm run lint`.
3. Executar `npm run build` quando a alteração puder afetar o build.
4. Verificar `git diff` — o que mudou, de fato.
5. Verificar se a alteração ficou **dentro do escopo da tarefa** (nada a mais, nada de outra tarefa junto).

Se qualquer um desses falhar, isso volta para o Developer corrigir antes de prosseguir para a Fase 4 — não faz sentido acionar o Tester sobre uma implementação que ainda nem passa nos próprios testes.

## FASE 4 — Tester

Delegar a revisão ao agente `.claude/agents/tester.md`.

O Tester revisa a implementação **de forma independente** — não aceita "os testes passam" como prova de correção. Ele procura:

- bugs;
- regressões;
- cobertura insuficiente;
- testes falsos (que passam sem testar de verdade o comportamento pretendido);
- problemas de segurança;
- incompatibilidades com o banco (schema real vs. código/migrations);
- desvios dos critérios de conclusão da tarefa.

Quando relevante, o Tester usa testes adversariais ou de mutação para provar (não só afirmar) que a cobertura é real.

**O Tester nunca corrige a implementação.** Ele só investiga e relata.

## FASE 5 — Falha

Se o Tester encontrar problema(s):

1. Retornar o(s) problema(s) ao Developer, **exatamente como o Tester relatou** — o que é, onde está, e o que precisa ser corrigido.
2. O Developer corrige.
3. Repetir a Fase 3 (verificação inicial) sobre a correção.
4. Repetir a Fase 4 (Tester revisa de novo — inclusive a correção em si, não só o problema original).

Repetir esse ciclo até:
- o Tester aprovar explicitamente, **ou**
- surgir uma situação que exija intervenção humana (ver "Regras de segurança" abaixo) — nesse caso, parar e reportar, não insistir sozinho.

## FASE 6 — Conclusão

Uma tarefa só é considerada concluída quando **todos** os itens abaixo são verdadeiros:

- [ ] o Developer terminou a implementação;
- [ ] `npm test` passou;
- [ ] `npm run lint` passou;
- [ ] `npm run build` passou (quando aplicável);
- [ ] o Tester aprovou explicitamente;
- [ ] `TODO.md` foi atualizado (tarefa marcada como concluída);
- [ ] `progress.md` foi atualizado (o que foi feito, o que foi verificado).

Depois disso — e só depois disso — voltar à Fase 1 e selecionar a próxima tarefa.

---

## Regras de segurança

O loop:

- trabalha **somente** no ambiente DEV;
- **nunca** altera produção;
- **nunca** trabalha diretamente na branch `main`;
- **nunca** executa migrations de produção;
- **nunca** faz operações destrutivas;
- **nunca** faz push para produção;
- **nunca** faz merge `dev` → `main`;
- **nunca** pula uma tarefa porque parece difícil;
- **nunca** marca uma tarefa como concluída sem a validação completa da Fase 6.

Se uma tarefa exigir qualquer um dos itens abaixo, o loop **PARA** e pede intervenção humana — não tenta contornar, não improvisa, não assume autorização:

- credencial (token, chave, senha);
- decisão arquitetural importante;
- alteração de produção;
- migration potencialmente destrutiva;
- integração externa (serviço, conta, provedor novo);
- informação que não está disponível no projeto.

## Regras de contexto

Depois de cada tarefa:

- atualizar `progress.md`;
- manter `TODO.md` atualizado (o estado real do backlog, não uma cópia desatualizada);
- registrar decisões importantes tomadas durante o ciclo;
- **não duplicar documentação** — se a informação já existe em `progress.md`/`TODO.md`/`CLAUDE.md`, referenciar, não copiar;
- **não modificar arquivos de documentação sem necessidade** — só o que a tarefa concluída de fato mudou.

---

## Resumo visual do ciclo

```
FASE 1: Selecionar tarefa (CLAUDE.md + TODO.md + progress.md)
   │
   ├─ nenhuma tarefa executável → PARAR, informar
   │
   ▼
FASE 2: Developer implementa a tarefa selecionada
   ▼
FASE 3: npm test / lint / build + git diff + escopo
   │
   ├─ falhou → volta para o Developer corrigir, repete Fase 3
   │
   ▼
FASE 4: Tester revisa de forma independente
   │
   ├─ encontrou problema → FASE 5: Developer corrige → Fase 3 → Fase 4 de novo
   │  (repete até aprovar ou exigir intervenção humana)
   │
   ▼ (Tester aprovou)
FASE 6: checklist completo → TODO.md + progress.md atualizados
   ▼
volta à FASE 1 (próxima tarefa)
```

Este arquivo define o protocolo. Ele não dispara sozinho — uma execução do loop começa quando explicitamente pedida.
