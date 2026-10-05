import { EXP_ID_RE } from "../comum/codigo-da-experiencia";
import { ATIVIDADE_ID_RE, FORMATO_DO_ATIVIDADE_ID } from "../equipes/regras";
import type { FichaPedagogica, MarcadorDaFicha } from "./fichas/tipos";

/**
 * As regras PURAS da evidência pedagógica (E14). Sem Prisma, sem Nest — é o que
 * o teste exercita sem banco.
 *
 * A EVIDÊNCIA É POR HABILIDADE, POR ATIVIDADE, POR RODADA. A missão define as
 * atividades (um id opaco) e conta as rodadas (reiniciar a atividade abre a
 * seguinte, e a anterior fica no histórico). Dentro de uma rodada, cada
 * habilidade da ficha recebe um nível — e é esse nível, e só ele, que o
 * professor lê e pode ajustar.
 *
 * As decisões do produto, todas aqui e todas testadas:
 *   - a escala é atingiu > em_processo > nao_atingiu; N/A é a AUSÊNCIA de linha;
 *   - dois marcadores da mesma habilidade na mesma rodada: vale o MELHOR;
 *   - o resultado da atividade é a MELHOR RODADA POR HABILIDADE;
 *   - precedência: professor > a própria criança > a cópia da equipe;
 *   - a cópia da turma inteira (projeção) não vale até o professor confirmar.
 *
 * NUNCA HÁ RANKING. Nenhuma função daqui ordena estudantes por nível, e
 * nenhuma resposta da api soma níveis numa nota: o nível é de uma habilidade,
 * não da criança.
 */

/** Os níveis que uma MARCA pode ter — o que a missão observou. */
export const STATUS_DE_MARCA = ["atingiu", "em_processo", "nao_atingiu"] as const;
export type Nivel = (typeof STATUS_DE_MARCA)[number];

/**
 * Os status de uma EVIDÊNCIA: os três níveis mais `nao_participou`, o N/A
 * EXPLÍCITO que só o professor põe. Ele existe para BARRAR a cópia da equipe
 * ("ela faltou; não herda o que o colega fez") e, no perfil, conta como N/A.
 *
 * O MESMO vocabulário dos CHECKs da migration `20260925150000_evidencia_pedagogica`
 * — `tests/evidencias-postgres.spec.ts` compara os dois.
 */
export const STATUS = [...STATUS_DE_MARCA, "nao_participou"] as const;
export type Status = (typeof STATUS)[number];

/**
 * De onde a evidência veio. A ORDEM da precedência é professor > propria >
 * (equipe | projecao): quem está acima nunca é sobrescrito por quem está abaixo.
 */
export const ORIGENS = ["propria", "equipe", "projecao", "professor"] as const;
export type Origem = (typeof ORIGENS)[number];

/** As origens que são CÓPIA — as únicas que o recálculo das equipes toca. */
export const ORIGENS_DE_COPIA = ["equipe", "projecao"] as const satisfies readonly Origem[];

/** `a_revisar` só existe na projeção, e não conta em lugar nenhum até virar `valida`. */
export const SITUACOES = ["valida", "a_revisar"] as const;
export type Situacao = (typeof SITUACOES)[number];

export const TIPOS_DE_MARCADOR = ["acao", "multipla_escolha"] as const;
export type TipoDeMarcador = (typeof TIPOS_DE_MARCADOR)[number];

export const TIPOS_DE_EVENTO = ["marca", "copia", "recalculo", "confirmacao", "ajuste"] as const;
export type TipoDeEvento = (typeof TIPOS_DE_EVENTO)[number];

/**
 * O id da ATIVIDADE: da missão, e opaco aqui — mas vai para o endereço da
 * rota do painel, então só caracteres que dispensam escape. O MESMO padrão do
 * CHECK `*_atividade_id_check` da migration.
 *
 * Mora em `equipes/regras.ts` desde a ADR-130: a montagem das equipes passou a
 * ser por atividade, e os dois CHECKs (o da marca e o da montagem) têm de
 * aceitar o mesmo id. A dependência vai no sentido de sempre — evidencias
 * importa equipes.
 */
export { ATIVIDADE_ID_RE, FORMATO_DO_ATIVIDADE_ID };

/** Os ids DENTRO da ficha (marcador, pergunta, alternativa): o mesmo alfabeto. */
export const ID_DA_FICHA_RE = ATIVIDADE_ID_RE;

/** Quantos ajustes cabem num `PATCH` — uma turma grande vezes a ficha, com folga. */
export const AJUSTES_MAX = 200;

/** A ESCALA, do menor para o maior. É o que `melhor` compara. */
export const NIVEL: Readonly<Record<Nivel, number>> = { nao_atingiu: 1, em_processo: 2, atingiu: 3 };

export function ehNivel(valor: string): valor is Nivel {
  return (STATUS_DE_MARCA as readonly string[]).includes(valor);
}

/** O melhor de dois níveis. `null` é "não avaliado" e perde para qualquer nível. */
export function melhor(a: Nivel | null | undefined, b: Nivel | null | undefined): Nivel | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return NIVEL[b] > NIVEL[a] ? b : a;
}

/**
 * O resultado PRÓPRIO de uma habilidade numa rodada: a MELHOR das marcas.
 *
 * Uma habilidade medida por uma ação e por uma pergunta — a criança acerta a
 * pergunta e tropeça na ação — fica com o acerto: a evidência diz o que ela
 * DEMONSTROU, e demonstrar uma vez é demonstrar. Sem marca, `null` (N/A).
 */
export function statusProprio(marcas: readonly { status: Nivel }[]): Nivel | null {
  return marcas.reduce<Nivel | null>((acc, m) => melhor(acc, m.status), null);
}

/** O estado de uma evidência como o histórico o grava em `de`/`para`. */
export interface EstadoDaEvidencia {
  status: Status;
  origem: Origem;
  situacao: Situacao;
}

/** O que `decidirCopia` precisa saber do COLEGA de equipe. */
export interface EstadoDoColega {
  /** O colega tem marca PRÓPRIA desta habilidade nesta rodada. */
  temMarcaPropria: boolean;
  /** A linha de `evidencias` dele para esta habilidade e rodada, se houver. */
  atual: EstadoDaEvidencia | null;
}

export type DecisaoDeCopia =
  | { gravar: false }
  | { gravar: true; status: Nivel; origem: "equipe" | "projecao"; situacao: Situacao };

/**
 * A CÓPIA PARA UM COLEGA DE EQUIPE: gravar ou não, e com o quê.
 *
 * A equipe divide um computador com o login de UM deles (ADR-111): o que a
 * missão viu naquela tela foi feito pelos três. Então o resultado próprio de
 * quem estava logado vale para os colegas — só o NÍVEL, nunca texto nenhum.
 *
 * NÃO sobrescreve:
 *   - quem tem marca PRÓPRIA da habilidade nesta rodada (entrou com o próprio
 *     login em algum momento, e o que ele fez é dele);
 *   - o AJUSTE do professor (o `nao_participou` inclusive — é para isso que
 *     ele existe);
 *   - a linha própria (defesa: ela só existe com marca própria).
 *
 * Entre duas fontes da mesma equipe, FICA A MELHOR: cópia existente igual ou
 * melhor não é reescrita — e, igual, preserva a confirmação que o professor
 * já deu à projeção.
 *
 * A PROJEÇÃO (a turma inteira diante de um computador, `ehProjecao`) copia
 * como `projecao`/`a_revisar`: uma criança que estava no fundo da sala não
 * demonstrou o que a turma respondeu no telão, e é o professor quem diz se
 * vale.
 */
export function decidirCopia(
  colega: EstadoDoColega,
  copia: { status: Nivel; projecao: boolean },
): DecisaoDeCopia {
  if (colega.temMarcaPropria) return { gravar: false };
  const atual = colega.atual;
  if (atual && (atual.origem === "professor" || atual.origem === "propria")) return { gravar: false };
  if (atual && ehNivel(atual.status) && NIVEL[copia.status] <= NIVEL[atual.status]) return { gravar: false };
  return copia.projecao
    ? { gravar: true, status: copia.status, origem: "projecao", situacao: "a_revisar" }
    : { gravar: true, status: copia.status, origem: "equipe", situacao: "valida" };
}

/**
 * A EQUIPE É A TURMA INTEIRA? — é a projeção: um computador, um telão, e a
 * sala toda respondendo junto.
 *
 * Duas formas de chegar lá, e as duas contam: a montagem disse que a sala tem
 * UM computador, ou a equipe tem TODOS os estudantes da turma (o professor
 * montou à mão uma equipe só). Turma de um estudante só não tem colega para
 * receber cópia — o resultado é o mesmo com qualquer resposta.
 */
export function ehProjecao(entrada: {
  computadores: number | null;
  membros: readonly string[];
  estudantesDaTurma: readonly string[];
}): boolean {
  if (entrada.computadores === 1) return true;
  if (entrada.estudantesDaTurma.length === 0) return false;
  const membros = new Set(entrada.membros);
  return entrada.estudantesDaTurma.every((id) => membros.has(id));
}

/**
 * O RESULTADO DA ATIVIDADE: a MELHOR RODADA POR HABILIDADE.
 *
 * Cada habilidade fica com o melhor nível VÁLIDO que teve em qualquer rodada —
 * e não "a melhor rodada" inteira: quem atingiu X na rodada 1 e Y na rodada 2
 * atingiu as duas. Reiniciar a atividade para tentar de novo não pode apagar o
 * que a criança já tinha demonstrado.
 *
 * Fica de fora o que NÃO CONTA: a projeção ainda `a_revisar`, e o
 * `nao_participou` (que é N/A — ausência de evidência, não um nível baixo).
 * Habilidade só com isso não aparece no resultado.
 */
export function melhorRodadaPorHabilidade(
  linhas: readonly { habilidade: string; status: Status; situacao: Situacao }[],
): Map<string, Nivel> {
  const resultado = new Map<string, Nivel>();
  for (const l of linhas) {
    if (l.situacao !== "valida" || !ehNivel(l.status)) continue;
    const m = melhor(resultado.get(l.habilidade), l.status);
    if (m) resultado.set(l.habilidade, m);
  }
  return resultado;
}

/** O marcador da ficha e a habilidade que ele mede, ou `null`. */
export function marcadorDaFicha(
  ficha: FichaPedagogica,
  marcadorId: string,
): { habilidade: string; marcador: MarcadorDaFicha } | null {
  for (const h of ficha.habilidades) {
    const marcador = h.marcadores.find((m) => m.id === marcadorId);
    if (marcador) return { habilidade: h.codigo, marcador };
  }
  return null;
}

/**
 * A ORDEM DAS ALTERNATIVAS como o estudante as recebe: EMBARALHADA, a cada
 * leitura (Fisher–Yates sobre uma cópia; a ficha não muda).
 *
 * A ficha guarda as alternativas na ordem em que o pedagógico as escreveu — e
 * essa ordem quase sempre é a da régua (atingiu, em processo, não atingiu).
 * Servida assim, "a primeira é a certa" vira a pista que a turma inteira
 * aprende na segunda missão, e a pergunta passa a medir quem reparou no padrão.
 * Embaralhar no SERVIDOR, e não na tela, porque o bundle é público e a tela é
 * de cada missão: a regra vale para todas sem nenhuma precisar lembrar.
 *
 * `aleatorio` é injetável para o teste ser determinístico. Não é segurança
 * (o `status` nunca desce, embaralhado ou não): `Math.random` basta.
 */
export function embaralhar<T>(lista: readonly T[], aleatorio: () => number = Math.random): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(aleatorio() * (i + 1)));
    [copia[i], copia[j]] = [copia[j] as T, copia[i] as T];
  }
  return copia;
}

/** Os marcadores de múltipla escolha que corrigem esta pergunta — pode haver mais de um. */
export function marcadoresDaPergunta(ficha: FichaPedagogica, perguntaId: string): string[] {
  return ficha.habilidades.flatMap((h) =>
    h.marcadores.filter((m) => m.tipo === "multipla_escolha" && m.perguntaId === perguntaId).map((m) => m.id),
  );
}

/** Uma cópia que o recálculo QUER que exista. */
export interface CopiaDesejada {
  estudanteId: string;
  habilidade: string;
  status: Nivel;
  origem: "equipe" | "projecao";
  situacao: Situacao;
  fonteEstudanteId: string;
  equipeId: string;
}

/**
 * AS CÓPIAS QUE DEVEM EXISTIR numa rodada, dadas as equipes de agora.
 *
 * É o mesmo `decidirCopia` visto de cima, para a rodada inteira: para cada
 * equipe e cada habilidade, a fonte é o MELHOR resultado próprio entre os
 * membros (empate: o primeiro na ordem da equipe, que é estável), e ele vai
 * para cada membro que não esteja em `bloqueados` — quem tem marca própria, ou
 * ajuste do professor, ou linha própria.
 *
 * `proprios` é o resultado próprio de cada estudante, por habilidade (a melhor
 * marca, `statusProprio`). Quem aparece ali para uma habilidade é fonte, e
 * nunca recebe cópia dela.
 */
export function copiasDesejadas(entrada: {
  equipes: readonly { id: string; membros: readonly string[] }[];
  proprios: ReadonlyMap<string, ReadonlyMap<string, Nivel>>;
  bloqueados: ReadonlySet<string>;
  projecao: (equipe: { id: string; membros: readonly string[] }) => boolean;
}): CopiaDesejada[] {
  const copias: CopiaDesejada[] = [];
  for (const equipe of entrada.equipes) {
    const fontes = new Map<string, { status: Nivel; estudanteId: string }>();
    for (const membro of equipe.membros) {
      for (const [habilidade, status] of entrada.proprios.get(membro) ?? []) {
        const atual = fontes.get(habilidade);
        if (!atual || NIVEL[status] > NIVEL[atual.status]) fontes.set(habilidade, { status, estudanteId: membro });
      }
    }
    if (fontes.size === 0) continue;

    const ehProj = entrada.projecao(equipe);
    for (const membro of equipe.membros) {
      for (const [habilidade, fonte] of fontes) {
        if (entrada.proprios.get(membro)?.has(habilidade)) continue;
        if (entrada.bloqueados.has(chaveDaEvidencia(membro, habilidade))) continue;
        copias.push({
          estudanteId: membro,
          habilidade,
          status: fonte.status,
          origem: ehProj ? "projecao" : "equipe",
          situacao: ehProj ? "a_revisar" : "valida",
          fonteEstudanteId: fonte.estudanteId,
          equipeId: equipe.id,
        });
      }
    }
  }
  return copias;
}

/** `estudante|habilidade` — a chave de uma evidência dentro de UMA rodada. */
export function chaveDaEvidencia(estudanteId: string, habilidade: string): string {
  return `${estudanteId}|${habilidade}`;
}

/** Uma cópia que JÁ existe no banco. */
export interface CopiaExistente {
  id: string;
  estudanteId: string;
  habilidade: string;
  status: Status;
  origem: Origem;
  situacao: Situacao;
  fonteEstudanteId: string | null;
  equipeId: string | null;
}

export interface MudancaDeCopia {
  estudanteId: string;
  habilidade: string;
  de: EstadoDaEvidencia | null;
  para: EstadoDaEvidencia | null;
}

/**
 * O QUE O RECÁLCULO MUDA: a diferença entre as cópias que existem e as que
 * devem existir.
 *
 * - cópia que não deve mais existir (a criança saiu da equipe, a equipe foi
 *   desfeita) → sai;
 * - cópia nova → entra;
 * - cópia com o MESMO nível e a MESMA origem → fica, COM A SITUAÇÃO QUE TINHA.
 *   É o que faz a confirmação do professor sobreviver a salvar as equipes de
 *   novo sem mudar ninguém de lugar — e como o `PUT` troca as equipes inteiras
 *   (ids novos), a linha é regravada com o carimbo novo, mas sem evento: nada
 *   mudou para quem lê.
 *
 * `mudancas` é o que vai para o histórico: só o que o professor veria mudar.
 */
export function diferencaDasCopias(
  existentes: readonly CopiaExistente[],
  desejadas: readonly CopiaDesejada[],
): { apagar: string[]; gravar: CopiaDesejada[]; mudancas: MudancaDeCopia[] } {
  const porChave = new Map(existentes.map((e) => [chaveDaEvidencia(e.estudanteId, e.habilidade), e]));
  const vistas = new Set<string>();
  const apagar: string[] = [];
  const gravar: CopiaDesejada[] = [];
  const mudancas: MudancaDeCopia[] = [];
  const estado = (e: { status: Status; origem: Origem; situacao: Situacao }): EstadoDaEvidencia => ({
    status: e.status,
    origem: e.origem,
    situacao: e.situacao,
  });

  for (const d of desejadas) {
    const chave = chaveDaEvidencia(d.estudanteId, d.habilidade);
    vistas.add(chave);
    const atual = porChave.get(chave);
    if (!atual) {
      gravar.push(d);
      mudancas.push({ estudanteId: d.estudanteId, habilidade: d.habilidade, de: null, para: estado(d) });
      continue;
    }
    if (atual.status === d.status && atual.origem === d.origem) {
      if (atual.fonteEstudanteId === d.fonteEstudanteId && atual.equipeId === d.equipeId) continue;
      apagar.push(atual.id);
      gravar.push({ ...d, situacao: atual.situacao });
      continue;
    }
    apagar.push(atual.id);
    gravar.push(d);
    mudancas.push({ estudanteId: d.estudanteId, habilidade: d.habilidade, de: estado(atual), para: estado(d) });
  }

  for (const [chave, atual] of porChave) {
    if (vistas.has(chave)) continue;
    apagar.push(atual.id);
    mudancas.push({ estudanteId: atual.estudanteId, habilidade: atual.habilidade, de: estado(atual), para: null });
  }
  return { apagar, gravar, mudancas };
}

/**
 * TUDO QUE TORNA UMA FICHA INVÁLIDA, em frases. Lista vazia = pode entrar no
 * registro.
 *
 * `codigosBncc` é o conjunto dos códigos que EXISTEM no documento homologado
 * (`curriculo/`), com a grafia exata — `ef08co05` não é um código.
 *
 * O que se confere, e por quê:
 *   - habilidade que não existe na BNCC é um painel afirmando que a criança
 *     atingiu uma coisa que a Base não tem;
 *   - alternativa com nível fora da escala viraria 500 no CHECK do banco, na
 *     mão de uma criança;
 *   - marcador de pergunta sem pergunta (ou pergunta sem marcador) é uma
 *     resposta que não mede nada — ou uma medida que nunca chega;
 *   - id repetido faria duas marcas diferentes caírem na mesma linha;
 *   - habilidade sem o critério de um dos três níveis deixa o professor sem
 *     saber o que o nível que ele vê no painel quer dizer (ADR-145).
 *
 * O `expId` existir nos MANIFESTOS não é daqui (seria ler disco numa função
 * pura): `tests/evidencias-fichas.spec.ts` confere.
 */
export function validarFicha(ficha: FichaPedagogica, codigosBncc: Pick<ReadonlySet<string>, "has">): string[] {
  const erros: string[] = [];
  const rotulo = `ficha de ${ficha.expId}`;

  if (!EXP_ID_RE.test(ficha.expId)) erros.push(`${rotulo}: expId fora do formato.`);
  if (!Number.isInteger(ficha.versao) || ficha.versao < 1) erros.push(`${rotulo}: versão tem de ser inteira, a partir de 1.`);
  if (ficha.habilidades.length === 0) erros.push(`${rotulo}: nenhuma habilidade.`);

  const perguntas = new Map(ficha.perguntas.map((p) => [p.id, p]));
  const codigos = new Set<string>();
  const marcadores = new Set<string>();
  const perguntasMarcadas = new Set<string>();

  for (const h of ficha.habilidades) {
    if (!codigosBncc.has(h.codigo)) erros.push(`${rotulo}: ${h.codigo} não é um código da BNCC.`);
    if (codigos.has(h.codigo)) erros.push(`${rotulo}: ${h.codigo} aparece mais de uma vez.`);
    codigos.add(h.codigo);
    if (h.marcadores.length === 0) erros.push(`${rotulo}: ${h.codigo} não tem marcador.`);
    for (const nivel of ["atingiu", "em_processo", "nao_atingiu"] as const) {
      if (!h.criterios?.[nivel]?.trim()) erros.push(`${rotulo}: ${h.codigo} está sem o critério de "${nivel}".`);
    }

    for (const m of h.marcadores) {
      if (!ID_DA_FICHA_RE.test(m.id)) erros.push(`${rotulo}: o marcador "${m.id}" tem id fora do formato.`);
      if (marcadores.has(m.id)) erros.push(`${rotulo}: o marcador "${m.id}" aparece mais de uma vez.`);
      marcadores.add(m.id);
      if (!(TIPOS_DE_MARCADOR as readonly string[]).includes(m.tipo)) {
        erros.push(`${rotulo}: o marcador "${m.id}" tem tipo desconhecido.`);
      }
      if (m.tipo === "multipla_escolha") {
        if (!m.perguntaId || !perguntas.has(m.perguntaId)) {
          erros.push(`${rotulo}: o marcador "${m.id}" aponta para uma pergunta que não existe.`);
        } else {
          perguntasMarcadas.add(m.perguntaId);
        }
      } else if (m.perguntaId !== undefined) {
        erros.push(`${rotulo}: o marcador de ação "${m.id}" não pode ter pergunta.`);
      }
    }
  }

  const idsDePergunta = new Set<string>();
  for (const p of ficha.perguntas) {
    if (!ID_DA_FICHA_RE.test(p.id)) erros.push(`${rotulo}: a pergunta "${p.id}" tem id fora do formato.`);
    if (idsDePergunta.has(p.id)) erros.push(`${rotulo}: a pergunta "${p.id}" aparece mais de uma vez.`);
    idsDePergunta.add(p.id);
    if (!p.enunciado.trim()) erros.push(`${rotulo}: a pergunta "${p.id}" está sem enunciado.`);
    if (p.alternativas.length < 2) erros.push(`${rotulo}: a pergunta "${p.id}" precisa de pelo menos duas alternativas.`);
    if (!perguntasMarcadas.has(p.id)) erros.push(`${rotulo}: a pergunta "${p.id}" não é corrigida por nenhum marcador.`);

    const idsDeAlternativa = new Set<string>();
    for (const a of p.alternativas) {
      if (!ID_DA_FICHA_RE.test(a.id)) erros.push(`${rotulo}: a alternativa "${a.id}" de "${p.id}" tem id fora do formato.`);
      if (idsDeAlternativa.has(a.id)) erros.push(`${rotulo}: a alternativa "${a.id}" de "${p.id}" aparece mais de uma vez.`);
      idsDeAlternativa.add(a.id);
      if (!a.texto.trim()) erros.push(`${rotulo}: a alternativa "${a.id}" de "${p.id}" está sem texto.`);
      if (!ehNivel(a.status)) erros.push(`${rotulo}: a alternativa "${a.id}" de "${p.id}" tem um nível que não existe.`);
    }
  }

  return erros;
}
