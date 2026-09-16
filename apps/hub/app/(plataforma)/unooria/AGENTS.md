# apps/hub/app/(plataforma)/unooria — o painel da fornecedora (ADR-88)

Complementa o `AGENTS.md` de `apps/hub`, que vence em conflito. É a primeira
capacidade que `admin` tem e `gestor_contrato` não.

## A área `/unooria` — o painel da fornecedora (ADR-88, 2026-09-10)

Área própria, papel `admin`, layout próprio (e portanto trilha própria).
`NavUnooria` + `lib/recursos.ts` + `app/(plataforma)/unooria/recursos/` +
`app/(plataforma)/unooria/uso-de-ia/` (ADR-105).

### O segundo item: Uso de IA (ADR-105, 2026-09-15)

`/unooria/uso-de-ia` — o teto diário de tokens por perfil, um cartão por perfil
(`estudante`, `professor`), lido de `GET /recursos/quotas-de-ia` e alterado por
`PUT /recursos/quotas-de-ia/:perfil` pelo BFF (prefixo `recursos`, já na
allowlist). O histórico é o MESMO `HistoricoDeRecursos`, com `prefixo="quota:"`
e `key={mudancas}` para remontar depois de cada gravação — a doutrina do painel.

- **"Token" fica, e a tela TRADUZ ao lado**: "cabe cerca de N partidas completas
  da Missão Tempestade" / "N planos anuais", com os custos MEDIDOS no projeto
  (77k e 220k). É a unidade em que o modelo cobra; trocá-la por outra palavra
  inventaria uma medida que não existe na fatura.
- **O diálogo avisa o alcance** (rede inteira, próxima chamada, quem já passou do
  teto novo fica sem IA até amanhã) e trava "Gravar" enquanto nada mudou ou o
  motivo está vazio — mesmo desenho do diálogo de desligar.
- **Zero e negativo o campo recusa com a frase certa**: "para fechar a IA de um
  produto, desligue o produto em Recursos". Confundir quota com interruptor é o
  erro que a ADR-87 nomeia.
- **O item do `SideBar` do DS se clica pelo ITEM** (`.unooria-sidebar-item`),
  não pelo texto: o rótulo vive num tooltip oculto (`__tooltip-content`), e
  `getByText` acha o texto e não consegue clicar. Custou uma corrida da e2e.

**A armadilha do middleware, que passa no typecheck.** O redirect cross-área
comparava UMA string (`areaDoPathname` contra `areaDoPapel`). O `admin` tem
DUAS casas — o painel da Unooria e a área administrativa, que ele divide com os
gestores — então com uma string só ele era EXPULSO de uma delas, com o sintoma
"clico em Recursos e caio em Usuários" e nada no console. Hoje a checagem é de
MEMBRESIA (`areasDoPapel` / `podeEntrarNaArea`), e `lib/papeis.test.ts` cobra
que todo papel entra na própria casa e que ninguém além do `admin` entra em
`/unooria`.

**`homeDoPapel("admin")` é `/unooria/recursos`**: a casa da conta da Unooria é o
painel dela, não a área da escola.

### Trocar de escopo REMONTA o painel — e sem isso a tela MENTE

`PainelDeRecursos` guarda o painel em `useState(inicial)` para poder reler
sozinho depois de cada mudança. `useState` só usa o valor inicial na MONTAGEM:
trocar de escopo faz `router.push`, o servidor devolve o painel da escola nova,
e o componente não remontado continua exibindo o do escopo anterior.

**O custo não é cosmético.** O `escolaId` que as escritas usam sai do painel em
estado. Com o estado velho, escolher uma ESCOLA e desligar um produto gravava a
linha no **CONTRATO** — a rede inteira — com a tela afirmando que era a escola.
Foi medido: a suíte e2e do `admin` derrubou o produto para todas as escolas
enquanto o roteiro dizia operar numa só, e o print mostrou o painel inteiro com
os rótulos do escopo-contrato.

O conserto é o `key={escopo}` na página, e é a mesma doutrina do
`<EscopoDaEscola>` (ADR-85): **quando o escopo é insumo de tudo o que a tela
mostra, trocar de escopo remonta o miolo em vez de tentar sincronizar estado.**

E a suíte e2e não confia na URL: ela exige o RÓTULO do interruptor
("Herda de cima" só existe fora do contrato) antes de desligar qualquer coisa.

### Três estados, nunca dois

`ligado | desligado | herda`. Sem o terceiro, "ligado nesta escola" fica
idêntico a "herdado ligado" e desfazer uma exceção é impossível. O rótulo de
`herda` MUDA com o escopo — "Padrão (ligado)" no contrato, onde não existe
"de cima"; "Herda de cima" numa escola. Chamar as duas coisas de "Herda" faria o
operador do escopo-contrato procurar um nível que não existe.

O controle da experiência sob um produto desligado fica **desabilitado com o
motivo ao lado**, não escondido: mostrá-lo ativo prometeria uma mudança que o
resolvedor ignoraria, e escondê-lo pareceria defeito.

### A janela de versão: uma alavanca por escopo

`modal-de-versao.tsx`. No escopo-CONTRATO só existe **Ativar para a rede**
(troca a `versao_ativa` e restaura o manifesto daquela versão); fora dele, só
**Fixar neste escopo** / **Soltar a fixação**. As duas nunca aparecem juntas, e a
razão está na ADR-87: fixar no contrato trocaria a versão do bundle SEM
restaurar o manifesto, reabrindo o defeito do `allow-pointer-lock` que o
histórico existe para consertar.

**A janela FICA ABERTA depois de gravar**, e relê o próprio histórico. Os dois
por medida: quem ativa uma versão precisa ver o aviso de que a conferência no
CDN não foi possível (é ele que decide se o trabalho acabou), e sem reler o
histórico a faixa "está em rollback" continuava na tela DEPOIS de a ativação
resolver o rollback — a tela mentindo sobre o que ela mesma acabou de fazer.
Visto no navegador.

**A etiqueta da versão É o botão** da janela: um botão "Versão" separado
repetiria a informação que a etiqueta já dá.

### O histórico: UM componente, DOIS painéis (ADR-89)

`components/historico-de-recursos.tsx` é usado pelo painel da Unooria
(`/unooria/recursos`) e pela tela da REDE (`/admin/recursos`), que é
**somente-leitura** e existe só por causa dele: a rede não liga nem desliga nada
(ADR-88), mas ver por que o produto dela mudou de estado é informação do cliente.
A copy diz isso na cara — "Quem opera estes interruptores é a Unooria; esta tela
é o registro" —, porque tela administrativa sem controle nenhum lê como tela
quebrada.

- **Um componente, não dois.** As duas telas mostram as MESMAS colunas da MESMA
  rota; duplicá-las garantiria que a próxima ação nova ("versão soltada", por
  exemplo) aparecesse com rótulo em uma e sem rótulo na outra.
- **O `ACOES` é um `Record` exaustivo** de rótulo + cor. Um `Record` tipado pela
  união faz o typecheck cobrar o rótulo da ação nova; um `switch` com
  `default` mostraria o slug cru na tela e ninguém veria.
- **`/admin/recursos` é `notFound()` para quem não é do contrato** — não 403,
  não redirect: gestor de escola não deve nem saber que a tela existe.
- **A tela da rede NÃO passa `escolaId`**: ela mostra o contrato inteiro, que é o
  escopo do papel. O painel da Unooria passa o escopo em que está, e a api
  inclui as decisões de escopo-contrato junto (senão o histórico de uma escola
  ficaria vazio no dia em que a rede inteira mudou).

### O `SideBar` do DS traz um item que não é seu

Ele renderiza sempre um primeiro item **"Iniciativas"**, fixo no componente, que
abre um painel de `appsItems`. Sem `appsItems` o clique não faz nada — e nenhuma
área deste hub passa `appsItems`. Vale para `/admin` desde sempre e agora para
`/unooria`. É lacuna do pacote (pedido no `storybook-unooria`), não coisa a
contornar aqui: item de menu que não leva a nada é pior que item nenhum.

## O interruptor da rede na porta do produto (ADR-87, 2026-09-10)

**A guarda de produto é do LAYOUT da área, nunca da página** — mesma doutrina da
trilha (ADR-77) e pelo mesmo motivo: o layout cobre a subárvore inteira, então
rota nova nasce coberta. `professor/entre-redes/layout.tsx` protege as missões, os
guias e os resultados de todas elas; `plano-de-aula`, `plano-de-ensino` e
`bem-estar` têm o próprio. Cada um é uma linha: `await exigirProdutoLigado(slug)`.

Verificado: com o Entre Redes desligado,
`/professor/entre-redes/8-ano/unidade-1/guia` responde 404 **sem nenhuma mudança
na página** — foi o layout.

- **Fragmento, não elemento.** Um `<div>` no layout mudaria o fluxo de altura que
  a página de dentro monta com margens negativas (`tela-cheia`).
- **404, e não uma tela de "produto desativado".** Para o professor daquela rede
  o produto não existe; uma tela explicando que existe mas foi desligado é a
  Unooria contando ao cliente o que ela vendeu a quem.
- **`lib/produtos.ts` deixou de ser a LISTA e é só a COPY.** A lista efetiva vem
  de `GET /recursos/efetivos` (`lib/recursos.ts`). É o mesmo movimento que
  `lib/missoes-do-estudante.ts` fez na ADR-69, e pelo mesmo motivo: constante
  compilada no bundle é igual para toda rede, e o que existe numa rede é DADO.
- **FALHA ABERTA quando a api não responde**, como `/exp/[expId]` já fazia com
  `minhasSalas()`: a porta de verdade é do servidor, então deixar passar aqui não
  abre nada — a api recusa na primeira chamada. Falhar FECHADA faria uma api
  pendurada esvaziar a home do professor, com a tela dizendo "você não tem
  produto" em vez de "não carregou".
- **`/exp/[expId]` ficou coberta de graça**: ela já consulta a grade
  (`minhasSalas`), e a grade passou a filtrar o indisponível na api. Não houve
  linha nova nessa rota.
- **Não conte produtos na copy.** O texto da home dizia "Quatro produtos"; com um
  deles desligado a frase mente sobre a própria tela.
