#!/usr/bin/env node
/**
 * Extrai as habilidades da BNCC dos PDFs oficiais para JSON estruturado.
 *
 *   node scripts/extrair-bncc.mjs
 *
 * ENTRADA:  documentos-fonte/bncc/*.pdf  (não versionados — ver o README de lá)
 * SAÍDA:    apps/api/src/curriculo/dados/*.ts  (VERSIONADOS e GERADOS: não edite
 *           à mão. A próxima execução sobrescreve, e a edição some em silêncio.)
 *
 * POR QUE `.ts` E NÃO `.json`
 * --------------------------
 * O `nest build` não copia arquivo não-TS para o `dist` sem configurar `assets`
 * — é o mesmo motivo pelo qual `prompt-plano-de-aula.ts` guarda um prompt como
 * string TS em vez de `.txt`. Emitindo módulo TypeScript, o dado atravessa o
 * build, o `ts-jest` e os scripts de seed sem configuração nenhuma. Os arquivos
 * gerados estão nos `ignores` do ESLint: são dado, não código para revisar.
 *
 * POR QUE COORDENADAS, E NÃO TEXTO CORRIDO
 * ----------------------------------------
 * As tabelas da BNCC são um SPREAD de duas páginas: a página par traz
 * `unidade temática` (x≈71) e `objeto de conhecimento` (x≈300); a ímpar traz
 * `habilidades` (x≈51). No texto corrido do `pdftotext` as três colunas viram
 * três blocos sequenciais e a correspondência linha-a-linha se perde — o
 * objeto de conhecimento de cada habilidade seria um chute.
 *
 * O que salva é que o InDesign alinha as linhas do spread: o objeto
 * "Estratégia de leitura" sai em yMin=260.5 e a habilidade EF15LP02 em
 * yMin=260.4, na página seguinte. Então a associação é geométrica e
 * determinística: uma habilidade pertence ao ÚLTIMO rótulo cujo y é menor ou
 * igual ao dela (um objeto que cobre três habilidades aparece uma vez só, na
 * altura da primeira). É a mesma regra para a unidade temática.
 *
 * A tolerância de `MARGEM_Y` existe porque o alinhamento é do topo da célula,
 * não da baseline: um objeto de duas linhas começa alguns pontos acima da
 * habilidade que ele encabeça.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRADA = resolve(RAIZ, "documentos-fonte/bncc");
const SAIDA = resolve(RAIZ, "apps/api/src/curriculo/dados");

/** Colunas do spread, em pontos PostScript. Medidas nos PDFs de 2017/2018. */
const COLUNA = { unidade: 71, objeto: 300, habilidade: 51 };
/** Quanto uma célula pode começar acima da linha que ela encabeça. */
const MARGEM_Y = 6;
/** Distância máxima do x medido para o x da coluna ainda contar como a coluna. */
const TOLERANCIA_X = 12;

// ---------------------------------------------------------------- utilitários

/**
 * O `-bbox-layout` produz XHTML, mas os PDFs da BNCC carregam bytes de controle
 * que o tornam mal formado (a página 422 do EF quebra qualquer parser XML). Como
 * só precisamos de `<block>`/`<word>`, varremos com expressão regular — que não
 * se importa com o resto do documento.
 */
function paginasComCoordenadas(pdf, primeira, ultima) {
  const xhtml = execFileSync(
    "pdftotext",
    ["-f", String(primeira), "-l", String(ultima), "-bbox-layout", pdf, "-"],
    { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  );

  const paginas = [];
  const rePagina = /<page\b[^>]*>([\s\S]*?)<\/page>/g;
  const reBloco =
    /<block\s+xMin="([\d.]+)"\s+yMin="([\d.]+)"\s+xMax="([\d.]+)"\s+yMax="([\d.]+)"[^>]*>([\s\S]*?)<\/block>/g;
  const rePalavra = /<word[^>]*>([\s\S]*?)<\/word>/g;

  for (let pagina; (pagina = rePagina.exec(xhtml)); ) {
    const blocos = [];
    for (let bloco; (bloco = reBloco.exec(pagina[1])); ) {
      const palavras = [];
      for (let p; (p = rePalavra.exec(bloco[5])); ) palavras.push(decodificar(p[1]));
      const texto = normalizar(palavras.join(" "));
      /* `y2` entra por causa da BNCC de Computação, onde o rótulo é CENTRADO na
         célula e não alinhado ao topo: sem a altura do bloco não há centro, e
         sem centro a associação vira a do outro layout — que erra aqui. */
      if (texto)
        blocos.push({
          x: Number(bloco[1]),
          y: Number(bloco[2]),
          x2: Number(bloco[3]),
          y2: Number(bloco[4]),
          texto,
        });
    }
    paginas.push(blocos);
  }
  return paginas;
}

function decodificar(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Junta hífen de translineação e colapsa espaços. O `pdftotext` devolve
 * "rela- cionando" quando a palavra quebrou na linha; sem isso o texto da
 * habilidade fica com hífens no meio de palavras inteiras.
 */
function normalizar(s) {
  return s
    .replace(/(\p{Ll})-\s+(\p{Ll})/gu, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}

const naColuna = (bloco, x, tolerancia = TOLERANCIA_X) => Math.abs(bloco.x - x) <= tolerancia;

/** O último rótulo que começa na altura da habilidade ou acima dela. */
function rotuloNaAltura(celulas, y) {
  let escolhido = null;
  for (const celula of celulas) if (celula.y <= y + MARGEM_Y) escolhido = celula.texto;
  return escolhido;
}

/** O centro vertical de um bloco. */
const centroY = (b) => (b.y + b.y2) / 2;

/**
 * Distribui as habilidades de uma página entre os rótulos de UMA coluna (o eixo
 * ou o objeto de conhecimento), devolvendo o rótulo de cada habilidade.
 *
 * **Por que não é "o último rótulo acima", nem "o rótulo mais perto".** A BNCC
 * de Computação (2022) CENTRA o rótulo na célula; a BNCC regular o alinha ao
 * topo. `rotuloNaAltura`, escrita para a segunda, erra sistematicamente na
 * primeira: um eixo que cobre quatro habilidades aparece na altura da terceira,
 * então as duas primeiras ficavam com o eixo anterior e a primeira de cada ano
 * ficava com `null`. Eram 80 das 129 linhas do dataset com eixo e/ou objeto
 * errados — e nenhuma delas de um jeito que o `tsc` ou a tela mostrassem: a
 * tela do plano de ensino agrupa por eixo e lista o objeto, então o defeito era
 * um agrupamento plausível e inteiramente falso.
 *
 * Trocar por "o rótulo de centro mais próximo" resolve a maioria e erra na
 * fronteira entre células de tamanhos diferentes: na página do 5º ano o
 * PENSAMENTO COMPUTACIONAL cobre UMA habilidade e o MUNDO DIGITAL cobre três,
 * e a EF05CO05 fica mais perto do centro da célula pequena.
 *
 * **A regra correta sai da própria centragem.** As células ladrilham a coluna
 * sem buraco nem sobreposição, então as habilidades se dividem em blocos
 * CONSECUTIVOS, um por rótulo — e o centro do bloco é o centro da célula, que é
 * onde o rótulo está. Escolhemos, então, a divisão em blocos consecutivos que
 * minimiza a distância entre o centro de cada rótulo e o centro do bloco dele.
 * É uma busca exaustiva, e ela cabe: uma página tem no máximo oito habilidades.
 *
 * O que a torna verificável é a CONTIGUIDADE, que ela garante por construção e
 * que `tests/curriculo-bncc-dataset.spec.ts` cobra sobre o arquivo gerado: se a
 * atribuição estivesse errada, as habilidades de um rótulo não sairiam em
 * sequência dentro do ano.
 */
function distribuirRotulos(celulas, habilidades) {
  if (!celulas.length || !habilidades.length) return habilidades.map(() => null);
  if (celulas.length === 1) return habilidades.map(() => celulas[0].texto);
  if (celulas.length >= habilidades.length) {
    // Mais rótulos que habilidades não acontece num documento bem formado; cair
    // no vizinho mais próximo é melhor que devolver nada.
    return habilidades.map((h) => {
      const c = centroY(h);
      return celulas.reduce((a, b) =>
        Math.abs(centroY(b) - c) < Math.abs(centroY(a) - c) ? b : a,
      ).texto;
    });
  }

  const centroDoBloco = (i, j) => (habilidades[i].y + habilidades[j].y2) / 2;
  let melhor = null;
  /** Corta `habilidades` em `celulas.length` blocos consecutivos não vazios. */
  const buscar = (rotulo, inicio, custo, cortes) => {
    if (melhor && custo >= melhor.custo) return;
    if (rotulo === celulas.length - 1) {
      if (inicio > habilidades.length - 1) return;
      const total = custo + Math.abs(centroY(celulas[rotulo]) - centroDoBloco(inicio, habilidades.length - 1));
      if (!melhor || total < melhor.custo) melhor = { custo: total, cortes: [...cortes, inicio] };
      return;
    }
    const sobram = celulas.length - rotulo - 1;
    for (let fim = inicio; fim <= habilidades.length - 1 - sobram; fim += 1) {
      buscar(
        rotulo + 1,
        fim + 1,
        custo + Math.abs(centroY(celulas[rotulo]) - centroDoBloco(inicio, fim)),
        [...cortes, inicio],
      );
    }
  };
  buscar(0, 0, 0, []);
  if (!melhor) return habilidades.map(() => null);

  const saida = new Array(habilidades.length).fill(null);
  melhor.cortes.forEach((inicio, r) => {
    const fim = r + 1 < melhor.cortes.length ? melhor.cortes[r + 1] - 1 : habilidades.length - 1;
    for (let k = inicio; k <= fim; k += 1) saida[k] = celulas[r].texto;
  });
  return saida;
}


// ------------------------------------------------------- domínio: os códigos

/** Sigla do componente no código do EF → slug do catálogo da plataforma. */
const COMPONENTE_EF = {
  LP: "lingua-portuguesa",
  AR: "arte",
  EF: "educacao-fisica",
  LI: "lingua-inglesa",
  MA: "matematica",
  CI: "ciencias",
  GE: "geografia",
  HI: "historia",
  ER: "ensino-religioso",
  CO: "computacao",
};

/** Sigla de área no código do EM → slug. LP e MAT são componentes, não áreas. */
const COMPONENTE_EM = {
  LP: "lingua-portuguesa",
  MAT: "matematica",
  LGG: "linguagens",
  CNT: "ciencias-da-natureza",
  CHS: "ciencias-humanas",
};

const AREA_DO_COMPONENTE = {
  "lingua-portuguesa": "linguagens",
  arte: "linguagens",
  "educacao-fisica": "linguagens",
  "lingua-inglesa": "linguagens",
  linguagens: "linguagens",
  matematica: "matematica",
  ciencias: "ciencias-da-natureza",
  "ciencias-da-natureza": "ciencias-da-natureza",
  geografia: "ciencias-humanas",
  historia: "ciencias-humanas",
  "ciencias-humanas": "ciencias-humanas",
  "ensino-religioso": "ensino-religioso",
  computacao: "computacao",
};

/* `\d{2,3}` na cauda por causa da EF05CO011, que a BNCC de Computação publica
   com três dígitos. Com `\d{2}` o código não casava aqui: `anosDoCodigo`
   devolvia `[]` e `componenteDoCodigo` devolvia `null`, então a habilidade
   existia no array e não era servida a NENHUM ano — invisível para a
   professora, e sem nada em tela que dissesse por quê. */
const RE_EF = /^EF(\d{2})([A-Z]{2})(\d{2,3})([A-Z]?)$/;
const RE_EM = /^EM13([A-Z]{2,3})(\d{2,3})$/;

/**
 * Um código do EF carrega a FAIXA de anos, não um ano: `EF15LP01` vale do 1º ao
 * 5º, `EF69LP01` do 6º ao 9º, `EF01MA01` só no 1º. Os dois dígitos são o ano
 * inicial e o final — e `0N` é a forma de dizer "só o ano N". É por isso que a
 * mesma habilidade aparece na lista de cinco anos diferentes: ela é uma só, e o
 * professor do 3º ano precisa vê-la tanto quanto o do 1º.
 */
function anosDoCodigo(codigo) {
  const ef = RE_EF.exec(codigo);
  if (ef) {
    const par = ef[1];
    const primeiro = par[0] === "0" ? Number(par[1]) : Number(par[0]);
    const ultimo = Number(par[1]);
    const anos = [];
    for (let a = Math.min(primeiro, ultimo); a <= Math.max(primeiro, ultimo); a++) {
      anos.push(`${a}EF`);
    }
    return anos;
  }
  if (RE_EM.test(codigo)) return ["1EM", "2EM", "3EM"];
  return [];
}

function componenteDoCodigo(codigo) {
  const ef = RE_EF.exec(codigo);
  if (ef) return COMPONENTE_EF[ef[2]] ?? null;
  const em = RE_EM.exec(codigo);
  if (em) return COMPONENTE_EM[em[1]] ?? null;
  return null;
}

/**
 * No EM o primeiro dígito do número de três é a COMPETÊNCIA ESPECÍFICA da área
 * a que a habilidade responde: `EM13MAT101` responde à competência 1. Guardar
 * isso evita que o plano anual trate 52 habilidades de Matemática como uma
 * lista plana — elas se agrupam em cinco competências.
 */
function competenciaEspecifica(codigo) {
  const em = RE_EM.exec(codigo);
  if (!em || em[2].length !== 3) return null;
  return Number(em[2][0]);
}

// ------------------------------------------------------ extração por documento

const RE_CABECALHO = /^([A-ZÁÂÃÉÊÍÓÔÕÚÇ][A-ZÁÂÃÉÊÍÓÔÕÚÇ\s]+?)\s+[–-]\s+(.+ANO|.+SÉRIE|.+ANOS)$/;

/** Cabeçalho de página, número de nota de rodapé e afins não são célula. */
function ehRuido(texto) {
  if (texto.length < 3) return true;
  if (/^\d+$/.test(texto)) return true;
  if (
    /* "OBJETO DE CONHECIMENTO" no SINGULAR e "EIXO" são os cabeçalhos da BNCC
       de Computação, que a lista plural da BNCC regular não pegava: eles caíam
       na faixa do meio e 11 habilidades saíram com a palavra "OBJETO DE
       CONHECIMENTO" gravada como o objeto de conhecimento delas. */
    /^(BASE NACIONAL COMUM CURRICULAR|UNIDADES TEM|OBJETOS? DE CONHECIMENTO|EIXO|COMPETÊNCIA ESPECÍFICA|HABILIDADES?|PRÁTICAS DE LINGUAGEM|CAMPOS DE ATUAÇÃO|TODOS OS CAMPOS)$/i.test(
      texto,
    )
  ) {
    return true;
  }
  return RE_CABECALHO.test(texto);
}

/**
 * Varre um PDF inteiro tratando cada página com códigos como a metade direita
 * de um spread. O resto do documento (a parte discursiva, que é a maioria) sai
 * sem custo: nenhuma habilidade, nenhum registro.
 */
function extrairDocumento(pdf, { totalDePaginas, etapa }) {
  const habilidades = new Map();
  const LOTE = 24;
  /**
   * A página par de um spread pode ser a última de um lote e a ímpar a primeira
   * do seguinte — foi o que apagou o objeto de conhecimento de História do 1º
   * ano, cujo spread cai exatamente em 408/409. Guardar a última página entre
   * os lotes custa uma variável e fecha o buraco sem reprocessar nada.
   */
  let ultimaDoLoteAnterior = [];

  for (let inicio = 1; inicio <= totalDePaginas; inicio += LOTE) {
    const fim = Math.min(inicio + LOTE - 1, totalDePaginas);
    const paginas = paginasComCoordenadas(pdf, inicio, fim);

    paginas.forEach((blocos, i) => {
      const comCodigo = blocos.filter((b) => /^\(E[FM]\d/.test(b.texto));
      if (!comCodigo.length) return;

      // As colunas de contexto estão na página anterior (a par do spread).
      const anterior = i > 0 ? paginas[i - 1] : ultimaDoLoteAnterior;
      const unidades = anterior
        .filter((b) => naColuna(b, COLUNA.unidade) && !ehRuido(b.texto))
        .sort((a, b) => a.y - b.y);
      const objetos = anterior
        .filter((b) => naColuna(b, COLUNA.objeto) && !ehRuido(b.texto))
        .sort((a, b) => a.y - b.y);

      for (const bloco of comCodigo) {
        const m = /^\((E[FM][0-9A-Z]+)\)\s*([\s\S]+)$/.exec(bloco.texto);
        if (!m) continue;
        const [, codigo, descricao] = m;
        // O PDF que o MEC serve como "EI_EF" é na verdade a BNCC COMPLETA e
        // traz o Ensino Médio no fim. Sem este filtro o EM sairia duas vezes,
        // e a versão do documento consolidado é a incompleta das duas.
        if (etapa && !codigo.startsWith(etapa)) continue;
        const componente = componenteDoCodigo(codigo);
        if (!componente) continue;

        // Uma habilidade que reaparece (a BNCC repete algumas entre anos) fica
        // com a ocorrência de descrição mais longa — a que não foi cortada.
        const jaVista = habilidades.get(codigo);
        if (jaVista && jaVista.descricao.length >= descricao.trim().length) continue;

        habilidades.set(codigo, {
          codigo,
          descricao: descricao.trim(),
          etapa: codigo.startsWith("EF") ? "EF" : "EM",
          anos: anosDoCodigo(codigo),
          componente,
          area: AREA_DO_COMPONENTE[componente] ?? null,
          unidadeTematica: rotuloNaAltura(unidades, bloco.y),
          objetoDeConhecimento: rotuloNaAltura(objetos, bloco.y),
          competenciaEspecifica: competenciaEspecifica(codigo),
        });
      }
    });

    ultimaDoLoteAnterior = paginas.at(-1) ?? [];
  }

  return [...habilidades.values()];
}

// ------------------------------------------------- BNCC Computação (2022)

/**
 * A normativa de Computação usa OUTRO layout, e um mais generoso: as três
 * colunas (eixo x≈100, objeto x≈175, habilidade x≈334) cabem na MESMA página, e
 * a página seguinte do spread traz duas colunas que a BNCC regular não tem —
 * `EXPLICAÇÃO DA HABILIDADE` (x≈37) e `EXEMPLOS` (x≈306). São o comentário
 * pedagógico de cada habilidade, e é o que faz o plano gerado falar de
 * computação como prática de sala de aula em vez de repetir o texto legal.
 *
 * Aqui a associação NÃO pode ser por y: a explicação de EF03CO04 sai em y=180,6
 * e a habilidade em y=198,6 — as duas páginas têm alturas de linha próprias. O
 * que se conserva é a ORDEM. Casamos por índice, e só quando as contagens
 * batem: um spread em que elas divergem devolve explicação nula em vez de
 * atribuir a explicação de uma habilidade a outra.
 */
/**
 * O documento usa DUAS larguras de tabela (os anos iniciais são mais estreitos),
 * então nenhuma coluna tem x fixo: o eixo cai entre 69 e 108, o objeto entre 175
 * e 198, e a habilidade entre 244 e 433 porque o texto é centralizado na célula
 * — o x depende do comprimento da primeira linha. Classificar por posição exata
 * perdeu 4 de cada 5 objetos de conhecimento.
 *
 * O que é estável: o eixo só tem TRÊS valores possíveis, e a habilidade começa
 * com o próprio código. Sobra o objeto, que é o bloco de texto restante na faixa
 * do meio.
 */
const EIXOS_COMPUTACAO = ["PENSAMENTO COMPUTACIONAL", "MUNDO DIGITAL", "CULTURA DIGITAL"];
const COLUNA_CO = { explicacao: 37, exemplos: 306 };

function extrairComputacao(pdf, { totalDePaginas }) {
  const habilidades = new Map();
  const LOTE = 24;
  let ultimaDoLoteAnterior = [];
  /**
   * Uma tabela que não coube na página segue numa marcada "(CONTINUAÇÃO)", e lá
   * a primeira habilidade fica ACIMA de qualquer célula de objeto: a dela ficou
   * na página anterior. Sem herdar, 43% das habilidades de Computação saíam sem
   * objeto de conhecimento. A herança só vale na continuação — num ano novo o
   * cabeçalho reseta, senão o 4º ano herdaria o objeto do 3º.
   */
  let heranca = { eixo: null, objeto: null };

  for (let inicio = 1; inicio <= totalDePaginas; inicio += LOTE) {
    const fim = Math.min(inicio + LOTE - 1, totalDePaginas);
    const paginas = paginasComCoordenadas(pdf, inicio, fim);
    const todas = [ultimaDoLoteAnterior, ...paginas];

    todas.forEach((blocos, i) => {
      const continuacao = blocos.some((b) => /\(CONTINUA[ÇC][ÃA]O\)/i.test(b.texto));
      const naTabela = blocos
        /* `\d{2,3}` porque a BNCC publica "(EF05CO011)" — três dígitos, no
           que é erro de digitação DELA. Com `\d{2}` a habilidade sumia do
           dataset inteiro, em silêncio: 129 linhas onde o documento tem 130. O
           código fica como está no documento oficial; "corrigi-lo" para
           EF05CO11 inventaria um código que nenhuma rede vai procurar. */
        .filter((b) => /^\(E[FM]\d{2}CO\d{2,3}\)/.test(b.texto))
        .sort((a, b) => a.y - b.y);
      if (!naTabela.length) return;

      const eixos = blocos
        .filter((b) => EIXOS_COMPUTACAO.includes(b.texto.toUpperCase()))
        .sort((a, b) => a.y - b.y);
      // A faixa do objeto é RELATIVA às outras duas colunas desta página: entre
      // o fim do eixo e o começo da habilidade mais à esquerda. Uma faixa em
      // pontos absolutos servia à largura de tabela dos anos iniciais e perdia
      // as seções que usam a outra (o 5º ano inteiro, e os blocos EF15/EF69).
      const limiteEsquerdo = eixos.length ? Math.max(...eixos.map((e) => e.x)) + 20 : 120;
      const limiteDireito = Math.min(...naTabela.map((h) => h.x)) - 15;
      const objetos = blocos
        .filter(
          (b) =>
            b.x > limiteEsquerdo &&
            b.x < limiteDireito &&
            !ehRuido(b.texto) &&
            !/^\(E[FM]\d{2}CO/.test(b.texto),
        )
        .sort((a, b) => a.y - b.y);

      // As duas colunas de comentário estão na página SEGUINTE do spread.
      const seguinte = todas[i + 1] ?? [];
      const explicacoes = seguinte
        .filter((b) => naColuna(b, COLUNA_CO.explicacao, 20) && b.texto.length > 40)
        .sort((a, b) => a.y - b.y);
      const exemplos = seguinte
        .filter((b) => naColuna(b, COLUNA_CO.exemplos, 20) && b.texto.length > 40)
        .sort((a, b) => a.y - b.y);

      /* A distribuição é da PÁGINA inteira, não de uma habilidade por vez: a
         regra é uma partição em blocos consecutivos, e uma partição não se
         decide olhando uma linha só. */
      const eixoDe = distribuirRotulos(eixos, naTabela);
      const objetoDe = distribuirRotulos(objetos, naTabela);

      naTabela.forEach((bloco, ordem) => {
        const m = /^\((E[FM]\d{2}CO\d{2,3})\)\s*([\s\S]+)$/.exec(bloco.texto);
        if (!m) return;
        const [, codigo, descricao] = m;
        const jaVista = habilidades.get(codigo);
        if (jaVista && jaVista.descricao.length >= descricao.trim().length) return;

        habilidades.set(codigo, {
          codigo,
          descricao: descricao.trim(),
          etapa: codigo.startsWith("EF") ? "EF" : "EM",
          anos: anosDoCodigo(codigo),
          componente: "computacao",
          area: "computacao",
          eixo: eixoDe[ordem] ?? (continuacao ? heranca.eixo : null),
          objetoDeConhecimento: objetoDe[ordem] ?? (continuacao ? heranca.objeto : null),
          explicacao: explicacoes.length === naTabela.length ? explicacoes[ordem].texto : null,
          exemplos: exemplos.length === naTabela.length ? exemplos[ordem].texto : null,
        });
      });

      heranca = {
        eixo: eixos.at(-1)?.texto ?? (continuacao ? heranca.eixo : null),
        objeto: objetos.at(-1)?.texto ?? (continuacao ? heranca.objeto : null),
      };
    });

    ultimaDoLoteAnterior = paginas.at(-1) ?? [];
  }

  return [...habilidades.values()];
}

function contarPaginas(pdf) {
  const info = execFileSync("pdfinfo", [pdf], { encoding: "utf8" });
  return Number(/Pages:\s+(\d+)/.exec(info)[1]);
}

// ------------------------------------------------------------------ execução

const DOCUMENTOS = [
  {
    arquivo: "bncc-completa-2018.pdf",
    saida: "habilidades-ef.ts",
    rotulo: "BNCC Ensino Fundamental",
    etapa: "EF",
  },
  {
    // O MEC serve, na página do Ensino Médio, um PDF de 11/05/2018 que é o
    // RASCUNHO pré-homologação: tem 179 habilidades contra as 183 do
    // homologado, e os textos divergem — `EM13MAT101` perdeu "criticamente" e
    // "fatos relativos". As duas etapas saem do mesmo documento consolidado.
    arquivo: "bncc-completa-2018.pdf",
    saida: "habilidades-em.ts",
    rotulo: "BNCC Ensino Médio",
    etapa: "EM",
  },
  {
    arquivo: "bncc-computacao-2022.pdf",
    saida: "habilidades-computacao.ts",
    rotulo: "BNCC Computação",
    etapa: null,
    computacao: true,
  },
];

function main() {
  mkdirSync(SAIDA, { recursive: true });

  for (const doc of DOCUMENTOS) {
    const pdf = resolve(ENTRADA, doc.arquivo);
    if (!existsSync(pdf)) {
      console.error(`  ! ${doc.arquivo} não está em documentos-fonte/bncc — pulando`);
      continue;
    }
    const paginas = contarPaginas(pdf);
    process.stdout.write(`  ${doc.rotulo} (${paginas}p) … `);
    const habilidades = doc.computacao
      ? extrairComputacao(pdf, { totalDePaginas: paginas })
      : extrairDocumento(pdf, { totalDePaginas: paginas, etapa: doc.etapa });
    /* A ordem é a do DOCUMENTO, e por isso o número final entra como NÚMERO.
       `localeCompare` puro põe "EF05CO011" entre a CO01 e a CO02, porque
       compara caractere a caractere — e aí a sequência dos eixos dentro do 5º
       ano deixa de ser PENSAMENTO → MUNDO → CULTURA, que é justamente o que o
       teste do dataset usa para provar que a atribuição está certa. O prefixo
       continua alfabético; só a cauda numérica vira número. */
    const prefixo = (c) => c.replace(/\d+$/, "");
    const sufixo = (c) => Number((/(\d+)$/.exec(c) ?? [0, 0])[1]);
    habilidades.sort(
      (a, b) =>
        prefixo(a.codigo).localeCompare(prefixo(b.codigo)) ||
        sufixo(a.codigo) - sufixo(b.codigo),
    );

    const nomeDaConstante = doc.saida
      .replace(/\.ts$/, "")
      .replace(/-(\w)/g, (_, c) => c.toUpperCase());

    writeFileSync(
      resolve(SAIDA, doc.saida),
      [
        `// GERADO por scripts/extrair-bncc.mjs a partir de ${doc.arquivo}.`,
        "// NÃO edite à mão: a próxima execução sobrescreve o arquivo.",
        `// Documento: ${doc.rotulo} — ${habilidades.length} habilidades.`,
        "",
        'import type { HabilidadeBncc } from "../tipos";',
        "",
        `export const ${nomeDaConstante}: readonly HabilidadeBncc[] = ${JSON.stringify(habilidades, null, 2)};`,
        "",
      ].join("\n"),
    );

    const semObjeto = habilidades.filter((h) => !h.objetoDeConhecimento).length;
    console.log(
      `${habilidades.length} habilidades → ${doc.saida}` +
        (semObjeto ? `  (${semObjeto} sem objeto de conhecimento)` : ""),
    );
  }
}

main();
