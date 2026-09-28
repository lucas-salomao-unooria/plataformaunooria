/**
 * O vocabulário da exp04ef1b — Jornal da Escola: A Edição de Bento (4º ano EF,
 * unidade 1). Os valores fechados que o contrato, as regras, o catálogo e os
 * CHECKs da migração repetem; aqui eles existem UMA vez.
 *
 * A experiência e o hub têm um espelho declarado destas listas (a experiência
 * não importa a api); o teste de cada lado compara o espelho com o que a api
 * devolve, porque uma segunda lista de valores é a que ninguém atualiza junto.
 */

export const EXP_ID = "exp04ef1b";

/** A mesa sempre tem oito notícias, e a primeira página sempre três vagas. */
export const TOTAL_DE_NOTICIAS = 8;
export const TAMANHO_DA_EDICAO = 3;

/**
 * Os ids das notícias são a POSIÇÃO no pacote, e não dizem nada do gabarito:
 * `n3` é a terceira notícia da mesa, publicável ou não conforme o pacote. O
 * pacote gerado por IA usa os mesmos ids.
 */
export const IDS_DE_NOTICIA = ["n1", "n2", "n3", "n4", "n5", "n6", "n7", "n8"] as const;
export type IdDeNoticia = (typeof IDS_DE_NOTICIA)[number];
export const ID_DE_NOTICIA_RE = /^n[1-8]$/;

/**
 * Os oito meios (PDF §2): cada notícia do pacote vem de um meio diferente.
 *
 * `rede_social` e `mensagem` são conteúdo SIMULADO dentro da redação, sem
 * navegação pela plataforma: na gaveta, o post é desenhado com o `PostCard` do
 * Instanooria e a mensagem com o `MessageBubble` do WhatsApp — cada peça na
 * seção da plataforma que ela imita. Os outros seis são da redação (Unooria).
 *
 * O espelho na experiência traduz cada um para o `NewsMedium` do DS
 * (`jornal`→`newspaper`, `mural`→`bulletin`...), num `Record` exaustivo.
 */
export const MEIOS = ["jornal", "radio", "tv", "blog", "portal", "rede_social", "mensagem", "mural"] as const;
export type Meio = (typeof MEIOS)[number];

/**
 * A partição que a invariante "nenhum meio carrega o gabarito sozinho" usa
 * (PDF §3): entre as publicáveis E entre as não publicáveis tem de haver ao
 * menos um meio de cada lado. Sem isso, "desconfie do digital" acertaria tudo.
 */
export const MEIOS_TRADICIONAIS: readonly Meio[] = ["jornal", "radio", "tv", "mural"];
export const MEIOS_DIGITAIS: readonly Meio[] = ["blog", "portal", "rede_social", "mensagem"];

/**
 * As três pistas de checagem — e os três pilares da Chave do Editor. A
 * referência é PROVISÓRIA (PDF §8): se o livro do 4º ano, 1º bimestre, trouxer
 * outro critério ou uma ordem obrigatória, muda aqui, na Chave e na ficha.
 */
export const TIPOS_DE_PISTA = ["fonte", "data", "autoria"] as const;
export type TipoDePista = (typeof TIPOS_DE_PISTA)[number];

/**
 * O que falta numa notícia que não deve ir para a capa — é GABARITO, e nunca
 * desce ao estudante antes da revisão:
 * - `data`: fato antigo apresentado como atual (pode ser verdadeiro);
 * - `fonte`: aviso sem confirmação de quem tem como saber;
 * - `autoria`: ninguém assina nem se responsabiliza.
 */
export type PilarEmFalta = TipoDePista;

/**
 * Os layouts fechados da primeira página. São os MESMOS valores do
 * `NEWSPAPER_LAYOUTS` do `@unooria/design-system` (0.2.8), e ficam em inglês
 * por isso: são variante de componente, não texto. A api não depende do DS; o
 * teste da experiência compara esta lista (pelo espelho) com a do pacote.
 *
 * É SÓ isto que a IA decide na diagramação: um valor desta lista. Ela não
 * escreve texto, não escolhe notícia e não reordena as vagas (PDF §5).
 */
export const LAYOUTS = ["classic", "hero-image", "columns"] as const;
export type Layout = (typeof LAYOUTS)[number];

/** De onde veio o layout gravado: da IA, ou do modelo automático de reserva. */
export const ORIGENS_DO_LAYOUT = ["ia", "modelo"] as const;
export type OrigemDoLayout = (typeof ORIGENS_DO_LAYOUT)[number];

/**
 * As duas respostas da pergunta de motivo — feita DEPOIS da 1ª publicação
 * (decisão de 2026-09-25: perguntar antes anteciparia a descoberta, PDF §4).
 * `visual` é a aposta ingênua ("fotos mais chamativas e avisos mais urgentes");
 * `checagem` é a auditada ("quem postou, quando aconteceu e quem assina").
 */
export const MOTIVOS = ["visual", "checagem"] as const;
export type Motivo = (typeof MOTIVOS)[number];

/**
 * Os seis blocos da Chave do Editor: os três pilares e três ISCAS. Sem isca, a
 * Chave aceitaria qualquer toque e a EF15CO02 daria "atingiu" para todo mundo.
 *
 * Os ids dizem o que o bloco é (o rótulo já diz); o que NÃO desce é o conjunto
 * certo: quem corrige é `regras/chave.ts`, no servidor (regra 3). A ordem em
 * que a bandeja os mostra é embaralhada POR SESSÃO, e estável num F5.
 */
export const BLOCOS_VALIDOS = TIPOS_DE_PISTA;
export const BLOCOS_ISCA = ["foto", "urgencia", "compartilhada"] as const;
export const IDS_DE_BLOCO = [...BLOCOS_VALIDOS, ...BLOCOS_ISCA] as const;
export type IdDeBloco = (typeof IDS_DE_BLOCO)[number];

/** As três vagas da Chave, como as da página. */
export const TAMANHO_DA_CHAVE = 3;

/** Origem do pacote: o banco padrão da Unooria, ou o gerado por IA no preparo. */
export const ORIGENS_DO_PACOTE = ["padrao", "ia"] as const;
export type OrigemDoPacote = (typeof ORIGENS_DO_PACOTE)[number];
