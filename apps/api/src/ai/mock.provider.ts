import type {
  AiConversaRequest,
  AiImagemOpcoes,
  AiJsonRequest,
  AiProvider,
  AiRequest,
  AiResult,
  AiSpeechRequest,
  AiFluxoEvento,
  AiFluxoRequest,
} from "./provider";
import { ErroDeGeracao } from "./provider";

/**
 * Markdown pequeno mas com a ANATOMIA de um plano anual (título, seções, lista,
 * tabela): é o que o smoke visual do gerador de plano de aula precisa para
 * exercitar `marked` + `RichTextEditor` sem gastar Vertex em dev.
 */
export const PLANO_MOCK = `# Plano Anual de Componente [mock] — Ano [mock]

**Componente curricular:** [mock]
**Ano escolar:** [mock]
**Carga horária:** A definir pela rede de ensino.
**Organização:** dois bimestres de exemplo
**Material didático:** [mock]
**Referências curriculares:** [mock]

# Fundamentação

Texto gerado pelo **provider mock** — troque \`AI_PROVIDER\` para \`vertex\` para um plano real.

# Objetivos gerais

- Compreender o tema como resultado de escolhas humanas no tempo.
- Desenvolver leitura crítica de fontes, inclusive digitais.

# Percurso do ano

| Período | Questão norteadora | Aprendizagem central | Produto de síntese |
|---|---|---|---|
| 1º bimestre | Como começamos a investigar? | Reconhecer fontes | Mural coletivo com fontes comparadas |
| 2º bimestre | Como aprofundamos a investigação? | Comparar versões | — |

observar → comparar → produzir

# 1º bimestre — Ponto de partida

## Questão norteadora

Como começamos a investigar?

## Conteúdos

- Noções iniciais e vocabulário do componente.
- Fontes: o que são e como se leem.

## Habilidades mobilizadas

- EF0XCO01 — Reconhecer o papel das tecnologias digitais no cotidiano.
- EF0XCO02 — Identificar critérios para avaliar informações.

## Estratégias metodológicas

- Leitura orientada de fontes.

## Formas de avaliação

- Identifica critérios para avaliar uma informação (EF0XCO02).

## Produto de síntese

Mural coletivo com fontes comparadas.

# 2º bimestre — Aprofundamento

## Questão norteadora

Como aprofundamos a investigação?

# Metodologia geral

Aulas dialogadas e atividades práticas (texto do mock).

# Avaliação geral

Diagnóstica, processual e formativa (texto do mock).

# Referências de elaboração

- Documentos do professor (mock).
`;

export class MockProvider implements AiProvider {
  async generate(req: AiRequest): Promise<AiResult> {
    if (req.modelo === "longo") {
      return { texto: PLANO_MOCK, tokensUsados: 1200, finishReason: "STOP" };
    }
    return { texto: `[mock] resposta para: ${req.user.slice(0, 80)}`, tokensUsados: 42, finishReason: "STOP" };
  }

  /**
   * Falha fechada de propósito: o mock não sabe satisfazer um schema
   * arbitrário, e os consumidores de generateJson (reações ao vivo, geração)
   * já tratam erro como "nenhum conteúdo" — que é o comportamento seguro.
   * Testes que precisam de saída estruturada injetam um provider próprio.
   */
  async generateJson<T>(_req: AiJsonRequest<T>): Promise<T> {
    throw new ErroDeGeracao("[mock] generateJson sem implementação — nada será exibido.");
  }

  /** Falha fechada: em dev todo post nasce com arte procedural (fallback). */
  async generateImage(_prompt: string, _opcoes?: AiImagemOpcoes): Promise<Buffer> {
    throw new ErroDeGeracao("[mock] generateImage sem implementação — use o fallback procedural.");
  }

  /**
   * Falha fechada, como as duas acima: não há como sintetizar voz sem vendor, e
   * um MP3 de silêncio seria pior que a ausência — o estudante apertaria o play
   * e concluiria que o áudio está quebrado. Quem chama cai na TRANSCRIÇÃO, que
   * é o canal principal de acessibilidade e está sempre na tela.
   */
  async generateSpeech(_req: AiSpeechRequest): Promise<Buffer> {
    throw new ErroDeGeracao("[mock] generateSpeech sem implementação — use a transcrição.");
  }

  /**
   * Conversa com ferramentas, determinística. Ao contrário dos dois métodos
   * acima, este NÃO falha fechado: uma experiência de conversa não tem
   * fallback autorado, e sem isto `AI_PROVIDER=mock` deixaria a missão sem
   * abrir em dev — que é justamente onde o mock existe para servir.
   *
   * Ele **chama a primeira ferramenta declarada** de propósito: o caminho de
   * function-calling é a parte nova e arriscada do contrato, e um mock que
   * devolvesse texto sem tocar nas ferramentas deixaria os testes passando com
   * o laço de voltas nunca exercitado.
   *
   * As falas não têm DÍGITO nenhum: é comum a regra de domínio recusar número
   * que não tenha vindo de ferramenta, e o mock não deve tropeçar nela.
   */
  /**
   * Fluxo determinístico, em DOIS pedaços — para o teste exercitar a costura
   * de pedaços, que é a parte nova do contrato. Não falha fechado: a Ajuda em
   * dev precisa responder alguma coisa, e o texto diz que é do mock.
   */
  async *conversarEmFluxo(req: AiFluxoRequest): AsyncGenerator<AiFluxoEvento> {
    const ultima = [...req.historico].reverse().find((m) => m.papel === "pessoa")?.texto ?? "";
    const partes = ["[mock] Entendi a sua dúvida. ", `Você perguntou: ${ultima.slice(0, 80)}`];
    for (const texto of partes) yield { tipo: "texto", texto };
    yield { tipo: "fim", resultado: { texto: partes.join(""), tokensUsados: 64, finishReason: "STOP" } };
  }

  async conversar(req: AiConversaRequest): Promise<AiResult> {
    const tentativas = req.tentativas ?? 3;
    const maxVoltas = req.maxVoltas ?? 6;
    let tokens = 0;
    let ultimoErro = "";

    for (let tentativa = 1; tentativa <= tentativas; tentativa += 1) {
      let voltas = 0;
      if (req.ferramentas && maxVoltas > 0 && tentativa === 1) {
        const primeira = req.ferramentas.declaracoes[0]?.nome;
        if (primeira) {
          await req.ferramentas.executar(primeira, {});
          voltas = 1;
        }
      }
      tokens += 120;

      // A última tentativa baixa a exigência, como no provider real: uma frase.
      const texto =
        tentativa === tentativas
          ? "[mock] Preciso consultar uma fonte antes de responder."
          : "[mock] Consultei o que estava disponível e já podemos seguir. Por onde você quer começar?";

      const motivos = req.validar?.(texto) ?? [];
      if (motivos.length === 0) {
        return { texto, tokensUsados: tokens, finishReason: "STOP", voltas, tentativas: tentativa };
      }
      ultimoErro = motivos.join("; ").slice(0, 300);
    }

    throw new ErroDeGeracao("[mock] nenhuma fala passou pela validação do domínio.", ultimoErro);
  }
}
