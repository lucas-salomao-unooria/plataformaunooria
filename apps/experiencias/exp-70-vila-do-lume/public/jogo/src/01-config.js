/**
 * Diário da partida. É um array normal, com um `push` que carimba `atMs` — o instante do
 * evento, em milissegundos desde "ENTRAR NA VILA".
 *
 * O carimbo mora AQUI e não nos ~20 lugares que empurram uma linha, porque nesses lugares
 * ele seria esquecido: era o que acontecia — todo evento exportado saía com `emMs: null`,
 * e a ordem era a única coisa que sobrava. Sem hora, não dá para distinguir a criança que
 * ajudou o aldeão nos primeiros trinta segundos daquela que voltou nele no fim, e essa
 * diferença é metade do que os probes de Benevolência tentam ler.
 */
function novoLog(){
  const a = [];
  a.push = function(e){
    if(e && typeof e === 'object' && e.atMs === undefined){
      /* `sessionStartedAt` nasce em 03-engine, depois deste arquivo — por isso a checagem
         em vez do valor direto. Antes de a partida começar, o carimbo é 0. */
      const t0 = (typeof sessionStartedAt === 'number') ? sessionStartedAt : null;
      e.atMs = t0 ? Math.round(performance.now() - t0) : 0;
    }
    return Array.prototype.push.call(this, e);
  };
  return a;
}

/* Vila do Lume — dados do mundo, textos das DMs e o objeto state

   Script clássico, NÃO módulo ES — e continua sendo por decisão, não por inércia: são ~10
   mil linhas com globais compartilhados (`state`, `zones`, `THREE`), e converter é semanas
   de risco num instrumento com distâncias e tempos calibrados. Ver
   `ADR-0001-jogo-nao-e-typescript.md` na raiz da experiência.

   A ordem de dependência NÃO está em nenhum `index.html`: está na lista `ARQUIVOS` de
   `src/carregador.ts`, que injeta os scripts sequencialmente. */

/* The 8 village landmarks. Each one has a Mirror fragment near it, but the fragment
   sits dark and inert — it only wakes up once the child has lit that spot with a torch
   they mined and placed themselves. Mine -> light -> claim. No menus anywhere. */
const zones = [
  {id:"loja",    art:"o", label:"Mercado",           icon:"\ud83e\uddfa", color:0xC94F4F, pos:{x:-9.4,z:-3.42},    fragDz:0,    fragY:1.55, npcLine:"O Mercado. Aqui a vila trocava as coisas: p\u00e3o, ferramenta, semente. Desde que escureceu, ningu\u00e9m mais apareceu."},
  {id:"praca",   art:"a", label:"Pra\u00e7a",             icon:"\ud83c\udf33", color:0x4F8F4F, pos:{x:-1.05,z:-11.95}, fragDz:0.5,  fragY:0.95, npcLine:"A Pra\u00e7a. Era aqui que todo mundo se encontrava, quando ainda tinha luz."},
  {id:"mural",   art:"o", label:"Mural de Recados",  icon:"\ud83d\udccc", color:0xC9A24F, pos:{x:13.02,z:-10.93},     fragDz:0.45, fragY:1.9,  npcLine:"O Mural de Recados. Os bilhetes da vila ainda est\u00e3o pregados ali. Sem luz, ningu\u00e9m consegue ler."},
  {id:"arena",   art:"a", label:"Arena",             icon:"\u2694\ufe0f", color:0x8F4FC9, pos:{x:17.2,z:12.05},  fragDz:0,    fragY:0.75, npcLine:"A Arena. Os duelos daqui paravam a vila inteira. Agora s\u00f3 tem sil\u00eancio."},
  {id:"cabine",  art:"a", label:"Casa das Mem\u00f3rias", icon:"\ud83d\udd6f\ufe0f", color:0x4FA0C9, pos:{x:3.62,z:13.52},     fragDz:0.62, fragY:1.45, npcLine:"A Casa das Mem\u00f3rias. As hist\u00f3rias da vila est\u00e3o escritas nas paredes dela. S\u00f3 d\u00e1 pra ler com luz."},
  {id:"portal",  art:"o", label:"Portal Secreto",    icon:"\ud83c\udf00", color:0x4FC98F, pos:{x:-12.26,z:26.28}, fragDz:0,    fragY:1.5,  npcLine:"O Portal Secreto. Ele fica aberto o tempo todo, mas ningu\u00e9m nunca descobriu pra onde ele leva."},
  {id:"duelo",   art:"o", label:"Campo de Treino",   icon:"\ud83c\udff9", color:0xC94FA0, pos:{x:-22.55,z:8.21},    fragDz:0,    fragY:0.9,  npcLine:"O Campo de Treino. \u00c9 aqui que a vila treinava arco e flecha."},
  {id:"ranking", art:"a", label:"Pedra dos Nomes",   icon:"\ud83e\udea8", color:0xC9C94F, pos:{x:-13.5,z:-23.38},fragDz:0.4,  fragY:1.4,  npcLine:"A Pedra dos Nomes. Os nomes de quem j\u00e1 ajudou a vila ficam gravados nela."}
];
const MIRROR = {id:"espelho", label:"Fogo Sagrado", icon:"🔥", color:0xFF8A2E, pos:{x:0,z:0}};

/* Ambient DM ambushes: pop up in the corner chat at random moments, totally decoupled
   from the fragment hunt above. No fragment, no toast, no world-glow — pure background
   safety instrumentation running in parallel with the game the child thinks she's playing. */
/* ============================================================================
   MISSÃO "A NOITE LONGA" — as mensagens que chegam durante a partida.

   OS CARTÕES NÃO MORAM MAIS AQUI. Havia `AMBIENT_DMS`, uma constante com os cinco
   cartões, os três golpes divergentes e o gabarito (`legitima`) de cada um. Ela foi
   para a api (`apps/api/src/vila/catalogo.ts`), por duas razões:

     · o gabarito estava no bundle. Uma criança com o DevTools aberto sabia quais
       mensagens eram golpe — e o instrumento morre no instante em que ela sabe o que
       está sendo medido;
     · as OUTRAS bolhas estavam no bundle. A explicação final da missão depende de ser
       "a primeira vez que a turma vê as outras versões", e qualquer criança curiosa
       podia ler a versão dos colegas antes da aula.

   O que chega agora é `window.VILA.cartoes`: só os desta criança, na ordem em que
   devem chegar, sem `legitima`, sem `nivel` e sem saber qual opção aceita o que a
   mensagem pede. O jogo registra o ÍNDICE que ela escolheu; a api corrige.

   O que NÃO mudou: os cartões LEEM o estado do jogo (para escolher a hora) e NUNCA
   escrevem nele. Nenhuma escolha aqui tira fagulha, apaga nome na Pedra ou muda
   qualquer coisa da Vila — porque fagulha é o recurso que sustenta Benevolência e
   Universalismo, e um golpe que custasse fagulha faria a criança que caiu aparecer
   como menos generosa no retrato de valores.

   Ver docs/jogo/MISSAO-a-noite-longa.md no repositório de origem.
   ============================================================================ */

/** A bolha desta criança, e os cartões dela. QUEM DECIDE É A API; o jogo só lê.
 *
 *  Era `estudanteSlot % 3` calculado aqui. Três motivos para ter saído do bundle:
 *
 *   · o slot não existe mais — a identidade vem da sessão da plataforma;
 *   · o que precisa ficar equilibrado é a TURMA, e o navegador não conhece a
 *     turma inteira. Hash de id de estudante dá terços na média da rede e pode dar
 *     14/6/5 numa sala de 25 — e aí o debate da missão não acontece, porque ele
 *     depende de as três bolhas estarem na mesma sala;
 *   · era o cliente escolhendo a condição do próprio teste, a uma linha de
 *     console de distância.
 *
 *  Ver `src/sessao.ts`. */
function bolhaDoEstudante(){
  return (window.VILA && window.VILA.bolha) || 'A';
}
const bolhaDoAluno = bolhaDoEstudante;

/** Os cartões servidos pela api para esta partida. Vazio = a missão não roda, e é
 *  isso que a api grava como `cartoesServidos: 0` — diferente de "ela ignorou tudo". */
function cartoesDaMissao(){
  return (window.VILA && window.VILA.cartoes) || [];
}




/* Schwartz vocabulary, adult-facing only. The child-facing labels that used to sit
   beside this are gone with the value bars they belonged to — her screen counts deeds now,
   so there is nothing left to name in kid words. */

/* O vocabulário Schwartz em português saiu daqui junto com o retrato: o jogo não escreve
   mais nenhuma dessas palavras em tela nenhuma. Quem traduz valor para português é a
   aplicação de acompanhamento (vila-coleta/lib/perfil/leitura.ts), que a criança não abre.

   Isto não é limpeza: enquanto as palavras existirem no bundle, um `innerHTML` distraído
   as coloca de volta na frente dela. */

const state = {
  visited: [],
  /* `riskyChoices`/`safeChoices` saíram. Eram o cliente CLASSIFICANDO as próprias
     respostas (`!legitima && aceita`), e viravam `seguras`/`risco` no payload. Sem o
     gabarito no bundle isso não é mais possível — nem desejável: quem corrige é a api
     (regra inviolável nº 3), e um bundle adulterado já não pode se reportar como tendo
     recusado tudo. O que o jogo conta agora é só quantos cartões apareceram e quantos
     ela deixou passar. */
  /* Ver `novoLog()`: o array carimba a hora de cada entrada sozinho. */
  log:novoLog(),
  /* Pares valor+fonte já contados. Ver `markOpportunity()`. */
  opportunitySeen:{},
  /* Um registro POR CARTÃO da missão, não um contador por partida. `risco: 2` não responde
     nada do que a missão precisa: 2 de quê, em que nível, decidido em quanto tempo.
     Cada registro é `{id, emMs, viuOpcoes, escolha, decisaoMs}` — o que ela FEZ, nunca o
     que aquilo significa. `legitima`, `nivel` e `aceitou` saíram: são gabarito. */
  dmCartoes:[],
  distanceWalked:0,
  bitTalked:false,
  bitTalks:0,
  sparks:0,
  // behavioural instrumentation — the profile is now inferred from how the child plays
  // the mine/light/survive loop, not from any menu choice they ever click.
  crystalsMined:0,
  torchesPlaced:0,
  torchesGiven:0,
  torchesReclaimed:0,
  villagersSelfReturned:0,
  rescueTimes:[],
  torchSpots:[],
  villagersRescued:0,
  timeInDark:0,
  timeNearBit:0,
  maxRadius:0,
  playTime:0,
  movingTime:0,
  idleTime:0,
  cellVisits:{},
  visitOrder:[],
  loreTalks:0,
  helpTalks:0,
  lumeAsks:0,          // conformity — quantas vezes preferiu perguntar a achar sozinha
  // Schwartz circumplex instrumentation
  lampsLit:0,          // universalism  — costs a spark, gives nothing back
  suggestionFollowed:null, // conformity — did they go where Lume pointed?
  suggestedZone:null,
  namesErased:0,       // power        — deliberately overwriting another child
  namesRead:0,         // (looking without erasing is not power)
  shortcutsTaken:0,    // stimulation  — crossing the dark middle instead of the lit ring
  darkCrossTime:0,
  litPathTime:0,       // security     — the long way round, in the light
  inDarkCross:false,
  score:0,
  playfulActs:0,       // hedonism     — ringing bells, kicking stones, no reward
  detourDistance:0,    // self-direction — distance beyond the minimum route

  /* ---- Identidade: NÃO MORA AQUI.
     Havia `estudanteSlot` (1 a 40, do link do professor), `turmaId` e `sessaoLocalId`.
     Os três saíram no porte para a plataforma: quem é a criança vem da sessão
     autenticada, por `window.VILA.identidade`, e o id da partida é emitido pela
     api quando ela abre. O jogo não guarda, não escolhe e não adivinha
     identidade nenhuma — e por isso não existe mais "modo livre" nem partida
     órfã. Ver `src/main.ts`. ---- */

  /* ---- Tocha: one at a time, lit at any burning Fogueira for one spark. Carrying only
     one is what makes a Dilema a Dilema — at the Aldeão/Lampião pair she can serve one,
     and the other costs a walk back. ---- */
  carryingTorch:false,
  torchesTaken:0,          // how many times she lit a Tocha at a fire
  torchesSpent:{aldeao:0, lampiao:0, pedra:0, passarela:0},
  passarelaLit:false,

  /* ---- Oportunidade Percebida: a Chamado reached her. This is what lets the panel say
     "chose not to" instead of "never saw it" — the whole basis of `observed`. ---- */
  opportunities:{},
  dilemmaSeen:0,        // times she stood inside a Dilema pair carrying a Tocha
  smokeSpotted:0,       // sinais de fumaça que entraram no campo de visão dela
  smokeFollowed:0,      // desses, quantos ela foi atrás (cortou a distância pela metade)
  dilemmaChoices:[],    // {chose:'aldeao'|'lampiao', pairId, at}

  /* ---- Pedra dos Nomes: Borda and Destaque are different acts. Borda = Achievement
     (paid for her own mark), Destaque = Power (took someone's place). ---- */
  nameOnBorda:false,
  nameOnDestaque:false,

  dmsFired:0,           // denominator for safety — only DMs that actually appeared
  dmsIgnored:0
};
