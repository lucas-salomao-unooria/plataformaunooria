import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * O que o bundle NÃO pode ter — ele é público, e `/exp/exp01em1b` é endereço
 * adivinhável (regra 3).
 *
 * - O GABARITO, que mora só em `apps/api/src/assistente-invisivel/conteudo.ts`:
 *   a coluna certa de cada cartão (`COLUNA_DO_CARTAO`), os passos dispensáveis
 *   do algoritmo (`PASSOS_DISPENSAVEIS`), os critérios equitativos
 *   (`CRITERIOS_EQUITATIVOS`) e a opção certa de cada bloco
 *   (`OPCAO_CERTA_DO_BLOCO`) — nem pelo nome, nem pelos pares escritos à mão.
 * - Persistência no navegador: a fila de envio é em MEMÓRIA, e token só em
 *   memória (regra 4).
 * - IA, Canal B e texto livre (decisões fechadas: as conversas são
 *   roteirizadas do pacote).
 * - A seção do DS por tela: a escola é `unooria`, o assistente é `unooriaai`,
 *   e cada arquivo importa UMA ponte só.
 */
function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return arquivos(p);
    return /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}
/** O CÓDIGO, sem os comentários: a documentação pode (e deve) nomear o que não desce. */
const semComentarios = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const fonte = arquivos("src").map((f) => [f, semComentarios(readFileSync(f, "utf8"))] as const);

describe("o bundle não carrega o gabarito", () => {
  test.each([
    ["o nome das constantes do gabarito", /COLUNA_DO_CARTAO|PASSOS_DISPENSAVEIS|CRITERIOS_EQUITATIVOS|OPCAO_CERTA_DO_BLOCO/],
    ["um par cartão → coluna", /["']?(trilha-avancada|nome-turma|horario|sinal-de-rede|endereco-ip|modelo-aparelho)["']?\s*:\s*["'](fornecidos|observados)["']/],
    ["a lista de passos dispensáveis", /\[\s*2\s*,\s*3\s*,\s*4\s*\]/],
    ["os critérios equitativos por função", /(exercicios|duvidas)\s*:\s*\[\s*["']a["']\s*,\s*["']c["']\s*\]/],
    ["a opção certa de um bloco", /(problema|inferencia|regra|salvaguarda)\s*:\s*["'](restringindo|metadados|criterios-pedagogicos|revisao-humana)["']/],
    ["o rótulo do Figma que entrega o gabarito do passo 4", /Ação enviesada/],
    ["os acertos da classificação", /acertos\s*:/],
  ])("%s", (_nome, padrao) => {
    for (const [arquivo, texto] of fonte) expect({ arquivo, casou: padrao.test(texto) }).toEqual({ arquivo, casou: false });
  });
});

describe("nada persiste no navegador", () => {
  test("sem localStorage, sessionStorage nem IndexedDB", () => {
    for (const [arquivo, texto] of fonte) {
      expect({ arquivo, casou: /localStorage|sessionStorage|indexedDB/.test(texto) }).toEqual({ arquivo, casou: false });
    }
  });
});

describe("sem IA, sem Canal B e sem texto livre", () => {
  test("nenhuma chamada de IA, pergunta de avaliação ou campo de texto", () => {
    for (const [arquivo, texto] of fonte) {
      expect({ arquivo, casou: /\.ai\.gerar|\/ai\/|\/perguntas|ChoicePoll|StoryPoll|TextField|TextArea|<textarea|<input/.test(texto) }).toEqual({
        arquivo,
        casou: false,
      });
    }
  });
});

describe("cada tela fala pela sua seção do DS", () => {
  const pontesDe = (texto: string) => [...texto.matchAll(/from "@edu\/ui\/([\w-]+)"/g)].map((m) => m[1]);

  test("nenhum arquivo importa duas pontes, nem uma terceira seção", () => {
    for (const [arquivo, texto] of fonte) {
      const pontes = new Set(pontesDe(texto));
      expect({ arquivo, quantas: pontes.size <= 1 }).toEqual({ arquivo, quantas: true });
      for (const p of pontes) expect({ arquivo, ok: p === "ds" || p === "ds-unooriaai" }).toEqual({ arquivo, ok: true });
      expect({ arquivo, casou: /design-system\/(unoovista|instanooria|chatgpt|unoochat|whatsappmobile|unootube)\.css|design-system\/styles\.css/.test(texto) }).toEqual({
        arquivo,
        casou: false,
      });
    }
  });

  const ponteDo = (arquivo: string) => pontesDe(readFileSync(join("src", arquivo), "utf8"));
  test.each([
    ["telas/BoasVindas.tsx", "ds"],
    ["telas/Funcoes.tsx", "ds"],
    ["telas/Aposta.tsx", "ds"],
    ["telas/Simulacao.tsx", "ds-unooriaai"],
    ["telas/Auditoria.tsx", "ds"],
    ["telas/Classificacao.tsx", "ds"],
    ["telas/Algoritmo.tsx", "ds"],
    ["telas/Criterios.tsx", "ds"],
    ["telas/Reteste.tsx", "ds"],
    ["telas/Publicacao.tsx", "ds"],
    ["telas/Concluida.tsx", "ds"],
    ["telas/Espera.tsx", "ds"],
    ["componentes/Casca.tsx", "ds"],
    ["componentes/Janelas.tsx", "ds"],
    ["componentes/PecasDoAssistente.tsx", "ds-unooriaai"],
  ])("%s → @edu/ui/%s", (arquivo, ponte) => {
    expect(ponteDo(arquivo)).toEqual([ponte]);
  });
});
