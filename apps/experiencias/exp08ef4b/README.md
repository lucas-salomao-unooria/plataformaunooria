# exp08ef4b — O Manifesto da IA: Nossos Direitos em Código

8º ano do Ensino Fundamental, 4º bimestre (unidade 4). Clone do ChatGPT.

O estudante entra na conversa do "EduPredict IA", o sistema que a direção quer
instalar para prever notas e monitorar presença. A máquina abre dizendo que
algoritmos são neutros; ele a questiona sobre a origem dos dados históricos,
ela admite que herda as punições do passado — e então pede que ele fixe **uma**
cláusula de governança. O sistema compila o Manifesto de Direitos Digitais dos
Estudantes com a cláusula dele em destaque, e ele assina a escolha no Meu
Percurso.

~45 minutos, em seis etapas. O professor pode congelar a turma ao fim da Etapa 3
para o debate oral de 10 minutos.

## Rodar

```bash
pnpm --filter @edu/exp08ef4b dev     # :5182
# no hub: /exp/exp08ef4b  (ou /dev-embed?src=http://localhost:5182)
```

A porta entra no `CORS_ORIGINS` da api (`apps/api/.env`, `docker-compose.yml`,
`docker-compose.dev.yml`). Sem ela o boot morre com "Failed to fetch", e o erro
não diz por quê.

Precisa de: a missão LIBERADA na turma do estudante (o seed de demo já libera na
8A) e o produto `entre-redes` ligado no painel da Unooria.

## Onde as coisas estão

| O quê | Onde |
|---|---|
| Máquina de estados da tela (+ teste) | `src/lib/maquina-estados.ts` |
| Copy que a TELA escreve | `src/lib/textos.ts` |
| Conteúdo do diálogo (réplicas, cláusulas, podcast) | `apps/api/src/manifesto-ia/catalogo.ts` |
| Regras e rotas do servidor | `apps/api/src/manifesto-ia/` |
| Painel do professor e preparo | hub, `/professor/entre-redes/8-ano/unidade-4/resultados` |
| Suíte de ponta a ponta | `scripts/e2e/estudante/08-manifesto-ia.mjs` |

## Telemetria

`verbo:objeto` via `@edu/sdk`. O parágrafo do Meu Percurso **nunca** sai: do
texto vai só o tamanho. Verbos: `interacted` (questionamento, cópia,
transcrição), `scored` (a cláusula fixada), `indicative` (as palavras-chave),
`progressed` (as etapas), `completed` (o encerramento).

## A doutrina desta pasta está no `AGENTS.md` ao lado

As quatro regras que quebram a missão se você não as souber, a lista das lacunas
do design system com os pedidos nomeados, e por que os áudios ainda não existem.
