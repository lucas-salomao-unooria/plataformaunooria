import type { AiJsonRequest, AiProvider, AiRequest, AiResult } from "./provider";
import { ErroDeGeracao } from "./provider";

/**
 * Markdown pequeno mas com a ANATOMIA de um plano anual (título, seções, lista,
 * tabela): é o que o smoke visual do gerador de plano de aula precisa para
 * exercitar `marked` + `RichTextEditor` sem gastar Vertex em dev.
 */
const PLANO_MOCK = `# Plano Anual — [mock]

## Objetivos gerais

- Compreender o tema como resultado de escolhas humanas no tempo.
- Desenvolver leitura crítica de fontes, inclusive digitais.

## 1º bimestre — Ponto de partida

### Conteúdos

- Noções iniciais e vocabulário do componente.
- Fontes: o que são e como se leem.

### Habilidades

| Código | Habilidade |
|---|---|
| EF0XCO01 | Reconhecer o papel das tecnologias digitais no cotidiano. |
| EF0XCO02 | Identificar critérios para avaliar informações. |

### Avaliação

Produto de síntese: mural coletivo com fontes comparadas.

## 2º bimestre — Aprofundamento

Conteúdo gerado pelo **provider mock** — troque \`AI_PROVIDER\` para \`vertex\` para um plano real.
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
  async generateImage(_prompt: string): Promise<Buffer> {
    throw new ErroDeGeracao("[mock] generateImage sem implementação — use o fallback procedural.");
  }
}
