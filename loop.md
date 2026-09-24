# ERP Autonomous Development Loop

Execute uma iteração completa de desenvolvimento.

1. Leia CLAUDE.md.
2. Leia progress.md.
3. Verifique o estado atual do Git.
4. Identifique a próxima tarefa prioritária.
5. Analise a implementação existente antes de modificar qualquer coisa.
6. Implemente a tarefa.
7. Execute lint.
8. Execute testes unitários.
9. Execute testes de integração.
10. Execute testes E2E quando aplicável.
11. Se houver erro:
    - investigue a causa;
    - corrija a implementação;
    - execute novamente os testes.
12. Não altere ou remova testes apenas para fazê-los passar.
13. Atualize progress.md.
14. Se tudo estiver passando, avance para a próxima tarefa.
15. Se encontrar uma decisão arquitetural importante, pare e peça confirmação.
16. Nunca execute alterações em PROD.
17. Nunca execute migrations de PROD.
18. Nunca faça operações destrutivas sem confirmação.

Continue trabalhando até:
- a tarefa atual estar concluída;
- surgir uma decisão que exija intervenção humana;
- ou não existir nenhuma tarefa segura para executar.