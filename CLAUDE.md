@AGENTS.md
# ERP — Project Instructions

## Objetivo

Este projeto é o ERP interno da marca.

O sistema controla:

- Caixa
- Resultado/DRE
- Fluxo de caixa
- Capital do proprietário
- Despesas
- Vendas
- Produtos
- Contatos
- Cupons
- Taxas da Nuvemshop
- Tarefas
- Canvas
- Relatórios
- Dashboard

## Stack

- React
- TypeScript
- Supabase
- Vercel
- [demais tecnologias existentes no projeto]

## Ambientes

DEV é o ambiente padrão para desenvolvimento.

PROD contém dados reais.

NUNCA:
- executar migrations diretamente em PROD
- alterar dados reais de PROD durante testes
- fazer operações destrutivas sem confirmação
- apagar dados para fazer testes

Fluxo obrigatório:

DEV
→ testes
→ revisão
→ aprovação
→ PROD

## Regra principal

Antes de implementar qualquer coisa:

1. Entender a arquitetura existente.
2. Procurar funcionalidades relacionadas.
3. Verificar migrations existentes.
4. Verificar testes existentes.
5. Planejar a alteração.
6. Implementar.
7. Rodar testes.
8. Corrigir os erros encontrados.
9. Rodar novamente.
10. Verificar regressões.
11. Só considerar concluído quando os testes passarem.

## Banco de dados

Nunca criar uma estrutura duplicada quando já existir uma entidade ou função equivalente.

Sempre verificar:
- migrations
- types
- queries
- services
- hooks
- componentes relacionados

## Testes

Testes nunca devem ser removidos ou enfraquecidos apenas para fazer a suíte passar.

Se um teste estiver errado, explicar o motivo antes de alterá-lo.

## Segurança

Operações destrutivas, migrations de produção, alterações de dados reais,
git push, force push e mudanças irreversíveis exigem confirmação explícita.

## Princípio

Preferir soluções simples e consistentes com a arquitetura existente.

Não criar abstrações ou funcionalidades que não foram solicitadas.