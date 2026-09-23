import type { AiJsonSchema } from "../ai/provider";
import {
  ESTRATEGIAS,
  JUSTIFICATIVAS,
  MATERIA,
  OPCOES,
  REACOES,
  type Desfecho,
  type IdDeOpcao,
} from "./catalogo";

/**
 * Os prompts da exp07ef1b. Ficam no SERVIDOR, sempre — o bundle é público, e um
 * prompt no cliente é a descrição do mecanismo da missão em texto legível
 * (regra inviolável nº 2).
 *
 * Uma decisão atravessa os três: **o modelo escreve a fala, nunca decide o
 * resultado**. Qual desfecho acontece, se a mensagem é fixada pelo Admin e
 * quanto vale o percurso saem de `regras/`, no servidor, com o gabarito do
 * catálogo. A IA recebe o desfecho JÁ DECIDIDO e escreve como o bairro reage a
 * ele. Sem essa separação, um modelo com um dia ruim mudaria a lição da aula.
 */

/** O bairro, como ele é. Vai nos três prompts: sem as pessoas, o modelo
 *  inventa uma vizinhança genérica e as falas param de soar como aquele grupo. */
const O_GRUPO = `
O cenário é um grupo de WhatsApp chamado "Comunidade Alerta - Bairro São Pedro".
As pessoas:
- Carlos: morador impulsivo, compartilha sem checar, escreve com exclamação.
- Dona Lúcia: senhora idosa, assustada com o que ouve, fala de forma afetuosa.
- Seu Jorge: morador cético e reclamão, acha que ninguém respeita o bairro.
- Marcos Admin: administrador do grupo, institucional e calmo, pede confirmação
  antes de agir. É ele quem fixa mensagem no topo.
- Amara: adolescente de 13 anos, amiga do estudante, fala no privado.

O caso: circulou um print recortado de uma reportagem da Gazeta Regional,
sugerindo que o festival da praça virou confusão e foi cancelado. A reportagem
completa diz o contrário — o evento tinha alvará regular e a polícia só
organizava o desvio dos ônibus. O print cortou justamente esse parágrafo.
`.trim();

/** As regras de escrita que valem para toda fala gerada. */
const COMO_ESCREVER = `
Regras de escrita, todas obrigatórias:
- Escreva como as pessoas escrevem no WhatsApp: frases curtas, linguagem falada.
- No máximo 35 palavras por mensagem.
- Nada de marcação de texto (asterisco, sublinhado, crase, cerquilha).
- Nunca use as palavras: atividade, professor, professora, gabarito, experimento,
  pesquisa, fake news, nota, pontuação, ranking.
- Nunca diga qual era a resposta certa nem que alguém errou. Quem descobre é o
  estudante, olhando a reportagem.
- Não rotule ninguém de ingênuo, burro ou desinformado.
- Português do Brasil.
`.trim();

export const SCHEMA_DAS_REACOES: AiJsonSchema = {
  type: "object",
  required: ["reacoes"],
  properties: {
    reacoes: {
      type: "array",
      description: "As três reações, na ordem: Carlos, Dona Lúcia, Marcos Admin.",
      items: {
        type: "object",
        required: ["autor", "texto"],
        properties: {
          autor: {
            type: "string",
            enum: ["Carlos", "Dona Lúcia", "Marcos Admin"],
            description: "Quem está falando.",
          },
          texto: { type: "string", description: "A mensagem, no máximo 35 palavras." },
        },
      },
    },
  },
};

/**
 * As reações do bairro à mensagem que o estudante acabou de postar.
 *
 * O desfecho vem decidido: `checada` é o bairro se acalmando e o Admin fixando
 * a contraprova; `ruido` é o pânico escalando; `conflito` é a conversa azedando
 * sem ninguém verificar nada. O modelo escreve como isso soa — e o roteiro do
 * catálogo continua ali como piso quando ele falha.
 */
export function promptDasReacoes(opcao: IdDeOpcao, desfecho: Desfecho): string {
  const escolhida = OPCOES.find((o) => o.id === opcao);
  const oQueAconteceu: Record<Desfecho, string> = {
    checada: `O estudante respondeu CITANDO o print e anexando o link da reportagem completa, mostrando que o evento tinha autorização.
O grupo se acalma. Carlos reconhece que quase repassou algo falso, Dona Lúcia sente alívio, e Marcos Admin valida publicamente o esclarecimento e diz que vai fixar a mensagem no topo.`,
    ruido: `O estudante repassou o áudio alarmado da moradora, sem checar a fonte.
O boato ganha força. Dona Lúcia se assusta mais, Seu Jorge quer espalhar para outro grupo, e Marcos Admin pede — sem sucesso — que alguém traga a reportagem inteira.`,
    conflito: `O estudante reagiu com raiva a tudo e saiu do grupo, sem trazer nenhuma evidência.
A conversa azeda. Ninguém entende o que aconteceu, Dona Lúcia continua sem saber se pode sair de casa, e Marcos Admin segue esperando alguém confirmar os fatos.`,
  };

  return `
${O_GRUPO}

O que o estudante acabou de postar no grupo:
"${escolhida?.texto ?? ""}"

${oQueAconteceu[desfecho]}

Escreva EXATAMENTE três mensagens, uma de cada pessoa, nesta ordem: Carlos,
Dona Lúcia e Marcos Admin. Elas aparecem no grupo logo depois da mensagem do
estudante, uma a cada poucos segundos.

${COMO_ESCREVER}

Para calibrar o tom, veja como estas mesmas pessoas reagiriam neste caso:
${REACOES[desfecho].map((r) => `- ${r.autor}: ${r.texto}`).join("\n")}
Não copie as frases acima; escreva outras, reagindo ao que o estudante postou.
`.trim();
}

/**
 * Amara no privado, DEPOIS da decisão.
 *
 * O silêncio dela durante a investigação é não-negociável de ofício — se ela
 * apontasse qual mensagem é falsa, o reconhecimento de padrão que a missão mede
 * deixaria de acontecer. Aqui a investigação já terminou, e conversar sobre o
 * que aconteceu é o que consolida.
 */
export function promptDeAmara(): string {
  return `
${O_GRUPO}

Você é a Amara, 13 anos, amiga de quem está falando com você. A investigação no
grupo JÁ TERMINOU e o boato foi desarmado com a reportagem completa. Agora vocês
duas estão conversando no privado sobre o que aconteceu.

Você é curiosa e direta. Reage ao que a pessoa diz, faz perguntas de volta,
conta o que achou. Você NÃO é professora nem explicadora: não dê aula, não faça
lista, não corrija ninguém. Se perguntarem algo que você não sabe, diga que não
sabe.

O que você pode comentar, se vier ao caso: como o print cortou o parágrafo da
autorização, por que uma mensagem muito encaminhada perde o vínculo com a fonte,
e o que dá para fazer da próxima vez antes de repassar.

Se a pessoa falar de algo que não tem nada a ver com o grupo do bairro, traga a
conversa de volta com naturalidade, como uma amiga faria.

${COMO_ESCREVER}
Sua fala tem no máximo 60 palavras.
`.trim();
}

/**
 * A devolutiva do "Meu percurso".
 *
 * NÃO é correção: o `score` já saiu de `regras/pontuacao.ts`, e o percurso
 * sequer entra nele. É um comentário sobre as escolhas — e é por isso que o
 * prompt proíbe dizer "certo" e "errado": o formulário mede o que a criança
 * levou da aula, e transformá-lo em prova mudaria o que ela marca.
 */
export function promptDaDevolutiva(estrategias: string[], justificativa: string): string {
  // Pelo TEXTO, nunca pelo id: `buscar_fonte` não diz nada ao modelo, e mandar
  // o identificador faria a devolutiva comentar um slug.
  const opcoes: ReadonlyArray<{ id: string; texto: string }> = [
    ...ESTRATEGIAS.map(({ id, texto }) => ({ id, texto })),
    ...JUSTIFICATIVAS.map(({ id, texto }) => ({ id, texto })),
  ];
  const texto = (id: string) => opcoes.find((o) => o.id === id)?.texto ?? id;
  return `
${O_GRUPO}

Um estudante de 13 anos acabou de registrar o percurso dele depois da missão.

As duas ações que ele considera prioritárias antes de repassar uma mensagem
alarmista:
1. ${texto(estrategias[0] ?? "")}
2. ${texto(estrategias[1] ?? "")}

E a razão que ele deu para citar a fonte oficial em vez de discutir no chat:
"${texto(justificativa)}"

Escreva UM parágrafo curto, falando com ele, comentando essas escolhas. Conecte
com o que aconteceu no grupo: o print cortado, a reportagem completa, o alívio
dos vizinhos.

Não diga se está certo ou errado, não dê nota, não corrija. Se as escolhas dele
apostam mais na velocidade do que na checagem, comente o que teria acontecido
no grupo naquele dia — sem julgar a pessoa.

${COMO_ESCREVER}
Seu texto tem no máximo 70 palavras.
`.trim();
}

/** A reportagem, para quando um prompt precisar do texto exato do corte. */
export const TRECHO_SUPRIMIDO = MATERIA.paragrafoSuprimido;
