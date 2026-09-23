# O Eco no Grupo: Quem Decide o Que Roda? (exp07ef1b)

Missão do **7º ano · Unidade 1** da trilha Entre Redes. Um clone de WhatsApp
móvel em que o estudante investiga um boato num grupo de bairro, descobre que o
print que circula cortou o parágrafo da autorização do evento, e responde
citando a matéria completa.

Duas aulas, com um breakpoint entre elas. Quem abre a Aula 2, congela o debate e
libera a reflexão é a professora, pelo painel.

## Rodar

```bash
pnpm --filter @edu/exp07ef1b dev      # :5179
# no hub: http://localhost:3000/exp/exp07ef1b
# bancada:  http://localhost:3000/dev-embed?src=http://localhost:5179
```

A api precisa estar de pé (`pnpm dev` ou `pnpm docker:dev`): o conteúdo do
grupo, a matéria e as opções vêm de `/o-eco-no-grupo/sessao`, não do bundle.

## A mídia

As vozes e as fotos são **geradas** por IA e servidas do bucket de assets. Quem
prepara é o professor, no painel da turma — ou, em dev, pela linha de comando:

```bash
cd apps/api
ASSETS_LOCAL_DIR=/tmp/eco VERTEX_PROJECT_ID=<projeto> \
  npx ts-node --transpile-only scripts/smoke-midia-exp07ef1b.ts
```

Sem mídia preparada a missão roda igual: o áudio cai na transcrição e a foto na
ilustração procedural.

## Telemetria

`verbo:objeto` emitidos: `interacted:chat:*`, `interacted:audio:*`,
`interacted:midia:materia-completa`, `interacted:amara:*`,
`attempted:resposta:selecionada`, `scored:resposta:enviada`,
`interacted:resposta:desfeita`, `progressed:cards:*`,
`progressed:gate:breakpoint`, `progressed:feed:mensagem-fixada`,
`completed:missao:concluida`.

O texto que o estudante escreve para Amara **nunca** sai daqui: só a contagem de
turnos.

## O que fica no servidor

Gabarito das 3 opções, desfecho de cada caminho, gabarito do "Meu percurso",
pontuação e todos os prompts. Ver `apps/api/src/o-eco-no-grupo/`.
