# apps/agente-professor — o agente de IA do professor (Python/ADK) e a ingestão dos data stores

Complementa o AGENTS.md da raiz.

**O contrato entre agente, api, hub e infra é
[`docs/regras/agente-professor.md`](../../docs/regras/agente-professor.md)** — chaves
de estado, ferramentas, eventos do stream, recursos GCP. Ele vence este arquivo, e
nada dele é repetido aqui. Como rodar, testar, ingerir e publicar: `README.md`.

## Python dentro do monorepo

- **Só `uv`** (`uv sync`, `uv run …`), Python 3.12, versões no `uv.lock`
  (`google-adk~=2.10.0`). Nada de `pip install` solto: a imagem roda
  `uv sync --locked`, e uma dependência fora do lock passa local e quebra no deploy.
- O `package.json` existe só para o `pnpm turbo typecheck lint test` da raiz
  incluir o pacote, via `scripts/uv.mjs`. **Sem `uv`, ele FALHA** com a instrução
  de instalação; `AGENTE_PROFESSOR_PULAR_SEM_UV=1` pula com aviso em destaque. A
  variável está no `env` do `turbo.json` do pacote: tirá-la de lá faz um "pulado"
  em cache valer como "passou" numa execução com uv.
- Os testes leem as habilidades dos `.ts` GERADOS da api
  (`apps/api/src/curriculo/dados/`) por `node` com type stripping: precisam de
  Node ≥ 22.6, e o `turbo.json` declara essa pasta como entrada do `test`.

## Location: nunca `GOOGLE_CLOUD_LOCATION`

No Agent Engine ela é reservada e vale a região do deploy (`us-east1`); o próprio
`AdkApp.set_up` a preenche. O Gemini em `global` (com reserva em `us`) se configura
em `modelos.py` pelo `client_kwargs` do `Gemini` — trocar por env manda o modelo
para a região do engine, onde o modelo pode nem existir (404 só em produção). A
reserva troca de location só ANTES do primeiro pedaço da resposta; depois, trocar
duplicaria o texto na tela.

## Um dicionário só para componente, ano e etapa

`curriculo.py` é usado por QUEM ESCREVE o data store (`ingestao/exportar_habilidades.py`)
e por QUEM CONSULTA (`ferramentas/habilidades.py`). Mudar um lado só não dá erro:
dá "nenhuma habilidade encontrada". O caso que mais custa é o EM: Biologia, Física
e Química têm de virar `ciencias-da-natureza` (as `EM13CNT`); Filosofia e
Sociologia, `ciencias-humanas`; Arte, Educação Física e Inglês, `linguagens`.
`componentes_bncc("historia")` devolve `historia` E `ciencias-humanas` de
propósito — no EF não há habilidade com slug de área, então não traz nada a mais.
`EF05CO011` tem três dígitos no documento oficial: o regex aceita, não "conserte".

## Habilidades: o JSONL é o conjunto inteiro

`importar habilidades` usa `reconciliationMode: FULL` — habilidade que falta no
JSONL é APAGADA do data store. Por isso `exportar_habilidades` aborta se os totais
não forem 1.304 EF + 183 EM + 130 Computação. Não afrouxe a conferência para
"passar": o sintoma é o plano anual sem a habilidade, sem erro em lugar nenhum.
`descricao` é só o texto oficial; `explicacao`/`exemplos` da Computação ficam em
campos próprios — juntos, o agente citaria o exemplo como se fosse a habilidade.
Filtro em campo novo exige o campo `indexable` em `ingestao/esquemas/` e
`importar esquema`; sem isso a busca responde `INVALID_ARGUMENT`.

## Acervo: a página citada é a do PDF ORIGINAL

PDF acima de 500 páginas é dividido (o parser de layout não aceita mais), e o
`pageSpan` conta da PARTE. A conversão (`pagina_inicial_original + pageStart − 1`)
depende do manifesto que `dividir_pdfs` grava para TODO original — rode-o sempre
antes de `gerar_metadados_acervo` (original sem manifesto é erro, de propósito).
Trocou um PDF no bucket? `dividir_pdfs --forcar`. A página é a do leitor de PDF,
não a impressa (na BNCC completa, impressa = PDF − 2). Pasta fora da convenção
aborta a geração inteira: gerar o resto escondia o livro mal arquivado.

**As chaves de cada trecho de `buscar_acervo` — `titulo`, `pagina_inicio`,
`pagina_fim`, `trecho`, `fonte_id` — são lidas pela api** para o evento `fontes`.
Nenhuma a mais, nenhuma renomeada, sem mudar a api junto.

## O que a api lê do stream, e de onde sai

Medido no `tests/test_e2e.py` (ADK 2.10, modo SSE):

- Turno com ferramenta: evento PARCIAL com `function_call` (já com
  `usage_metadata`), o mesmo NÃO parcial, o `function_response`, os parciais de
  texto e o final agregado que repete o texto inteiro.
- **Título**: o ÚLTIMO evento do 1º turno, autor `agente_professor`, sem `content`,
  com `actions.state_delta.titulo_conversa`. É o `after_agent_callback` mudando o
  estado. Turno recusado ou falha do modelo de título: não há título, e o turno
  seguinte tenta de novo.
- **Recusa de escopo**: UM evento não parcial com o texto e
  `custom_metadata.fora_do_escopo = true`, sem parcial antes (não houve modelo).
  A api tem de emitir esse texto como `delta`, senão a recusa não aparece.
- **Tokens da guarda e do título** são somados ao `usage_metadata.total_token_count`
  do primeiro evento não parcial seguinte (criado quando o evento não tem — a recusa,
  o título) e repetidos em `custom_metadata.tokens_auxiliares`. Escape conhecido:
  quando o modelo de título responde mas `limpar_titulo` zera o texto, não há
  evento e esses tokens (~40) ficam fora da quota.
- **Falha do modelo**: o ADK emite um evento com `error_code`/`error_message` e
  propaga a exceção; o servidor fecha o stream limpo depois desse evento. Sem ele,
  a conexão é cortada. As duas formas são `AGENTE_INDISPONIVEL` para a api.

Só `MarcacaoDeEventosPlugin` pode ter `on_event_callback`: o `PluginManager` para
no primeiro retorno não nulo, e um segundo plugin com o mesmo hook some em silêncio.

## Sessão

- O `AdkApp` cria o `Runner` com `auto_create_session=True`: um `session_id`
  inexistente vira sessão NOVA e vazia, sem erro. A posse e a existência são da api
  (Postgres), nunca do agente.
- **Quem renova o `expire_time` é a api** (`PATCH …/sessions/{id}?updateMask=expireTime`,
  o papel custom da SA dela tem `sessions.update`). A API documenta só o MÍNIMO
  (24 h) e o padrão (365 dias); o máximo não está documentado — confirme no dev
  antes de nascer com "100 anos".
- Fora do Agent Engine, as sessões são `SessoesEmMemoria` (`fabrica.py`), que
  aceitam e ignoram `ttl`/`expire_time` para o shim receber o MESMO corpo do engine.

## Contexto do modelo

- `poda.py`: ≤ 6.000 caracteres por string e ≤ 24.000 por resposta de ferramenta
  (do gerador-missoes), EXCETO `buscar_habilidades`, com 120.000: a Língua
  Portuguesa do 8º ano inteira tem ~58.000, e cortá-la é o plano incompleto.
- Retorno de ferramenta de turno ANTERIOR vira resumo com os códigos no pedido ao
  modelo. O item da lista é SUBSTITUÍDO, nunca editado: os `Content` do pedido são
  os objetos dos eventos da sessão, e editar no lugar reescreveria o histórico que a
  api lê com `async_get_session`.

## Logs e testes

- Nenhum log com texto do professor (pergunta, resposta, `texto` da busca): só
  códigos, contagens e o NOME do tipo de erro. Ele pode escrever o nome de um
  estudante. `test_plugins.py` confere.
- Testes sem rede: `tests/fakes.py` tem um LLM roteirizado (que passa pelo MESMO
  `StreamingResponseAggregator` do `Gemini`) e um Discovery Engine em memória que
  INTERPRETA o filtro que as ferramentas montam — mudou a sintaxe do filtro, o fake
  acusa. O relatório real da busca é `ingestao/avaliar_habilidades.py`, contra o
  data store, e é ele que decide se a busca serve.
