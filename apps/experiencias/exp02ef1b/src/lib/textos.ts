/**
 * O que a TELA escreve, em pt-BR (ADR-91), LITERAL do one-pager do PO (CAIXA
 * ALTA onde o PO usa). O leitor tem 7 a 8 anos: rótulos curtos, zero
 * parágrafos (one-pager §15) — o aprofundamento é oral, do professor.
 *
 * A api devolve os mesmos textos em `sessao.textos` (`TEXTOS` de
 * `apps/api/src/enigma-capa/conteudo.ts`): a tela usa o do SERVIDOR quando ele
 * vem (`textoDe`) e cai neste quando não vem. Mudou a copy? Mude nos DOIS — e
 * a suíte e2e casa por texto exato.
 */
export const TEXTOS = {
  e1: {
    titulo: "ESCOLHA SEU CRACHÁ",
    bento: "BENTO PRECISA DE AJUDA!",
    card: "INVESTIGAR A NOVA CAPA",
  },
  e2: {
    rotuloDaFoto1: "FOTO 1 — {ESPACO} {hora}",
    rotuloDaFoto2: "FOTO 2 — {ESPACO} {hora}",
    alerta: "OLHE O FUNDO",
    inatividade: "VAMOS INVESTIGAR?",
  },
  e3: {
    titulo: "ESCOLHA 1 FOTO",
    arraste: "Arraste a foto",
    assinatura: "POSTAGEM DE: {cracha}",
    publicar: "PUBLICAR CAPA",
  },
  e4: {
    aguarde: "AGUARDE O PROFESSOR",
    professorJaVem: "O PROFESSOR JÁ VEM!",
    suaFoto: "SUA FOTO",
    outraFoto: "OUTRA FOTO",
    invariantes: "TOQUE EM 2 COISAS IGUAIS",
    bentoEntendeu: "AGORA EU ENTENDI!",
    bentoMesmoLugar: "ERA O MESMO LUGAR!",
    pronto: "Pronto",
  },
  e5: {
    pares: "Junte duas fotos da mesma atividade.",
    motivo: "O que é parecido?",
    segunda: "Foto de leitura: o que precisa aparecer?",
    arraste: "Arraste a foto",
    album: "Colocar no álbum",
  },
  e6: {
    cabecalho: "HORTA DA ESCOLA",
    pergunta: "A HORTA ACABOU?",
    enviada: "SELEÇÃO ENVIADA",
    fim: "MISSÃO CUMPRIDA!",
  },
  erros: {
    semSinal: "SEM SINAL NA RÁDIO",
    carregando: "CARREGANDO CAPA...",
    tentarDeNovo: "TENTAR DE NOVO",
  },
} as const;

/**
 * Os rótulos que o PO não escreveu e a tela precisa — curtos, na voz do app.
 * Não são instrução nova (a instrução é oral): nomeiam o que já está na tela.
 */
export const ROTULOS = {
  perfil: "radio_escola",
  perfilNome: "Rádio Escola",
  hortaPerfil: "horta_da_escola",
  bento: "Bento",
  iara: "Iara",
  visitante: "Visitante",
  rascunho: "Rascunho pendente",
  avancar: "AVANÇAR",
  lupa: "Lupa",
  /** O nome acessível da lupa: o que ela faz e como move pelo teclado. */
  lupaAria: "Lupa. Arraste sobre as fotos ou use as setas do teclado.",
  moldura: "Moldura da capa. Arraste a foto ou use as setas do teclado.",
  molduraSegunda: "Moldura da foto de leitura. Arraste a foto ou use as setas do teclado.",
  revelar: "Deslize para juntar as fotos",
  fotoDeLeitura: "Foto de leitura",
  lagarta: "Uma lagarta verde comendo a borda de uma folha de alface.",
  acervo: "Acervo da missão",
  marcas: (n: number, max: number) => `${n} de ${max} marcas`,
  pino: (n: number) => `Marca ${n}. Toque para tirar.`,
  carta: (n: number) => `Foto ${n}`,
  selo: "Selo da capa",
  soltarSelo: "Solte o selo aqui",
  emojiAtividade: "🤝",
  emojiRoupa: "👕",
  emojiElemento: { mochila: "🎒", parede: "🧱", "crianca-lendo": "📖" } as Record<string, string>,
  erroDeAbertura: "SEM SINAL NA RÁDIO",
  semAtividade: "AGUARDE O PROFESSOR",
} as const;

type Secao = keyof typeof TEXTOS;

/** O texto do servidor quando ele vem; o daqui quando não vem. */
export function textoDe<S extends Secao>(
  doServidor: Record<string, Record<string, string>> | undefined,
  secao: S,
  chave: keyof (typeof TEXTOS)[S] & string,
): string {
  const remoto = doServidor?.[secao]?.[chave];
  if (typeof remoto === "string" && remoto.trim()) return remoto;
  return (TEXTOS[secao] as Record<string, string>)[chave] ?? "";
}

/** `{ESPACO}` em caixa alta, `{espaco}`, `{hora}`, `{cracha}`, `{espacoCurto}`. */
export function preencher(modelo: string, valores: Record<string, string>): string {
  return modelo.replace(/\{(\w+)\}/g, (inteiro, chave: string) => {
    if (chave in valores) return valores[chave]!;
    const baixo = chave.toLowerCase();
    if (chave === chave.toUpperCase() && baixo in valores) return valores[baixo]!.toUpperCase();
    return inteiro;
  });
}
