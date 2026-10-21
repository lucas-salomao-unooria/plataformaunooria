---
paths:
  - "apps/api/src/ai/**"
  - "apps/api/src/recursos/custos-de-ia*"
  - "apps/api/src/recursos/cotacao-do-dolar.ts"
  - "apps/api/src/agente-professor/**"
  - "apps/api/src/ajuda/**"
  - "apps/hub/app/(plataforma)/unooria/custos-de-ia/**"
---

# Custos de IA — toda chamada paga é medida (ADR-161)

Regra transversal da plataforma. Complementa o `AGENTS.md` da raiz, que vence
em conflito. A tela está em `apps/hub/app/(plataforma)/unooria/custos-de-ia/AGENTS.md`.

`/unooria/custos-de-ia` responde quanto a IA de uma rede custou à Unooria, em
tokens, dólar e real, por dia, produto, modelo, modalidade e escola. Ela só é
verdade se TODA chamada paga chegar ao registro — e o modo de falhar é mudo: o
produto funciona, a fatura do Google sobe, e o painel diz que ele não custa nada.

## Quem mede, e onde

| Porta | Quem registra | Como |
|---|---|---|
| `AiProvider` (texto, JSON, imagem, voz, fluxo) | o `MedidorDeProvider` | automático — consumidor novo do provider nasce medido |
| Agent Engine (agente do professor) | `agente-professor.service.ts`, no `finally` do turno | `consumoDoTurno`: só eventos NÃO parciais |
| Gemini Live (mascote da Ajuda) | `gemini-live.client.ts`, uma linha por sessão | soma o `usageMetadata` de cada turno |
| LiveAvatar (avatar em vídeo) | ninguém grava: o painel lê os minutos de `ajuda_sessoes` | preço `minuto` do `liveavatar-full` |

**Vendor ou porta NOVA de IA fora do `AiProvider` entra nesta tabela no mesmo
commit**, chamando `RegistroDeConsumo.registrar` (`src/ai/consumo-de-ia.ts`).
Sem isso o custo dele não existe no painel.

## As regras da medição

- **Registra o que foi PAGO, não o que serviu.** A tentativa que o `validar`
  recusou, a imagem que não veio e o turno que o professor abandonou foram
  cobrados. `aoUsarTokens(tokens, divisao)` é chamado por TENTATIVA.
- **Saída = total − entrada**, nunca o `candidatesTokenCount`: o raciocínio fica
  fora dele e a Vertex o cobra na tarifa de saída. Sem divisão do vendor, o
  total conta como saída (a tarifa mais cara: falha para o lado do custo).
- **A voz é ESTIMADA** (`estimado = true`, a tela mostra "≈"): a Cloud TTS não
  devolve tokens. Duração pelo MP3 de 32 kbps, 25 tokens por segundo.
- **O registro nunca derruba a chamada.** Falha vira o log
  `ia-consumo-nao-gravado`; a resposta ao usuário já foi paga.
- **A atribuição sai do contexto da requisição**: `recurso` é o primeiro
  segmento da rota (`contextoMiddleware`), escola e perfil vêm do token. Quem
  chega FORA do middleware (o WebSocket do mascote, uma tarefa de fundo) passa
  `atribuicao` explícita — senão a linha cai em `sem-rota`/sem escola. Pelo
  `AiProvider`, a imagem aceita `atribuicao` nas opções
  (`AiImagemOpcoes.atribuicao`, lida pelo medidor) quando a rota não diz a
  verdade: as imagens do banco padrão do Júri, geradas pelo `admin`, são
  `juri-estadual-banco-padrao`, perfil `admin`, sem escola — custo da
  plataforma, não da rede.
- **Sem `usuario_id`**: o painel responde EM QUÊ se gastou, nunca QUEM (regra 6).
  Teto por pessoa é a quota (`ia_uso_diario`), outra pergunta.

## O custo é derivado, nunca gravado

`ia_consumo_diario` guarda o que o vendor mediu; o preço (`ia_precos`, com
vigência) e a PTAX (`cotacoes_dolar`) entram na LEITURA. Gravar o custo
congelaria um preço errado da semente para sempre; derivado, corrigir o preço
com data no passado corrige o painel para trás.

- **`ia_precos` só recebe INSERT** (a mesma data substitui aquela vigência).
  Apagar um preço tiraria o custo dos dias em que ele valeu. Modelo novo sem
  preço entra com custo zero e o painel AVISA (`modelosSemPreco`).
- **Trocou o modelo numa env?** (`VERTEX_MODEL`, `VERTEX_TTS_MODEL`, o do
  agente, o do mascote) Cadastre o preço dele no painel no mesmo dia — ou o
  aviso fica na tela até alguém cadastrar.
- **A PTAX é de VENDA, do Banco Central (Olinda)**, guardada no banco (três
  instâncias, um cache). Dia sem PTAX usa o último dia útil. O BCB fora do ar
  não derruba o painel: converte com o que tem e avisa
  (`cotacao-dolar-indisponivel`).
- **Só o `admin`** (`@Roles("admin")`, módulo `recursos`). O `gestor_contrato` é o
  cliente: ver o custo seria ver a margem do contrato.

## O que o painel NÃO cobre (e diz)

O custo FIXO — o Agent Engine implantado (vCPU-hora), Cloud Run, Cloud SQL — e
o consumo de antes do deploy desta medição. O painel é o custo VARIÁVEL por
chamada; a fatura do mês é a conferência. Diferença acima de 10% entre os dois
é o gatilho de reavaliação da ADR-161.
