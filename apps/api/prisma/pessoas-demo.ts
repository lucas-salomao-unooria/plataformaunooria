/**
 * Gerador de PESSOAS de demonstração: nome, login e CPF.
 *
 * Por que determinístico: o mesmo `seed` produz exatamente as mesmas pessoas,
 * na mesma ordem. Isso é o que permite rodar a carga de novo e reencontrar a
 * criança que estava numa tela — e é o que faz o arquivo de credenciais
 * continuar valendo depois de um `migrate reset`.
 *
 * Por que CPF de verdade (com dígito verificador certo): a plataforma VALIDA o
 * CPF na importação e na edição (`cpfEhValido`, ADR-33). Um CPF de mentira
 * passaria pelo seed e falharia na primeira tela de balcão que reconferisse o
 * número — o tipo de dado de demonstração que ensina o comportamento errado.
 */

/** PRNG determinístico (mulberry32). `Math.random()` daria gente nova a cada carga. */
export function prng(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOMES_F = [
  "Ana", "Beatriz", "Camila", "Carolina", "Cecília", "Clara", "Débora", "Eduarda",
  "Elisa", "Fernanda", "Gabriela", "Helena", "Isabela", "Joana", "Júlia", "Larissa",
  "Laura", "Letícia", "Lívia", "Luana", "Manuela", "Mariana", "Marina", "Natália",
  "Nicole", "Olívia", "Patrícia", "Rafaela", "Raquel", "Renata", "Sofia", "Tatiane",
  "Valentina", "Vanessa", "Vitória", "Yasmin", "Alice", "Amanda", "Bruna", "Daniela",
];

const NOMES_M = [
  "André", "Antônio", "Arthur", "Bernardo", "Bruno", "Caio", "Carlos", "Daniel",
  "Davi", "Diego", "Eduardo", "Enzo", "Felipe", "Fernando", "Gabriel", "Guilherme",
  "Gustavo", "Heitor", "Henrique", "Igor", "João", "Joaquim", "Leonardo", "Lucas",
  "Luiz", "Marcelo", "Marcos", "Mateus", "Miguel", "Murilo", "Nicolas", "Otávio",
  "Paulo", "Pedro", "Rafael", "Ricardo", "Rodrigo", "Samuel", "Thiago", "Vinícius",
];

const SOBRENOMES = [
  "Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira",
  "Lima", "Gomes", "Costa", "Ribeiro", "Martins", "Carvalho", "Almeida", "Lopes",
  "Soares", "Fernandes", "Vieira", "Barbosa", "Rocha", "Dias", "Nascimento", "Andrade",
  "Moreira", "Nunes", "Marques", "Machado", "Mendes", "Freitas", "Cardoso", "Ramos",
  "Gonçalves", "Santana", "Teixeira", "Araújo", "Correia", "Cavalcanti", "Monteiro", "Pinto",
];

/** Sem acento, sem cedilha — é o que vira login e o que a rede digita. */
export function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export interface PessoaDemo {
  nome: string;
  username: string;
  cpf: string;
}

/**
 * Fábrica com estado: garante login e CPF ÚNICOS entre TODAS as pessoas
 * geradas na mesma carga. Sem isso, `Silva` repetido colidiria no índice
 * `(escola_id, username)` e o CPF repetido no índice único de `users.cpf` —
 * e o erro sairia no meio de mil inserções, não aqui.
 */
export function criarFabricaDePessoas(semente: number) {
  const rnd = prng(semente);
  const loginsUsados = new Set<string>();
  const cpfsUsados = new Set<string>();

  const escolher = <T>(lista: readonly T[]): T => lista[Math.floor(rnd() * lista.length)]!;

  /** Dígito verificador do CPF (módulo 11) — o mesmo cálculo que `cpfEhValido` confere. */
  const digitoVerificador = (base: string, pesoInicial: number): number => {
    let soma = 0;
    for (let i = 0; i < base.length; i += 1) soma += Number(base[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const gerarCpf = (): string => {
    for (;;) {
      let base = "";
      for (let i = 0; i < 9; i += 1) base += Math.floor(rnd() * 10);
      // Sequência repetida passa no módulo 11 e não é CPF — `cpfEhValido` recusa.
      if (/^(\d)\1{8}$/.test(base)) continue;
      const d1 = digitoVerificador(base, 10);
      const d2 = digitoVerificador(base + d1, 11);
      const cpf = `${base}${d1}${d2}`;
      if (/^(\d)\1{10}$/.test(cpf)) continue;
      if (cpfsUsados.has(cpf)) continue;
      cpfsUsados.add(cpf);
      return cpf;
    }
  };

  /**
   * `prefixo` separa os espaços de login por papel quando faz sentido
   * (`prof.` para docente), porque é assim que a rede reconhece a conta na
   * lista — e porque um professor e um estudante homônimos colidiriam.
   */
  const gerarLogin = (nome: string, prefixo = ""): string => {
    const partes = semAcento(nome).toLowerCase().split(/\s+/);
    const base = `${prefixo}${partes[0]}.${partes[partes.length - 1]}`.replace(/[^a-z0-9.]/g, "");
    if (!loginsUsados.has(base)) {
      loginsUsados.add(base);
      return base;
    }
    for (let n = 2; ; n += 1) {
      const tentativa = `${base}${n}`;
      if (!loginsUsados.has(tentativa)) {
        loginsUsados.add(tentativa);
        return tentativa;
      }
    }
  };

  return {
    /** Uma pessoa nova: nome composto (primeiro + dois sobrenomes), login e CPF. */
    pessoa(prefixoDeLogin = ""): PessoaDemo {
      const primeiro = escolher(rnd() < 0.5 ? NOMES_F : NOMES_M);
      const s1 = escolher(SOBRENOMES);
      let s2 = escolher(SOBRENOMES);
      while (s2 === s1) s2 = escolher(SOBRENOMES);
      const nome = `${primeiro} ${s1} ${s2}`;
      return { nome, username: gerarLogin(nome, prefixoDeLogin), cpf: gerarCpf() };
    },
  };
}
