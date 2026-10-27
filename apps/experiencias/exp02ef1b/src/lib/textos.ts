/**
 * O que a TELA escreve, em pt-BR (ADR-91), LITERAL do one-pager do PO (CAIXA
 * ALTA onde o PO usa). O leitor tem 7 a 8 anos: rótulos curtos, zero
 * parágrafos (one-pager §15) — o aprofundamento é oral, do professor. Toda
 * tela diz, no alto, o que a criança faz AGORA (o protótipo validado pelo
 * time, ADR-186), sem dizer onde está a resposta.
 *
 * A api devolve os mesmos textos em `sessao.textos` (`TEXTOS` de
 * `apps/api/src/enigma-capa/conteudo.ts`): a tela usa o do SERVIDOR quando ele
 * vem (`textoDe`) e cai neste quando não vem. Mudou a copy? Mude nos DOIS — e
 * a suíte e2e casa por texto exato.
 */
export const TEXTOS = {
  e1: {
    tag: "RASCUNHO PENDENTE",
    titulo: "INVESTIGAR A NOVA CAPA",
    contexto: "A capa sobre {espacoCurto} causou confusão entre os ouvintes.",
    missao: "ENCONTRE NAS FOTOS 2 OBJETOS {DO_ESPACO}",
    abrir: "ABRIR BANCADA",
  },
  e2: {
    titulo: "INVESTIGUE COM A LUPA",
    instrucao: "Arraste a lupa pelas duas fotos.",
    segure: "SEGURE A LUPA AQUI!",
    contador: "{n} DE 2 ENCONTRADOS",
    completa: "INVESTIGAÇÃO COMPLETA!",
    completaTexto: "Você observou atentamente as duas fotos e os detalhes da parede!",
    rotuloDaFoto1: "FOTO 1 — {ESPACO} {hora}",
    rotuloDaFoto2: "FOTO 2 — {ESPACO} {hora}",
    alerta: "OLHE O FUNDO",
    alertaTexto: "Antes de avançar, passe a lupa nas paredes do fundo de cada foto para encontrar pistas importantes!",
    voltar: "VOLTAR À INVESTIGAÇÃO",
    mao: "ARRASTE A LUPA ATÉ A PAREDE DO FUNDO",
    inatividade: "VAMOS INVESTIGAR?",
  },
  e3: {
    titulo: "ESCOLHA 1 FOTO",
    tituloSelo: "SELECIONE O SELO",
    tituloPronta: "CAPA PRONTA!",
    arraste: "Enquadre a foto",
    arrasteNota: "(Tamanho fixo, sem zoom)",
    publicar: "PUBLICAR CAPA",
    publicada: "CAPA PUBLICADA!",
    publicadaTexto: "Sua capa foi para o feed da rádio.",
    irParaOFeed: "IR PARA O FEED",
  },
  e4: {
    aguarde: "AGUARDE O PROFESSOR",
    professorJaVem: "O PROFESSOR JÁ VEM!",
    respire: "Respire fundo enquanto o professor conversa com a turma.",
    suaFoto: "SUA FOTO",
    outraFoto: "OUTRA FOTO",
    invariantes: "TOQUE EM 2 COISAS IGUAIS",
    invariantesTexto: "Toque na mesma coisa nas duas fotos.",
    contador: "{n} DE 2 ENCONTRADOS",
    bentoEntendeu: "AGORA EU ENTENDI!",
    revelar: "DESLIZE PARA REVELAR",
    revelarTexto: "Arraste o botão e veja o lugar inteiro.",
    cenaInteira: "A CENA COMPLETA",
    mesmoLugar: "MESMO LUGAR · MESMO MINUTO ({hora})",
    bentoMesmoLugar: "ERA O MESMO LUGAR!",
    avancar: "AVANÇAR",
    fora: "Marque n{espacoCurto} o que ficou fora da sua foto.",
    alfinete: "ARRASTE O ALFINETE",
    pronto: "Pronto",
  },
  e5: {
    pares: "Junte duas fotos da mesma atividade.",
    motivo: "O que é parecido?",
    segunda: "Foto de leitura: o que precisa aparecer?",
    arraste: "Enquadre a foto",
    album: "Colocar no álbum",
    guardada: "FOTO GUARDADA NO ÁLBUM!",
    fim: "MISSÃO CUMPRIDA!",
    fimTexto: "Agora conversem com o professor.",
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
  bento: "Bento",
  iara: "Iara",
  visitante: "Visitante",
  avancar: "AVANÇAR",
  lupa: "Lupa",
  /** O nome acessível da lupa: o que ela faz e como move pelo teclado. */
  lupaAria: "Lupa. Arraste sobre as fotos ou use as setas do teclado.",
  /** O anel que enche em 3 s sobre um objeto. */
  anel: (pct: number) => `Segurando a lupa: ${pct}%`,
  achou: (n: number) => `Objeto ${n} encontrado!`,
  moldura: "Moldura da capa. Enquadre a foto: arraste ou use as setas do teclado.",
  molduraSegunda: "Moldura da foto de leitura. Enquadre a foto: arraste ou use as setas do teclado.",
  revelar: "Deslize para ver o lugar inteiro",
  salaInteira: "LUGAR INTEIRO",
  fotoDeLeitura: "Foto de leitura",
  acervo: "Acervo da missão",
  marcas: (n: number, max: number) => `${n} de ${max} alfinetes`,
  pino: (n: number) => `Alfinete ${n}. Toque para tirar.`,
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

/** `{ESPACO}` em caixa alta, `{espaco}`, `{hora}`, `{espacoCurto}`, `{n}`. */
export function preencher(modelo: string, valores: Record<string, string>): string {
  return modelo.replace(/\{(\w+)\}/g, (inteiro, chave: string) => {
    if (chave in valores) return valores[chave]!;
    const baixo = chave.toLowerCase();
    if (chave === chave.toUpperCase() && baixo in valores) return valores[baixo]!.toUpperCase();
    return inteiro;
  });
}
