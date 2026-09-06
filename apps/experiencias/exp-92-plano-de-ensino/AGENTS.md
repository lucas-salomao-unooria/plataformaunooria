# apps/experiencias/exp-92-plano-de-ensino — planejamento de ensino do professor

Complementa o `AGENTS.md` da raiz. A raiz vence em conflito.

Ferramenta do PROFESSOR, não missão de estudante: seção `unooria` do DS
(`@edu/ui/ds`), marca institucional, sem viewport de aparelho. Porta de dev
**5180**; rota do hub `/professor/plano-de-ensino`; módulo da api
`apps/api/src/planejamento` + o currículo em `apps/api/src/curriculo`.

## Ela COEXISTE com a exp-90, e não a substitui

São ferramentas para redes diferentes, não versões da mesma coisa. A exp-90
gera um plano anual a partir do **currículo da rede importado como texto** —
serve a quem já tem documento curricular próprio e material didático adotado. A
exp-92 parte da **BNCC estruturada**, cobre todos os componentes do 1º ano do EF
à 3ª série do EM e desce até o plano de aula da semana.

Mexer numa não é mexer na outra. O único código compartilhado é
`planos/sanitizar.ts` (a allowlist do HTML do editor), reusada de propósito:
duas allowlists divergentes seriam duas superfícies de XSS.

## As quatro regras que quebram o produto se você não souber

**1. Componente da rede ≠ componente da BNCC — e no Ensino Médio eles não
coincidem.** A matriz da rede tem Biologia, Física e Química; a BNCC do EM só
desce até a ÁREA, e as três compartilham as habilidades de Ciências da Natureza
(`EM13CNT___`). Quem trata os dois como a mesma coisa mostra "nenhuma habilidade
encontrada" ao professor de Biologia do 2º ano, que é o caso mais comum do EM. O
mapeamento vive em `curriculo/componentes.ts` (`componenteBncc`), e
`habilidadesPorArea: true` é o que manda a tela AVISAR o professor. As duas
exceções são Língua Portuguesa e Matemática, os únicos componentes que a BNCC do
EM nomeia.

**2. O organizador tem três nomes, e o servidor manda o certo.** Sete
componentes usam "unidade temática", Língua Portuguesa usa prática de linguagem,
Língua Inglesa usa "eixo" e o EM agrupa por competência específica da área.
Use `rotuloDoOrganizador` da resposta; chamar tudo de "unidade temática" faz o
professor de Português não reconhecer o próprio currículo.

**3. O esqueleto das aulas NÃO vem do modelo.** Quantas aulas, em que data, em
que horário: sai de `calendario.ts`, da grade real do professor. O modelo só
preenche o conteúdo pedagógico das aulas que já existem, e `costurarAulas()`
descarta sobra e completa falta. Deixar o modelo decidir quantas aulas cabem
numa quinzena produzia dez — o número redondo — para um professor de Arte que
tem duas.

**4. Código de habilidade inventado é o pior defeito possível aqui.** Um plano
que cita `EF67LP42` chega à coordenação como erro do professor. Há três
barreiras, e todas devem continuar existindo: o prompt proíbe (R1/R2), o
`PUT .../distribuicao` recusa código fora do recorte, e `costurarAulas()` filtra
o que o modelo devolveu. Nenhuma sozinha basta.

## Carga horária: hora-aula não é hora-relógio

As 800h do EF e as **1.000h** do EM (LDB art. 24, I, redação da Lei
14.945/2024 — não são mais 800h) são horas de **60 minutos**. O Parecer CNE/CEB
8/2004 é literal: "não se pode considerar uma aula de 45 minutos igual a uma
hora". Toda conversão passa por `curriculo/carga-horaria.ts`; nunca escreva
`aulas === horas` numa tela nem num documento exportado.

A matriz de `carga-horaria.ts` é a **mediana de nove redes públicas**, não
obrigação legal: a BNCC não define grade horária, quem define é a rede (LDB art.
23 e 26; Parecer CNE/CEB 8/2004). A tela diz que é sugestão — mantenha.

## O início do ano letivo é da REGÊNCIA, não de `periodos_letivos`

Já custou um bug: `periodos_letivos` é catálogo do CONTRATO e o seed o preenche
como ano CIVIL (01/01–31/12). Como o calendário alinha cada período na
segunda-feira, o professor que declarava 02/02/2026 recebia um 1º bimestre
começando em **29/12/2025**. A coluna `inicio_do_ano_letivo` de
`exp_92_configuracoes` é o que vale; o catálogo é só sugestão do primeiro
preenchimento, e um "ano letivo" que abre em 1º de janeiro é descartado como ano
civil.

## Datas: meio-dia UTC, sempre

`calendario.ts` trabalha com data civil (`YYYY-MM-DD`) convertida ao **meio-dia
UTC**, nunca com `new Date()` local. Ao meio-dia nenhum fuso do Brasil (UTC-2 a
UTC-5) atravessa a meia-noite, então o dia da semana não escorrega — e uma aula
de segunda que vira domingo é o tipo de bug que passa no typecheck e sobrevive
até a impressão. Na tela, `dataCurta`/`dataLonga` fatiam a string; não jogue
data civil em `toLocaleDateString`.

Feriado **remove** a aula, não a desloca. Deslocar empurraria o plano inteiro e
desalinharia as 40 janelas seguintes; repor é decisão pedagógica do professor.

## Toda porta de exp entra no CORS da api

A 5180 precisa estar em `CORS_ORIGINS` (`apps/api/.env`, o fallback de
`apps/api/src/main.ts` e o `docker-compose.dev.yml`). Sem ela a experiência
carrega, o SDK conecta e o boot morre com `Failed to fetch` — foi exatamente o
que aconteceu na primeira subida, e o sintoma não menciona CORS na tela.

## Export: `.doc` e impressão

O `.doc` é HTML com os namespaces do MS Office (Word, Google Docs e LibreOffice
abrem como documento). Não é DOCX — mesma escolha da exp-90, e por isso as cores
vão como literais de token: o Word não resolve CSS variable.

A **impressão** escreve num iframe, não em `window.open`: a experiência já roda
dentro do iframe do hub, e um pop-up daqui é bloqueado — o professor clicaria em
"Imprimir" e nada aconteceria.

O documento do plano de período nasce das **aulas estruturadas**, não de prosa
formatada pelo modelo. É isso que garante que a aula editada na tela é a aula que
sai no papel, com o "AULA CUMPRIDA" que o professor marcou.
