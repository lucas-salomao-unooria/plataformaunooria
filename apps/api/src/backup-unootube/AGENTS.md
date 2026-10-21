# apps/api/src/backup-unootube — o UnooTube ARQUIVADO (backup-exp04ef1b)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

## O que é esta pasta

O UnooTube foi a missão do 4º ano, unidade 1, até 2026-09. O Jornal da Escola
tomou o código `exp04ef1b` (ADR-110: o código é derivado da série e da unidade),
e o UnooTube foi **arquivado** em vez de apagado (ADR-116): tudo o que era dele
ganhou o prefixo `backup-` — esta pasta, a experiência
(`apps/experiencias/backup-exp04ef1b`), a tabela (`backup_exp04ef1b_sessoes`) e
as linhas de `experiencias`, `liberacoes`, `progresso`, `equipes_*` e
`disponibilidades`.

## As três regras

1. **O módulo NÃO entra no `app.module`.** Nenhuma rota é servida: ninguém joga
   uma experiência arquivada. Registrar de volta NÃO desarquiva — a experiência
   saiu do catálogo, da grade e do deploy, e o `EXP_ID` `backup-exp04ef1b` nem
   passa no `EXP_ID_RE` das rotas da plataforma.
2. **O código continua compilando e os testes continuam rodando** (as specs
   `backup-unootube-*` em `apps/api/tests/`), contra a tabela arquivada. É o que o
   Lucas escolheu ao arquivar: guardar no lugar, e não numa pasta fora do
   workspace. Se uma mudança de plataforma quebrar esta pasta, conserte aqui —
   não apague.
3. **Os dados continuam no banco**, com RLS, e o `rostering` ainda os conta
   (`contasDeAssento`): apagar uma conta que tem sessão arquivada continua sendo
   apagar dado de uma criança.

A área `/unooria/arquivados` (só `admin`) lista o que está arquivado. Para
desarquivar, é preciso uma migração que desfaça os renames — e um código livre
na grade, que hoje não existe para o 4º ano, unidade 1.
