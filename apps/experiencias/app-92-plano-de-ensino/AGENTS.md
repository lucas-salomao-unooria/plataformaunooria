# apps/experiencias/app-92-plano-de-ensino — planejamento de ensino do professor

Complementa o `AGENTS.md` da raiz. A raiz vence em conflito.

Ferramenta do PROFESSOR, não missão de estudante: seção `unooria` do DS
(`@edu/ui/ds`), marca institucional, sem viewport de aparelho. Porta de dev
**5180**; rota do hub `/professor/plano-de-ensino`; módulo da api
`apps/api/src/planejamento` + o currículo em `apps/api/src/curriculo`.

## Ela COEXISTE com a app-90, e não a substitui

São ferramentas para redes diferentes, não versões da mesma coisa. A app-90
gera um plano anual a partir do **currículo da rede importado como texto** —
serve a quem já tem documento curricular próprio e material didático adotado. A
app-92 parte da **BNCC estruturada**, cobre todos os componentes do 1º ano do EF
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
descarta sobra e completa falta. Deixar o modelo decidir quantas aulas cabem na
semana produzia cinco — o número redondo — para um professor de Arte que tem
uma.

**4. Código de habilidade inventado é o pior defeito possível aqui.** Um plano
que cita `EF67LP42` chega à coordenação como erro do professor. Há três
barreiras, e todas devem continuar existindo: o prompt proíbe (R1/R2), o
`PUT .../distribuicao` recusa código fora do recorte, e `costurarAulas()` filtra
o que o modelo devolveu. Nenhuma sozinha basta.

## O `Collapse` do DS sequestra o teclado, e a compensação é obrigatória

**LACUNA REAL DO DS.** O `Collapse` esconde o corpo com
`grid-template-rows: 0fr` + `opacity: 0` + `aria-hidden="true"`, e nada disso
remove do FOCO — nem `inert`, nem `visibility`, nem `display: none`. Descendente
focável dentro de `aria-hidden="true"` é foco fantasma: o Tab entra e o leitor
de tela não anuncia nada, porque para ele aquilo não existe.

Sem ela, os três bimestres fechados deixam **30 botões de semana** recebendo
foco. A compensação está em `src/estilos/globals.css`
(`visibility: hidden` no corpo com `aria-hidden="true"`, com o delay que preserva
a animação), marcada, e **morre quando o pacote publicar `inert`** — pedido
aberto no `storybook-unooria`.

**A suíte `professor/09` conta os focáveis e reprova se voltarem.** Não remova a
compensação sem o pacote: passa no typecheck, passa no build, e o defeito só
aparece navegando por teclado.

E ela é a razão de um segundo cuidado: o corpo fechado FICA no DOM, então
`locator(...).filter(...)` acha conteúdo de bimestre fechado, o Playwright o
considera visível e o clique morre interceptado. Quem automatiza esta tela abre
os bimestres antes de procurar.

## `pendente` é "ninguém disparou", não "está em andamento"

O enum é `pendente | gerando | pronto | erro`, e só `gerando` significa trabalho
correndo no servidor: quem dispara recebe `gerando` do claim na mesma
requisição. Tratar `pendente` como "gerando" prendeu um professor numa tela que
mostrava barra de progresso e "pode fechar: a geração continua no servidor" com
NADA acontecendo — e o polling relia `pendente` a cada 3s, para sempre. O botão
de gerar estava logo acima, mas a promessa venceu o botão.

A causa estrutural eram três condições independentes no JSX para três blocos
que precisam ser exclusivos: nada impede a segunda de esquecer o que a primeira
cobriu. Quem decide agora é `lib/estado-do-plano.ts`, num valor só. **Bloco novo
nessa tela entra por lá**, não como mais um `&&` no meio do `return`.

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
`app_92_configuracoes` é o que vale; o catálogo é só sugestão do primeiro
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
desalinharia as 40 semanas seguintes; repor é decisão pedagógica do professor.

## Toda porta de exp entra no CORS da api — e trocar de branch não basta

A 5180 precisa estar em `CORS_ORIGINS` (`apps/api/.env`, o fallback de
`apps/api/src/main.ts` e o `docker-compose.dev.yml`). Sem ela a experiência
carrega, o SDK conecta e o boot morre com `Failed to fetch` — e o sintoma não
menciona CORS na tela.

**A armadilha que pegou duas vezes:** `docker restart` NÃO relê o compose. Um
container guarda as variáveis de quando foi CRIADO, então voltar para esta
branch com a api criada em outra frente deixa a api sem a 5180 — e o erro é
idêntico ao de esquecer a porta no arquivo, embora o arquivo esteja certo.
Confira com `docker exec unooria-plataforma-api-1 printenv CORS_ORIGINS`; para
corrigir, `docker compose -f docker-compose.dev.yml up -d --no-deps
--force-recreate api`.

## O passo é SEMANAL. A quinzena é recorte de exportação (ADR-76)

Não existe `periodicidade` (semanal | quinzenal) na regência: a coluna foi
dropada, o campo saiu do formulário e `janelasDePlanejamento` virou
`semanasDoAnoLetivo`. **Não reintroduza um enum de passo.** A pergunta que a quinzena respondia é de ENTREGA — a escola que recolhe
planejamento de quinze em quinze dias — e isso hoje é um botão de exportação:
"Esta e a próxima (quinzena)" e "Baixar o Nº Bimestre inteiro", que juntam
semanas `pronto` num documento, uma por página.

**Por que não podia ser configurável:** `app_92_planos_de_periodo` é endereçada
por (escola, plano anual, `ordem`), e a `ordem` MUDA DE SIGNIFICADO com o passo —
a 3ª quinzena não é a 3ª semana. Um plano gravado num modo e lido no outro casa
pela ordem e devolve as datas de um recorte com as aulas de outro.

**"Janela" era o nome de quando o passo variava.** Hoje é SEMANA, em toda
superfície: `rotuloDaSemana()` (api) é a fonte única do `"3ª Semana"` que vai
para a tela e para o cabeçalho do `.doc`. Os dois já divergiram — o calendário
dizia "3ª Semana" e o mapeador do plano gravado dizia "3ª janela", que é jargão
interno, e era essa a palavra que chegava à coordenação.

**As aulas das OUTRAS semanas não estão em memória.** A tela carrega uma por
vez, então o export de várias busca `GET /planos-anuais/:id/periodos`, que
devolve só as `pronto`. Semana que falhou na geração não entra no documento.

## Export: `.doc`, impressão — e o `allow-downloads` do sandbox

O `.doc` é HTML com os namespaces do MS Office. Não é DOCX — mesma escolha da app-90, e por isso as cores
vão como literais de token: o Word não resolve CSS variable.

**O download precisa de TRÊS coisas, e a que falta não diz nada.** O botão
existiu por uma versão inteira sem nunca ter baixado um arquivo:

1. **`permissoes: ["downloads"]` no `public/experiencia.json`** — e na LINHA de
   `experiencias` (em dev o hub lê a tabela quando ela existe, não o manifesto
   do bundle). Sem isso o sandbox do iframe não tem `allow-downloads`, e o
   navegador BLOQUEIA o download em silêncio: nada na tela, nada no console (o
   Chrome registra no painel Issues), e o `a.click()` volta como se tivesse
   funcionado;
2. **a rota do hub repassando `permissoes` ao `ExpFrame`** —
   `/professor/plano-de-ensino` não repassava, e a permissão sozinha não teria
   efeito nenhum;
3. **o `<a>` anexado ao DOM** antes do `click()`, e o `revokeObjectURL` com
   atraso. Elemento desanexado funciona no Chrome e é ignorado no Firefox e no
   Safari; revogar na linha seguinte corre contra o início da transferência.

A **impressão** escreve num iframe, não em `window.open`: a experiência já roda
dentro do iframe do hub, e um pop-up daqui é bloqueado — o professor clicaria em
"Imprimir" e nada aconteceria. Ela NÃO depende do `allow-downloads`.

O documento da semana nasce das **aulas estruturadas**, não de prosa formatada
pelo modelo. É isso que garante que a aula editada na tela é a aula que sai no
papel, com o "AULA CUMPRIDA" que o professor marcou.

## Excluir é da REGÊNCIA, e o storage não tem cascata

`DELETE /planejamento/configuracoes/:id` apaga o planejamento inteiro daquele
componente × ano — é o que "excluir" quer dizer na lista do professor. O banco
cuida da cascata (`onDelete: Cascade` até os planos de período), mas o object
storage **não**: os prefixos `planos-de-ensino/{escola}/{planoAnualId}/` são
varridos ANTES do delete, porque depois dele não há mais como saber quais eram.
Falha no bucket não trava a exclusão — arquivo órfão é lixo, e lixo não pode
impedir o professor de apagar o próprio planejamento. Rede em
`tests/planejamento-exclusao.spec.ts`.

## O `Button` do DS não tem `variant="tertiary"` nem a prop `loading`

As variantes são `primary | secondary | outline | ghost | danger | light | ai`,
e a prop é `isLoading`. **`ButtonProps` tem `[key: string]: unknown`**, então o typecheck
aceita qualquer prop inventada em silêncio: `tertiary` gerava a classe
`unooria-button--variant-tertiary`, que o `styles.css` não define, e o botão
ficava sem cor de variante nenhuma; `loading` não mostrava spinner. Prop nova de componente
do DS se confere no `.d.ts` do pacote, não no typecheck.
