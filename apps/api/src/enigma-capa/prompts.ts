import type { AiJsonSchema } from "../ai/provider";
import {
  FOTOS,
  GEOMETRIA_DA_CENA_GERADA,
  RECORTE_DA_FOTO,
  ROTULO_DA_DISCIPLINA,
  SELO_MAX_PALAVRAS,
  VISITANTE_MAX_CARACTERES,
  type ConteudoDoPacote,
  type Disciplina,
} from "./conteudo";
import { ConteudoBaseSchema } from "./contrato-de-rotas";
import { problemasDoConteudo } from "./regras/pacote";

/**
 * O contrato com a IA do PREPARO DOCENTE — a única superfície de IA da
 * exp02ef1b, antes da aula e com o professor olhando (one-pager §9a, §14:
 * "Nenhuma chamada de IA generativa roda em tempo real no dispositivo da
 * criança"). Duas chamadas: o TEXTO da cena (`generateJson`) e, a partir dele,
 * a IMAGEM panorâmica 16:9 (`generateImage`).
 *
 * O prompt de sistema NUNCA vai ao bundle (regra 2). A IA não devolve
 * coordenada: o layout é o gabarito `GEOMETRIA_DA_CENA_GERADA` (a atividade 1
 * à esquerda, a 2 à direita, os dois objetos na parede do meio), e os alvos
 * dos invariantes o professor marca tocando na imagem.
 */

export const SYSTEM_DO_PREPARO = `Você é o assistente de conteúdo da Unooria para o 2º ano do Ensino Fundamental (crianças de 7 e 8 anos).
Você escreve a cena de uma missão de leitura de imagens: a rádio da escola publica a capa de um programa com UMA de duas fotos tiradas no MESMO minuto, no MESMO espaço da escola, e a criança descobre que cada foto é só um pedaço do lugar.

A cena é UM espaço da escola (biblioteca, horta, museu, quadra, refeitório, laboratório...) com DUAS atividades opostas acontecendo AO MESMO TEMPO, a poucos passos uma da outra:
- "atividade1" fica na metade ESQUERDA do espaço; "atividade2" na metade DIREITA. As duas são atividades reais e boas da escola, mas dão impressões opostas (ex.: leitura em silêncio × contação de histórias com fantoches; canteiro de alfaces × adubação com minhocas);
- na parede (ou no fundo) do MEIO há DOIS objetos fixos e fáceis de reconhecer ("invariantes"): objetos que não mudam de lugar (um relógio de parede, um cartaz colorido sem texto, um espantalho, uma janela de madeira), GRANDES, cada um de uma cor forte e diferente, que contraste com a parede lisa — e SOZINHOS naquela parede.

A cena é LIMPA, para uma criança de 7 anos achar tudo de primeira: paredes lisas, poucos objetos, nada de decoração, estantes cheias, enfeites ou detalhes de fundo; cada atividade com no máximo 2 crianças, grande e clara.

Para cada atividade escreva:
- "acao": o que a foto mostra, em até 6 palavras ("Mesa de leitura em silêncio");
- "visitante": a fala curta de quem vê só aquela foto, EXATAMENTE no modelo "Na foto, vi …!" ("Na foto, vi crianças lendo!"), até ${VISITANTE_MAX_CARACTERES} caracteres;
- "selo": a legenda da foto em CAIXA ALTA, até ${SELO_MAX_PALAVRAS} palavras ("SILÊNCIO PARA LER"), com um emoji;
- "descricao": como desenhar essa metade da cena (uma frase), com no máximo 2 crianças e poucos objetos.
"espaco" é o nome do espaço ("Biblioteca Escolar"); "espacoCurto" é o nome com artigo, em minúsculas ("a biblioteca"); "alt" descreve a cena INTEIRA numa frase, para quem não enxerga.
Cada invariante tem "nome" em CAIXA ALTA, curto ("RELÓGIO", "CARTAZ AMARELO") e "descricao" de como desenhá-lo: grande, de uma cor forte, sem texto escrito.

Regras gerais: português do Brasil; linguagem simples, para uma criança de 7 anos; nenhuma pessoa, marca ou escola real; nada de violência, medo, comida que uma criança não possa comer, política ou religião; nenhuma das duas atividades é "errada".`;

export function promptDoPreparo(p: { disciplina: Disciplina; tema: string; palavras: readonly string[]; nota?: string | null }): string {
  return `Escreva a cena da missão.

COMPONENTE CURRICULAR: ${ROTULO_DA_DISCIPLINA[p.disciplina]}
TEMA DA AULA: <<<${p.tema.trim()}>>>
PALAVRAS DO CONTEXTO ESCOLAR (a cena trata delas): <<<${p.palavras.map((a) => a.trim()).join("; ")}>>>
NOTA DO PROFESSOR (opcional, sobre a turma): <<<${p.nota?.trim() || "não informada"}>>>`;
}

const STRING = { type: "string" } as const;
const ATIVIDADE: AiJsonSchema = {
  type: "object",
  required: ["acao", "visitante", "selo", "descricao"],
  properties: {
    acao: STRING,
    visitante: STRING,
    selo: { type: "object", required: ["texto", "emoji"], properties: { texto: STRING, emoji: STRING } },
    descricao: STRING,
  },
};

export const SCHEMA_DO_PREPARO: AiJsonSchema = {
  type: "object",
  required: ["espaco", "espacoCurto", "alt", "atividade1", "atividade2", "invariantes"],
  properties: {
    espaco: STRING,
    espacoCurto: STRING,
    alt: STRING,
    atividade1: ATIVIDADE,
    atividade2: ATIVIDADE,
    invariantes: {
      type: "array",
      items: { type: "object", required: ["nome", "descricao"], properties: { nome: STRING, descricao: STRING } },
    },
  },
};

/** O texto da cena como a IA o escreve — antes de virar pacote. */
export interface CenaGerada {
  espaco: string;
  espacoCurto: string;
  alt: string;
  atividade1: { acao: string; visitante: string; selo: { texto: string; emoji: string }; descricao: string };
  atividade2: { acao: string; visitante: string; selo: { texto: string; emoji: string }; descricao: string };
  invariantes: Array<{ nome: string; descricao: string }>;
}

/** Teto de saída: o Gemini 3 pensa, e o raciocínio conta no mesmo teto (ADR-148). */
export const MAX_TOKENS_DO_PREPARO = 8_000;

/** A URL de mentira com que a régua confere a cena ANTES de a imagem existir. */
const URL_PROVISORIA = "https://imagem.invalid/cena.webp";

/** A cena gerada vira o conteúdo do pacote: o layout é o gabarito, os alvos nascem nulos. */
export function conteudoDaCenaGerada(g: CenaGerada, url: string): ConteudoDoPacote {
  const atividades = [g.atividade1, g.atividade2];
  return {
    versao: 1,
    cena: {
      chave: "ia",
      espaco: g.espaco.trim(),
      espacoCurto: g.espacoCurto.trim().toLocaleLowerCase("pt-BR"),
      hora: "14:15",
      imagem: { tipo: "url", url },
      alt: g.alt.trim(),
      fotos: FOTOS.map((id, i) => ({
        id,
        recorte: { ...RECORTE_DA_FOTO[id] },
        nucleo: { ...GEOMETRIA_DA_CENA_GERADA.nucleos[id] },
        acao: atividades[i]!.acao.trim(),
        visitante: atividades[i]!.visitante.trim(),
        seloCoerente: i === 0 ? "selo-1" : "selo-2",
      })),
      selos: atividades.map((a, i) => ({
        id: i === 0 ? ("selo-1" as const) : ("selo-2" as const),
        texto: a.selo.texto.trim().toLocaleUpperCase("pt-BR"),
        emoji: a.selo.emoji.trim(),
      })),
      invariantes: g.invariantes.slice(0, 2).map((inv, i) => ({
        id: i === 0 ? ("inv-1" as const) : ("inv-2" as const),
        nome: inv.nome.trim().toLocaleUpperCase("pt-BR"),
        alvo: null,
      })),
      fundo: { ...GEOMETRIA_DA_CENA_GERADA.fundo },
      marcaveis: FOTOS.map((id, i) => ({
        id: `atividade-${i + 1}`,
        nome: atividades[i]!.acao.trim().toLocaleUpperCase("pt-BR"),
        area: { ...GEOMETRIA_DA_CENA_GERADA.marcaveis[id] },
      })),
    },
  };
}

/**
 * O `validar` do `generateJson`: a forma e a RÉGUA (com os alvos ainda nulos).
 * Fora dela, a tentativa é regerada pelo provider — e cobrada (ADR-74).
 */
export function validarSaidaDoPreparo(bruto: unknown): CenaGerada {
  const b = (bruto ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const atividade = (v: unknown) => {
    const a = (v ?? {}) as Record<string, unknown>;
    const selo = (a.selo ?? {}) as Record<string, unknown>;
    return { acao: str(a.acao), visitante: str(a.visitante), selo: { texto: str(selo.texto), emoji: str(selo.emoji) }, descricao: str(a.descricao) };
  };
  const invs = Array.isArray(b.invariantes) ? b.invariantes : [];
  const g: CenaGerada = {
    espaco: str(b.espaco),
    espacoCurto: str(b.espacoCurto),
    alt: str(b.alt),
    atividade1: atividade(b.atividade1),
    atividade2: atividade(b.atividade2),
    invariantes: invs.map((x) => {
      const i = (x ?? {}) as Record<string, unknown>;
      return { nome: str(i.nome), descricao: str(i.descricao) };
    }),
  };
  const faltas: string[] = [];
  if (g.invariantes.length !== 2) faltas.push("A cena precisa de exatamente dois objetos iguais no fundo.");
  if (!g.atividade1.descricao.trim() || !g.atividade2.descricao.trim()) faltas.push("Descreva como desenhar cada atividade.");
  if (g.invariantes.some((i) => !i.descricao.trim())) faltas.push("Descreva como desenhar cada objeto do fundo.");
  const conteudo = conteudoDaCenaGerada(g, URL_PROVISORIA);
  /* A FORMA do contrato também: o que a régua aceita e o `ConteudoBaseSchema`
     recusa (um texto além do teto) seria gravado e não voltaria legível —
     500 no gerar. Recusado aqui, a tentativa é regerada pelo provider. */
  const forma = ConteudoBaseSchema.safeParse(conteudo);
  const foraDaForma = forma.success
    ? []
    : forma.error.issues.map((i) => `O campo ${i.path.join(".")} está fora do formato (${i.message}).`);
  const problemas = [...faltas, ...foraDaForma, ...problemasDoConteudo(conteudo, { exigirAlvos: false })];
  if (problemas.length > 0) throw new Error(problemas.join(" "));
  return g;
}

/** Tira os cercados `<<< >>>` (o tema do professor) e quebras: o pedido de imagem é uma frase só. */
const limpo = (t: string) => t.replace(/<<<|>>>/g, "").replace(/\s+/g, " ").trim();

/**
 * O PEDIDO DE IMAGEM (16:9). "Ilustração", NUNCA "foto" (ADR-178: a palavra
 * "foto" puxa o modelo para o fotorrealismo e para rostos de criança
 * identificáveis). O layout é o que a geometria da cena gerada supõe.
 *
 * A cena é LIMPA (ADR-186): paredes lisas, poucos objetos, as duas atividades
 * grandes e claras (no máximo 2 crianças cada) e os dois objetos da parede do
 * meio GRANDES, de cor forte e contrastante, sozinhos naquela parede — a
 * criança de 7 anos acha com a lupa o que se destaca, não o que se esconde.
 */
export function pedidoDeImagem(g: CenaGerada): string {
  const [i1, i2] = g.invariantes;
  return `Ilustração digital colorida e LIMPA, plano aberto e panorâmico, proporção 16:9, de ${limpo(g.espaco)} de uma escola, no mesmo instante, com luz clara do começo da tarde.

Metade ESQUERDA da imagem: ${limpo(g.atividade1.descricao)} No máximo 2 crianças, grandes e bem visíveis.
Metade DIREITA da imagem: ${limpo(g.atividade2.descricao)} No máximo 2 crianças, grandes e bem visíveis.
Exatamente no CENTRO da imagem, numa parede lisa entre as duas metades, GRANDES, bem visíveis e separados um do outro: ${limpo(i1?.descricao ?? "")}; e ${limpo(i2?.descricao ?? "")}. Os dois objetos têm cores fortes que contrastam com a parede lisa, ficam no terço central da largura, na metade de cima da imagem, SOZINHOS naquela parede, e não se repetem em nenhum outro lugar.

Cena simples: paredes lisas, de uma cor só; poucos objetos; nada de decoração, enfeites, estantes cheias, quadros ou detalhes de fundo além dos dois objetos do centro.

Regras: crianças genéricas e estilizadas, de costas, de perfil ou de longe, sem rosto identificável; nenhuma pessoa real; nenhum texto escrito, letra ou número em lugar nenhum (nem em cartaz, placa ou livro); nenhum logotipo, marca ou aplicativo; as duas metades contínuas, como um único ambiente, sem moldura nem divisão.`;
}
