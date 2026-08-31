import { createExperiencia } from "@edu/sdk";
import { carregarJogo } from "./carregador";
import { abrirSessao, concluirSessao } from "./sessao";
import type { PontePlataforma } from "./tipos";

/**
 * Shim da Vila do Lume — o único código desta experiência que o Vite compila.
 *
 * Faz três coisas, na ordem, e nada mais:
 *   1. handshake com o hub (SDK) → identidade do estudante LOGADO;
 *   2. abre a partida na api → a bolha da missão "A Noite Longa";
 *   3. só então injeta os scripts do jogo.
 *
 * A ordem não é estilo. O jogo boota no parse (`renderInicio()` no fim de
 * `16-boot.js`) e a primeira tela já usa o nome da criança; se os scripts
 * entrassem antes do handshake, a tela inicial montaria sem identidade e a
 * bolha seria escolhida antes de a api ter opinião.
 *
 * A IDENTIDADE VEM DA SESSÃO, não de um número na URL. O jogo de origem lia
 * `?estudante=7&turma=<uuid>` de um link que o professor distribuía; na plataforma
 * o estudante já está logado, e isso é mais forte: não se digita errado, não se
 * cola no lugar errado, e não existe mais "modo livre" com partida órfã.
 */

/** Versão do bundle. Vai para `hub:init` (telemetria) E para a linha da partida,
 *  porque quem estava com a aba aberta durante um publish termina com a anterior:
 *  sem isto o skew de versão fica invisível na tabela. Subir aqui e no
 *  `experiencia.json` é o mesmo ato. */
const EXP_VERSION = "1.0.0";

/** `"Ana Beatriz Souza"` → `"Ana"`. A Pedra dos Nomes é lida pelas outras
 *  crianças da turma; nome inteiro ali é exposição sem ganho nenhum. */
function primeiroNome(nome: string): string {
  const primeiro = nome.trim().split(/\s+/)[0];
  return primeiro && primeiro.length > 0 ? primeiro : "Você";
}

/** O mínimo que o hub precisa saber. NUNCA o payload inteiro: ele é telemetria
 *  comportamental com prazo de retenção, e o progresso do hub não tem prazo. */
function resumoParaOHub(payload: unknown): Record<string, unknown> {
  if (payload === null || typeof payload !== "object") return {};
  const p = payload as { status?: unknown; resumo?: { fogueirasAcesas?: unknown } };
  return {
    status: typeof p.status === "string" ? p.status : "desconhecido",
    fogueirasAcesas: typeof p.resumo?.fogueirasAcesas === "number" ? p.resumo.fogueirasAcesas : 0,
  };
}

async function iniciar(): Promise<void> {
  const exp = await createExperiencia({
    expId: "exp-70-vila-do-lume",
    expVersion: EXP_VERSION,
  });

  /* `atual` é a partida em curso. Ela TROCA quando a criança joga de novo, e é
     por isso que a ponte lê desta variável em vez de fechar sobre a primeira. */
  let atual = await abrirSessao(exp, EXP_VERSION);

  const ponte: PontePlataforma = {
    identidade: { primeiroNome: primeiroNome(exp.estudante.nome) },
    bolha: atual.bolha,
    cartoes: atual.cartoes,
    reabrir: () => {
      void abrirSessao(exp, EXP_VERSION)
        .then((nova) => {
          atual = nova;
          /* A bolha é estável por estudante (a api garante), então na prática estes
             dois não mudam. Reatribuir de qualquer jeito: se algum dia a regra
             mudar, o jogo não fica com a lista da partida anterior. */
          ponte.bolha = nova.bolha;
          ponte.cartoes = nova.cartoes;
        })
        .catch((erro: unknown) => {
          /* A partida ANTERIOR está gravada e intacta — `atual` continua
             apontando para ela, e concluir de novo devolve `jaEstava` sem tocar
             em nada. O que se perde é o registro desta segunda partida, e isso
             aparece no console do adulto. A criança joga inteiro do mesmo jeito;
             travar o botão dela por causa de rede seria pior. */
          console.error("[vila] não foi possível abrir a partida nova:", erro);
        });
    },
    registrar: (verbo, objeto, dados) => exp.track(verbo, objeto, { resultado: dados }),
    concluir: (payload) => {
      concluirSessao(exp, atual.sessaoId, payload);
      /* E o sinal PADRÃO da plataforma de que a experiência terminou
         (`exp:concluir` → o hub grava progresso). São coisas diferentes: a
         partida vai para `/vila/*`, que é domínio da exp-70; isto é o que faz o
         hub e o `/estudante` saberem que ela concluiu, igual a qualquer experiência.

         Sem `score`: o número da HUD existe só para motivar a criança a terminar
         o objetivo, e Ato Opcional vale zero de propósito. Passá-lo como `score`
         convidaria a lê-lo como nota, que é o oposto do desenho. */
      exp.concluir({ dados: resumoParaOHub(payload) });
    },
  };
  window.VILA = ponte;

  /* Pausa/retomada vêm do hub (visibilidade e foco da página). O jogo é
     primeira pessoa com pointer lock: perder o foco sem soltar o ponteiro
     deixaria a criança com a câmera presa numa aba que não é a dela. Quem sabe
     mexer nos globais do jogo é `18-plataforma.js`; aqui só repassamos. */
  exp.on("pause", () => window.vilaPausar?.());
  exp.on("resume", () => window.vilaRetomar?.());

  await carregarJogo();
  exp.track("attempted", "vila-do-lume");
}

void iniciar().catch((erro: unknown) => {
  /* Sem handshake não há identidade, e sem identidade a partida não pode ser
     atribuída a ninguém. O jogo NÃO sobe: uma partida órfã é pior que partida
     nenhuma — ela some, e o professor lê a lista achando que a criança não
     jogou. A mensagem é para o adulto que abriu o console, não para a criança:
     o texto na tela dela não menciona erro de sistema. */
  console.error("[vila] não foi possível iniciar a experiência:", erro);
  document.body.innerHTML =
    '<div style="display:flex;height:100vh;align-items:center;justify-content:center;' +
    'font-family:monospace;color:#C9A24F;background:#0B0D12;text-align:center;padding:24px">' +
    "A vila não abriu agora. Chame o professor.</div>";
});
