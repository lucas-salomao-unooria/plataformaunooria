/* Vila do Lume — onboarding passo a passo e o Nome de Jogo

   Script clássico, NÃO módulo ES — e continua sendo por decisão, não por inércia: são ~10
   mil linhas com globais compartilhados (`state`, `zones`, `THREE`), e converter é semanas
   de risco num instrumento com distâncias e tempos calibrados. Ver
   `ADR-0001-jogo-nao-e-typescript.md` na raiz da experiência.

   A ordem de dependência NÃO está em nenhum `index.html`: está na lista `ARQUIVOS` de
   `src/carregador.ts`, que injeta os scripts sequencialmente. */

/* ===================== INTRO: LUME LEADS, ONE BEAT AT A TIME =====================
   The old menu dumped the whole story and three instruction cards at once. A 9-year-old
   reads none of it. Now Lume says one thing per screen and waits — the child sets the
   pace, and each verb arrives right after the reason it exists. */
/* Little pixel portraits of the actual objects, drawn with the same colours the meshes
   use in world, so the child recognises the real thing when she meets it — an emoji of a
   generic person taught her nothing about the purple villager she will actually find. */
const ART = {
  lume: `<svg viewBox="0 0 64 64" class="art-svg">
    <rect x="20" y="24" width="24" height="24" fill="#FFD84A"/>
    <rect x="24" y="10" width="16" height="16" fill="#FFF2C0"/>
    <rect x="28" y="16" width="3" height="4" fill="#1c1818"/>
    <rect x="34" y="16" width="3" height="4" fill="#1c1818"/>
    <rect x="18" y="30" width="4" height="8" fill="#FFC857"/>
    <rect x="42" y="30" width="4" height="8" fill="#FFC857"/>
  </svg>`,

  dark: `<svg viewBox="0 0 64 64" class="art-svg">
    <rect x="0" y="0" width="64" height="64" fill="#14101C"/>
    <rect x="14" y="34" width="10" height="18" fill="#231F2C"/>
    <rect x="28" y="28" width="10" height="24" fill="#231F2C"/>
    <rect x="42" y="36" width="10" height="16" fill="#231F2C"/>
    <rect x="30" y="14" width="4" height="4" fill="#3A3436"/>
    <rect x="44" y="10" width="3" height="3" fill="#3A3436"/>
    <rect x="16" y="12" width="3" height="3" fill="#3A3436"/>
  </svg>`,

  emberRock: `<svg viewBox="0 0 64 64" class="art-svg">
    <rect x="14" y="18" width="36" height="34" fill="#1E1A22"/>
    <rect x="14" y="18" width="36" height="5" fill="#2A2530"/>
    <rect x="20" y="26" width="7" height="7" fill="#FF7A2E"/>
    <rect x="34" y="24" width="6" height="6" fill="#FF7A2E"/>
    <rect x="26" y="38" width="8" height="7" fill="#FF7A2E"/>
    <rect x="40" y="38" width="5" height="5" fill="#FF9A3E"/>
    <rect x="17" y="42" width="5" height="5" fill="#FF9A3E"/>
  </svg>`,

  pick: `<svg viewBox="0 0 64 64" class="art-svg">
    <rect x="14" y="18" width="30" height="28" fill="#1E1A22"/>
    <rect x="19" y="25" width="6" height="6" fill="#FF7A2E"/>
    <rect x="30" y="34" width="7" height="6" fill="#FF7A2E"/>
    <rect x="36" y="8" width="6" height="30" fill="#7A5230" transform="rotate(38 39 23)"/>
    <rect x="40" y="6" width="20" height="7" fill="#8E8A86" transform="rotate(38 50 9)"/>
    <rect x="8" y="8" width="4" height="4" fill="#FFC24A"/>
    <rect x="52" y="46" width="4" height="4" fill="#FFC24A"/>
  </svg>`,

  brazier: `<svg viewBox="0 0 64 64" class="art-svg">
    <path d="M26 14 L32 4 L38 14 L35 20 L29 20 Z" fill="#FF8A2E"/>
    <path d="M29 16 L32 10 L35 16 L33 20 L31 20 Z" fill="#FFE08A"/>
    <rect x="18" y="24" width="28" height="5" fill="#6a3a18" transform="rotate(12 32 26)"/>
    <rect x="18" y="24" width="28" height="5" fill="#6a3a18" transform="rotate(-12 32 26)"/>
    <path d="M18 32 L46 32 L42 44 L22 44 Z" fill="#4A4550"/>
    <rect x="27" y="44" width="10" height="10" fill="#3A3540"/>
    <rect x="22" y="54" width="20" height="4" fill="#3A3540"/>
  </svg>`,

  chama: `<svg viewBox="0 0 64 64" class="art-svg">
    <path d="M32 6 L44 34 L38 46 L26 46 L20 34 Z" fill="#FFC24A"/>
    <path d="M32 18 L38 34 L35 42 L29 42 L26 34 Z" fill="#FFF2C0"/>
    <rect x="8" y="20" width="4" height="4" fill="#FFE08A"/>
    <rect x="52" y="16" width="4" height="4" fill="#FFE08A"/>
    <rect x="48" y="44" width="3" height="3" fill="#FFE08A"/>
    <rect x="14" y="46" width="3" height="3" fill="#FFE08A"/>
  </svg>`,

  villager: `<svg viewBox="0 0 64 64" class="art-svg">
    <rect x="0" y="0" width="64" height="64" fill="#14101C"/>
    <rect x="24" y="26" width="16" height="24" fill="#6B5BA8"/>
    <rect x="25" y="12" width="14" height="14" fill="#E8C9A0"/>
    <rect x="28" y="17" width="2" height="3" fill="#1c1818"/>
    <rect x="34" y="17" width="2" height="3" fill="#1c1818"/>
    <rect x="43" y="30" width="3" height="16" fill="#5E3B1C"/>
    <path d="M40 24 L44 16 L48 24 L46 30 L42 30 Z" fill="#FFC857"/>
  </svg>`,

  keys: `<svg viewBox="0 0 64 64" class="art-svg">
    <rect x="25" y="10" width="14" height="14" rx="2" fill="#8E8A86" stroke="#3A3436" stroke-width="2"/>
    <rect x="8"  y="28" width="14" height="14" rx="2" fill="#8E8A86" stroke="#3A3436" stroke-width="2"/>
    <rect x="25" y="28" width="14" height="14" rx="2" fill="#8E8A86" stroke="#3A3436" stroke-width="2"/>
    <rect x="42" y="28" width="14" height="14" rx="2" fill="#8E8A86" stroke="#3A3436" stroke-width="2"/>
    <rect x="16" y="48" width="32" height="9" rx="2" fill="#8E8A86" stroke="#3A3436" stroke-width="2"/>
  </svg>`
};

const INTRO_STEPS = [
  {
    art:ART.lume,
    title:'A VILA DO LUME',
    who:'Lume',
    say:'Oi! Eu sou o Lume. Nasci da primeira fagulha que acenderam nesta vila, faz muito tempo.'
  },
  {
    art:ART.dark,
    who:'Lume',
    say:'No meio da vila queimava o <b>Fogo Sagrado</b>. Era ele que mantinha acesas as 8 fogueiras daqui. Ontem ele apagou. As 8 apagaram junto. Agora é só escuro.'
  },
  {
    art:ART.emberRock,
    who:'Lume',
    say:'Mas o fogo não acabou. Ele fugiu e se escondeu <b>dentro das pedras</b>. Olha as pedras pretas da vila: elas têm pontinhos laranja brilhando. É o fogo ali dentro.'
  },
  {
    art:ART.pick,
    title:'QUEBRAR A PEDRA',
    key:'SEGURE F',
    who:'Lume',
    say:'Olha bem pra uma dessas pedras e <b>segura o F</b> até ela rachar. O fogo sai de dentro: cada pedra te dá <b>1 fagulha</b>.'
  },
  {
    art:ART.brazier,
    title:'ACENDER A FOGUEIRA',
    key:'T',
    who:'Lume',
    say:'Cada lugar da vila tem uma fogueira apagada. Chega perto dela com uma fagulha e aperta <b>T</b>. A fogueira acende e <b>nunca mais apaga</b>.'
  },
  {
    art:ART.chama,
    title:'PEGAR A CHAMA',
    key:'E',
    who:'Lume',
    say:'Assim que a fogueira acende, a <b>Chama Sagrada</b> daquele lugar sobe do fogo. Aperta <b>E</b> e ela é tua. São 8 Chamas, uma em cada lugar. Com as 8, a gente reacende o Fogo Sagrado.'
  },
  {
    art:ART.chama,
    title:'PEGAR FOGO NA TOCHA',
    key:'T',
    who:'Lume',
    say:'Fogueira acesa serve de fogo pra você também. Chega perto de uma que já está queimando, aperta <b>T</b> e gasta 1 fagulha pra acender <b>uma tocha</b>. Só cabe uma na mão de cada vez.'
  },
  {
    art:ART.villager,
    who:'Lume',
    say:'Com a tocha acesa dá pra acender outras coisas por aí. Cada coisa que você acende gasta a tocha inteira — aí é voltar numa fogueira e pegar fogo de novo. Você escolhe o que vale a pena.'
  },
  {
    art:ART.keys,
    title:'PRONTO PRA IR',
    who:'Lume',
    say:'Você anda com <b>WASD</b>, olha com o <b>mouse</b> e pula com <b>ESPAÇO</b>. A vila inteira tá aberta: vai por onde você quiser. Eu fico parado no centro, do lado do Fogo Sagrado apagado. Aperta <b>E</b> perto de mim quando quiser conversar.'
  }
];

/* ===================== TELA INICIAL =====================
   UM destino: jogar. Não há "ver resultados" nem lista de quem jogou nesta máquina —
   nenhuma das duas coisas existe mais, porque nenhuma partida fica na máquina.

   A criança não digita nada em lugar nenhum, e não escolhe nada: o nome vem da sessão
   autenticada da plataforma, por `window.VILA.identidade`. Não existe caminho pelo qual um
   nome de criança chegue ao payload, porque não existe onde escrevê-lo — e o exportador e a
   api conferem isso mesmo assim, cada um do seu lado. */
const TELAS = { inicio:'inicio', intro:'intro' };   // não há mais tela de escolha de estudante
let telaAtual = TELAS.inicio;

/* ---- A identidade NÃO entra por aqui. Nem por URL, nem por tela. ----

   Havia `lerDestinoDaURL()`, que lia `?estudante=7&turma=<uuid>` de um link que o professor
   distribuía, e antes disso houve uma grade de 40 números com "QUEM É VOCÊ HOJE?".

   Os dois morreram no porte para a plataforma, e o substituto é mais forte que ambos: quem
   joga é o usuário AUTENTICADO da plataforma. Não há número para digitar errado, não há
   link para colar no lugar errado, e não há mais "modo livre" — sem sessão o shim nem sobe
   o jogo (`src/main.ts`), porque partida órfã é pior que partida nenhuma: ela desaparece e o
   professor lê a lista achando que a criança não jogou.

   O que o jogo sabe da criança é `window.VILA.identidade`, e é só o primeiro nome dela. ---- */

function irPara(tela){
  telaAtual = tela;
  if(tela === TELAS.inicio) renderInicio();
  else renderIntro();
  blip(620, 0.06, 'sine', 0.05);
}

function renderInicio(){
  document.getElementById('menuOverlay').classList.add('open');
  document.getElementById('introPanel').innerHTML = `
    <div class="hub">
      <div class="hub-marca">🔥</div>
      <h2 class="hub-titulo">VILA DO LUME</h2>
      <p class="hub-sub">A vila apagou. Alguém precisa reacender as oito fogueiras.</p>

      <button class="btn hub-btn" onclick="irPara('intro')">▶ JOGAR</button>

      <!-- NÃO existe botão de resultados aqui, e isso é a regra, não esquecimento.
           Botão na tela inicial é o caminho de menor resistência para uma criança curiosa,
           e o que ele abria era o retrato dela e o dos colegas. O relatório vive na
           aplicação de acompanhamento, que a criança nunca abre.

           Também NÃO existe escolha de estudante aqui. Havia uma grade de 40 números com
           "QUEM É VOCÊ HOJE?", e ela era errada duas vezes: identidade auto-declarada não
           tem como ser conferida (a criança toca no 13 em vez do 7 e a partida dela entra
           no perfil de outra, sem nada detectar), e a própria grade conta à criança que
           ela é uma linha numa lista de quarenta. Quem diz de quem é a partida é o link
           que o professor entrega. Ver CLAUDE.md, "A criança nunca declara quem ela é".

           Comentário de HTML e não de JSX: isto vira innerHTML, então chave-asterisco não
           é comentário — é texto impresso na tela. E sem crase aqui dentro: crase fecha o
           template literal e derruba a tela inteira. -->
      <p class="hub-nota">Tudo pronto. É só apertar JOGAR.</p>
    </div>
  `;
}

/* `renderSlots()`, `escolherSlot()` e `lerDestinoDaURL()` foram removidos, não desativados:
   enquanto a função existir, alguém a chama de novo. A identidade vem de
   `window.VILA.identidade`, posta lá pelo shim a partir da sessão da plataforma. */

let introStep = 0;

function renderIntro(){
  const st = INTRO_STEPS[introStep];
  const last = introStep === INTRO_STEPS.length - 1;
  const dots = INTRO_STEPS.map((_, i) =>
    `<span class="intro-dot${i === introStep ? ' on' : ''}${i < introStep ? ' done' : ''}"></span>`).join('');

  const panelEl = document.getElementById('introPanel');
  panelEl.innerHTML = `
    ${st.title ? `<h2>${st.title}</h2>` : ''}
    <div class="intro-scene">
      <div class="intro-art">
        ${st.art}
        ${st.key ? `<div class="art-key">${st.key}</div>` : ''}
      </div>
      <div class="speech">
        <div class="speech-who">${ART.lume} Lume</div>
        <p>${st.say}</p>
      </div>
    </div>
    ${last ? `
      <div class="name-ask">
        <label>Você é</label>
        <div class="slot-escolhido">${playerLabel()}</div>
        <span class="name-hint">É esse nome que dá pra queimar na Pedra dos Nomes lá dentro.</span>
      </div>` : ''}
    <div class="intro-dots">${dots}</div>
    <div class="intro-nav">
      ${introStep > 0 ? `<button class="btn alt intro-back" onclick="introPrev()">← VOLTAR</button>` : ''}
      <button class="btn" id="introGo" onclick="${last ? 'startGame()' : 'introNext()'}">${last ? 'ENTRAR NA VILA →' : 'PRÓXIMO →'}</button>
    </div>
    ${!last ? `<button class="link-btn" onclick="introSkipToEnd()">Pular a explicação</button>` : ''}
  `;
  if(last) setTimeout(() => { const b = document.getElementById('introGo'); if(b) b.focus(); }, 60);
}

/* Pular vai para o último cartão, nunca direto ao jogo: é lá que a criança vê o nome com
   que vai ser chamada na Vila e que dá para gravar na Pedra dos Nomes. */
function introSkipToEnd(){
  introStep = INTRO_STEPS.length - 1;
  renderIntro();
  blip(660,0.06,'sine',0.05);
}

function introNext(){
  if(introStep < INTRO_STEPS.length - 1){ introStep++; renderIntro(); blip(660,0.06,'sine',0.05); }
}
function introPrev(){
  if(introStep > 0){ introStep--; renderIntro(); blip(440,0.06,'sine',0.05); }
}
