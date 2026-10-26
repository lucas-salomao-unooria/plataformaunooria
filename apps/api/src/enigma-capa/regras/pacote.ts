import {
  CHAVES_PRONTAS,
  FAIXA_COMUM,
  FOTOS,
  INVARIANTES,
  MARCAVEIS,
  RAIO,
  RECORTE_DA_FOTO,
  SELO_MAX_PALAVRAS,
  SELOS,
  VISITANTE_MAX_CARACTERES,
  type ConteudoDoPacote,
  type Retangulo,
} from "../conteudo";
import { alvoNaFaixaComum, alvosSeparados, contemRetangulo, fracaoDentro, intersecao, areaDe } from "./geometria";

/**
 * A RÉGUA DO PACOTE — a mesma para os pacotes prontos (o teste), para a saída
 * da IA do preparo (`prompts.ts#validarSaidaDoPreparo`, com os alvos ainda
 * nulos) e para a homologação do professor (com os alvos OBRIGATÓRIOS).
 * Devolve TODAS as frases de uma vez — é o professor quem lê.
 *
 * O que ela garante é a MECÂNICA, que não muda com o tema (one-pager §3,
 * "camada fixa"): duas fotos que são os recortes fixos da panorâmica, cada uma
 * com a sua ação (núcleo dentro do recorte) e a fala da visitante; dois selos
 * curtos em CAIXA ALTA, um coerente com cada foto; dois invariantes DENTRO da
 * faixa comum (logo, nas duas fotos); o fundo da dica e os marcáveis.
 */

const PANORAMICA: Retangulo = { x: 0, y: 0, w: 100, h: 100 };
const palavras = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const caixaAlta = (t: string) => t === t.toLocaleUpperCase("pt-BR");

export function problemasDoConteudo(c: ConteudoDoPacote, opcoes: { exigirAlvos: boolean }): string[] {
  const p: string[] = [];
  const cena = c.cena;
  if (c.versao !== 1) p.push("A versão do pacote precisa ser 1.");

  if (!cena.espaco.trim()) p.push("Informe o espaço da escola fotografado.");
  if (!/^(a|o|as|os)\s+\S/i.test(cena.espacoCurto.trim())) p.push('O nome curto do espaço começa com o artigo ("a biblioteca", "o museu").');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(cena.hora)) p.push("A hora das fotos precisa estar no formato 14:15.");
  if (!cena.alt.trim()) p.push("Descreva a cena inteira (texto alternativo da imagem).");

  const pronta = (CHAVES_PRONTAS as readonly string[]).includes(cena.chave);
  if (pronta && cena.imagem.tipo !== "bundle") p.push("Os pacotes prontos usam a imagem do próprio app.");
  if (cena.chave === "ia" && cena.imagem.tipo !== "url") p.push("A cena gerada precisa da imagem gerada.");
  if (cena.imagem.tipo === "bundle" && !/^cenas\/[a-z0-9-]+\.webp$/.test(cena.imagem.nome)) p.push("A imagem do app precisa ser uma das cenas prontas.");
  if (cena.imagem.tipo === "url" && !/^https?:\/\/\S+$/.test(cena.imagem.url)) p.push("O endereço da imagem gerada é inválido.");

  // ── as fotos: os recortes fixos, o núcleo dentro de cada um, a fala da visitante
  if (cena.fotos.length !== FOTOS.length || cena.fotos.some((f, i) => f.id !== FOTOS[i])) {
    p.push("A cena precisa de exatamente duas fotos, foto-1 e foto-2, nessa ordem.");
  }
  for (const f of cena.fotos) {
    const fixo = RECORTE_DA_FOTO[f.id];
    if (!fixo) continue;
    if (f.recorte.x !== fixo.x || f.recorte.y !== fixo.y || f.recorte.w !== fixo.w || f.recorte.h !== fixo.h) {
      p.push(`O recorte da ${f.id} é fixo: ${fixo.w}% da panorâmica a partir de x = ${fixo.x}.`);
    }
    if (areaDe(f.nucleo) <= 0 || !contemRetangulo(fixo, f.nucleo)) p.push(`A ação da ${f.id} precisa estar dentro da foto.`);
    if (!f.acao.trim()) p.push(`Descreva o que a ${f.id} mostra.`);
    const v = f.visitante.trim();
    if (!/^Na foto, vi .+!$/.test(v)) p.push(`A fala da visitante na ${f.id} segue o modelo "Na foto, vi …!".`);
    else if (v.length > VISITANTE_MAX_CARACTERES) p.push(`A fala da visitante na ${f.id} passa de ${VISITANTE_MAX_CARACTERES} caracteres.`);
  }
  const coerentes = cena.fotos.map((f) => f.seloCoerente);
  if (new Set(coerentes).size !== coerentes.length) p.push("Cada foto precisa do SEU selo: os dois selos não podem descrever a mesma foto.");
  const [n1, n2] = cena.fotos;
  if (n1 && n2 && fracaoDentro(n1.nucleo, n2.nucleo) > 0.5) p.push("As ações das duas fotos estão no mesmo lugar da cena: cada foto mostra uma atividade diferente.");

  // ── os selos
  if (cena.selos.length !== SELOS.length || cena.selos.some((s, i) => s.id !== SELOS[i])) {
    p.push("A cena precisa de exatamente dois selos, selo-1 e selo-2, nessa ordem.");
  }
  for (const s of cena.selos) {
    const t = s.texto.trim();
    if (!t) p.push(`Escreva o texto do ${s.id}.`);
    else {
      if (!caixaAlta(t)) p.push(`O selo "${t}" precisa estar em CAIXA ALTA.`);
      if (palavras(t) > SELO_MAX_PALAVRAS) p.push(`O selo "${t}" passa de ${SELO_MAX_PALAVRAS} palavras.`);
    }
    if (!s.emoji.trim()) p.push(`O ${s.id} precisa de um emoji.`);
  }

  // ── os invariantes: na faixa comum, separados
  if (cena.invariantes.length !== INVARIANTES.length || cena.invariantes.some((i, k) => i.id !== INVARIANTES[k])) {
    p.push("A cena precisa de exatamente dois objetos iguais no fundo, inv-1 e inv-2.");
  }
  for (const inv of cena.invariantes) {
    const nome = inv.nome.trim();
    if (!nome) p.push(`Dê um nome ao objeto ${inv.id}.`);
    else if (!caixaAlta(nome)) p.push(`O nome "${nome}" precisa estar em CAIXA ALTA.`);
    if (inv.alvo === null) {
      if (opcoes.exigirAlvos) p.push(`Toque no ${nome || inv.id} na imagem antes de aprovar.`);
      continue;
    }
    if (inv.alvo.r < RAIO.min || inv.alvo.r > RAIO.max) p.push(`O alvo do ${nome || inv.id} tem um tamanho fora do permitido.`);
    if (!alvoNaFaixaComum(inv.alvo)) {
      p.push(`O ${nome || inv.id} precisa estar na parte do meio, que aparece nas duas fotos (entre ${FAIXA_COMUM.de}% e ${FAIXA_COMUM.ate}% da largura).`);
    }
  }
  const [a1, a2] = cena.invariantes.map((i) => i.alvo);
  if (a1 && a2 && !alvosSeparados(a1, a2)) p.push("Os dois objetos estão colados: toque em cada um no centro dele.");

  // ── o fundo (a dica da lupa) e os marcáveis
  if (areaDe(cena.fundo) <= 0 || !contemRetangulo(PANORAMICA, cena.fundo)) p.push("O fundo precisa estar dentro da cena.");
  else if (areaDe(intersecao(cena.fundo, { x: FAIXA_COMUM.de, y: 0, w: FAIXA_COMUM.ate - FAIXA_COMUM.de, h: 100 })) <= 0) {
    p.push("O fundo precisa cobrir a parte do meio, que aparece nas duas fotos.");
  }
  if (cena.marcaveis.length < MARCAVEIS.min || cena.marcaveis.length > MARCAVEIS.max) {
    p.push(`A cena precisa de ${MARCAVEIS.min} a ${MARCAVEIS.max} coisas para marcar "fora da foto".`);
  }
  const ids = cena.marcaveis.map((m) => m.id);
  if (new Set(ids).size !== ids.length) p.push("Cada coisa para marcar precisa de um id próprio.");
  for (const m of cena.marcaveis) {
    if (!/^[a-z0-9-]{1,40}$/.test(m.id)) p.push(`O id "${m.id}" usa só minúsculas, números e hífen.`);
    if (!m.nome.trim()) p.push(`Dê um nome a "${m.id}".`);
    if (areaDe(m.area) <= 0 || !contemRetangulo(PANORAMICA, m.area)) p.push(`"${m.nome || m.id}" precisa estar dentro da cena.`);
  }
  return [...new Set(p)];
}
