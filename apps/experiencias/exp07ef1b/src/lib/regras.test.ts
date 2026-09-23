import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  MINUTOS_ATE_O_CUTUCAO,
  deveCutucar,
  digitando,
  duracaoDaCascata,
  mensagemChave,
  oQueFaltaParaEnviar,
  podeEnviar,
  reacoesVisiveis,
  superficieDo,
} from "./regras";
import { EXP_VERSION, type Estado, type MensagemDoFeed, type Reacao } from "./tipos";

/** A cadência que o servidor manda, e que a tela só obedece. */
const CASCATA: Reacao[] = [
  { autor: "Carlos", texto: "…", atrasoMs: 2000 },
  { autor: "Dona Lúcia", texto: "…", atrasoMs: 3000 },
  { autor: "Marcos Admin", texto: "…", atrasoMs: 2000 },
];

function estado(parcial: Partial<Estado> = {}): Estado {
  return {
    passo: "grupo",
    passoDoEstudante: "grupo",
    aguardandoATurma: false,
    inspecionouMateria: false,
    ouviuAudio: false,
    ouviuPodcast: false,
    cardsLidos: 0,
    opcao: null,
    desfecho: null,
    desfazerUsado: 0,
    concluidoEm: null,
    turma: { etapa: "investigacao" },
    ...parcial,
  };
}

describe("a versão", () => {
  test("bate nos três lugares — manifesto, package.json e código", () => {
    // O CI lê o manifesto para montar o caminho no bucket, que é IMUTÁVEL, e o
    // package.json para decidir se republica. Divergir já causou bug, e a
    // exp04ef1b e a exp02em1b divergem hoje, cada uma com um comentário pedindo para
    // não divergir. Aqui o teste é a rede.
    const manifesto = JSON.parse(readFileSync("public/experiencia.json", "utf8"));
    const pacote = JSON.parse(readFileSync("package.json", "utf8"));
    expect(manifesto.versao).toBe(EXP_VERSION);
    expect(pacote.version).toBe(EXP_VERSION);
  });

  test("o manifesto declara a casca de aparelho e a permissão do formulário", () => {
    const manifesto = JSON.parse(readFileSync("public/experiencia.json", "utf8"));
    // `viewport` é o que liga o `DispositivoFrame` do hub — sem ele a missão
    // apareceria esticada na janela, e não num celular.
    expect(manifesto.viewport).toEqual({ largura: 375, altura: 812 });
    // Sem `forms`, o navegador BLOQUEIA o submit dentro do sandbox: o estudante
    // preenche o percurso, aperta enviar e nada acontece, com o único rastro
    // num aviso de console.
    expect(manifesto.permissoes).toContain("forms");
    expect(manifesto.capabilities).toContain("ia");
  });
});

describe("a fronteira da revelação", () => {
  test("o mensageiro desenha o grupo; a escola desenha o que vem depois dele", () => {
    for (const passo of ["chat_amara", "grupo", "intervencao", "desfecho"] as const) {
      expect(superficieDo(passo)).toBe("clone");
    }
    for (const passo of ["breakpoint", "podcast", "sintese", "reflexao", "fim"] as const) {
      expect(superficieDo(passo)).toBe("plataforma");
    }
  });
});

describe("a cascata", () => {
  test("os 7 segundos são a soma dos atrasos que o servidor mandou", () => {
    expect(duracaoDaCascata(CASCATA)).toBe(7000);
  });

  test("as reações aparecem uma a uma, na cadência 2s → 3s → 2s", () => {
    expect(reacoesVisiveis(CASCATA, 0)).toBe(0);
    expect(reacoesVisiveis(CASCATA, 1999)).toBe(0);
    expect(reacoesVisiveis(CASCATA, 2000)).toBe(1);
    expect(reacoesVisiveis(CASCATA, 4999)).toBe(1);
    expect(reacoesVisiveis(CASCATA, 5000)).toBe(2);
    expect(reacoesVisiveis(CASCATA, 7000)).toBe(3);
  });

  test("quem ainda não falou aparece digitando — é daí que vem a tensão", () => {
    expect(digitando(CASCATA, 0)).toEqual(["Carlos", "Dona Lúcia", "Marcos Admin"]);
    expect(digitando(CASCATA, 5000)).toEqual(["Marcos Admin"]);
    expect(digitando(CASCATA, 7000)).toEqual([]);
  });
});

describe("o cutucão de Amara", () => {
  test("só na investigação, só depois de 4 minutos, e só se a matéria não foi aberta", () => {
    const parado = MINUTOS_ATE_O_CUTUCAO * 60_000;
    expect(deveCutucar(estado(), parado)).toBe(true);
    expect(deveCutucar(estado(), parado - 1)).toBe(false);
    // Já inspecionou: não há o que cutucar.
    expect(deveCutucar(estado({ inspecionouMateria: true }), parado)).toBe(false);
    // Fora da investigação ela estaria falando durante a análise — e o silêncio
    // dela na Etapa 2 é o que faz o reconhecimento de padrão acontecer.
    expect(deveCutucar(estado({ passo: "intervencao" }), parado)).toBe(false);
  });
});

describe("o portão de enviar", () => {
  const pronto = estado({ passo: "intervencao", inspecionouMateria: true, ouviuPodcast: true });

  test("exige a matéria aberta — é o portão que a missão existe para instalar", () => {
    expect(podeEnviar(estado({ ouviuPodcast: true }), "B")).toBe(false);
    expect(oQueFaltaParaEnviar(estado({ ouviuPodcast: true }), "B")).toMatch(/matéria completa/);
  });

  test("exige o episódio ouvido e uma opção marcada", () => {
    expect(oQueFaltaParaEnviar(estado(), "B")).toMatch(/episódio/);
    expect(oQueFaltaParaEnviar(pronto, null)).toMatch(/Escolha uma/);
  });

  test("com tudo em ordem, libera e não tem o que dizer", () => {
    expect(podeEnviar(pronto, "B")).toBe(true);
    expect(oQueFaltaParaEnviar(pronto, "B")).toBeNull();
  });
});

describe("o feed", () => {
  test("a mensagem-chave é a única que abre a matéria", () => {
    const feed: MensagemDoFeed[] = [
      { id: "m1", autor: "Carlos", hora: "14:31", tipo: "texto", texto: "…" },
      { id: "m8", autor: "Carlos", hora: "14:46", tipo: "print", texto: "…", abreMateria: true },
    ];
    expect(mensagemChave(feed)?.id).toBe("m8");
    expect(mensagemChave([])).toBeUndefined();
  });
});
