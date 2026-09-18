import "./site.css";

import { CadastroDeInteresse, ROTULO_DO_CONVITE } from "./formulario-de-cadastro";
import { PalcoDoSite } from "./palco-do-site";

/**
 * O SITE PÚBLICO — ENTRE REDES (ADR-107).
 *
 * É a raiz (`/`) para quem chega sem sessão. A marcação abaixo é o porte 1:1
 * do material aprovado (`Unooria_Entre_Redes_site_completo`): mesma árvore,
 * mesmas classes, mesmos ids, mesma ordem — porque é o `site.css`, copiado
 * inteiro, que a estiliza, e ele casa por classe e por id. Trocar um `div` por
 * um `section`, agrupar dois irmãos ou "limpar" uma classe aparece como
 * defeito de layout, não como refatoração.
 *
 * DUAS coisas mudaram em relação ao bundle de origem, e só elas:
 *  - o `<form>` saiu do corpo da página e virou `CadastroDeInteresse`: uma
 *    JANELA que os três "Quero conhecer a solução" abrem, e que posta na api
 *    (ADR-107, ajuste de 2026-09-17 — ver `components/site/AGENTS.md`);
 *  - os `<script>` viraram `efeitos/`, montados pelo `PalcoDoSite`.
 *
 * O QUE NÃO SE APLICA AQUI: o design system. O DS vale da porta do login para
 * dentro; esta é a superfície de marketing, e ela tem tipografia, paleta e
 * movimento próprios (ver `site.css`). É a mesma fronteira que a landing
 * anterior respeitava ao contrário — ela era feita de DS —, e a troca é
 * deliberada.
 *
 * `<img>` cru, e não `next/image`: a marca no cabeçalho é lida PIXEL A PIXEL
 * pelo `efeitos/infinito.ts` para formar o infinito de estrelas. O
 * `next/image` serviria outro arquivo, em outro formato e outro tamanho, e o
 * contorno amostrado deixaria de ser o da marca.
 */
export function SiteEntreRedes() {
  return (
    <PalcoDoSite>

      <svg className="brand-filter" xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true" focusable="false">
      <defs><filter id="brand-on-navy" colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 .88 0 0 0 0 .90 0 0 0 0 .96 .4252 1.4304 .1444 0 -.25" /></filter></defs>
      </svg>
      <canvas id="ambient-dust" aria-hidden="true"></canvas>
      <a className="skip" href="#inicio">Ir para o conteúdo</a>
      <header className="header">
      <div className="head-inner">
      <a className="brand" href="#inicio" aria-label="Unooria — início">
      <img src="/site/assets/c391a425254523c1.webp" width="600" height="129" alt="Unooria" />
      </a>
      <span className="brand-label">ENTRE REDES</span>
      <nav className="main-nav" aria-label="Navegação principal">
      <a href="#resposta">O programa</a>
      <a href="#metodo">Método</a>
      <a href="#missoes">Missões</a>
      <a href="#curriculo">Currículo</a>
      <a href="#docentes">Docentes</a>
      </nav>
      {/* Era um link para `#cadastro`; virou o botão que abre a janela (o
          formulário não está mais aberto na página). O rótulo curto é o que
          aparece no celular, onde "Quero conhecer a solução" não cabe ao lado
          do menu. */}
      <button className="floating-cta" type="button" aria-haspopup="dialog" aria-controls="cadastro-dialog" aria-label={ROTULO_DO_CONVITE} data-abrir-cadastro=""><span className="cta-label-full">{ROTULO_DO_CONVITE}</span><span className="cta-label-short" aria-hidden="true">Conhecer</span></button>
      <button className="menu-button" id="menu-open" aria-expanded="false" aria-label="Abrir navegação" aria-haspopup="dialog" aria-controls="index-dialog"><span className="menu-label">Explorar</span> <span className="menu-symbol" aria-hidden="true">
      </span>
      </button>
      </div>
      <div className="progress" aria-hidden="true">
      </div>
      </header>
      <nav className="chapter-rail" aria-label="As nove seções">
      <a href="#inicio" aria-label="01 — Programa" aria-current="location">
      <span>01 · Programa</span>
      </a>
      <a href="#desafio" aria-label="02 — O desafio">
      <span>02 · O desafio</span>
      </a>
      <a href="#resposta" aria-label="03 — Nossa resposta">
      <span>03 · Nossa resposta</span>
      </a>
      <a href="#metodo" aria-label="04 — O método">
      <span>04 · O método</span>
      </a>
      <a href="#missoes" aria-label="05 — As missões">
      <span>05 · As missões</span>
      </a>
      <a href="#gestao" aria-label="06 — Gestão">
      <span>06 · Gestão</span>
      </a>
      <a href="#curriculo" aria-label="07 — Currículo">
      <span>07 · Currículo</span>
      </a>
      <a href="#docentes" aria-label="08 — Docentes">
      <span>08 · Docentes</span>
      </a>
      <a href="#familias" aria-label="09 — Famílias">
      <span>09 · Famílias</span>
      </a>
      </nav>
      <main id="main">
      <section className="section hero dark" id="inicio" aria-labelledby="hero-title">
      <canvas className="opening-stars" id="opening-stars" aria-hidden="true"></canvas>
      <div className="container">
      <div className="hero-opening">
      <h1 id="hero-title"><span className="hero-line">A vida mudou de tela.</span>
      <span className="hero-line">A educação precisa <span className="hero-accent">mudar de aula.</span></span>
      </h1>
      <div className="hero-sub">
      <p>O ENTRE REDES conecta a vida nas telas à aprendizagem na escola.<br /> Educação Digital e Midiática para estudantes do Ensino Fundamental e Ensino Médio.</p>
      </div>
      </div>
      </div>
      </section>

      <section className="section" id="desafio" aria-labelledby="problem-title">
      <div className="container">
      <div className="section-top">
      <div className="eyebrow">
      <span className="num">02 / 09</span> O desafio</div>
      <span className="section-name">Da responsabilidade à prática</span>
      </div>
      <div className="problem-layout">
      <div className="problem-intro reveal">
      <h2 id="problem-title">O mundo digital criou uma nova responsabilidade para a escola.</h2>
      <p className="section-subtitle">E colocá-la em prática não é simples.</p>
      <p className="problem-support">A Educação Digital e Midiática deixou de ser apenas uma pauta relevante e passou a fazer parte das responsabilidades das redes de ensino. PNED, novas diretrizes curriculares, ECA Digital e PNLD aumentam a urgência de levar o tema para a sala de aula.</p>
      <p className="pull-quote">Cumprir a exigência é uma coisa. Criar aprendizagem real é outra.</p>
      </div>
      <div className="reveal">
      <div className="problem-list">
      <details open>
      <summary>
      <span className="detail-no">01</span>O currículo precisa de progressão.</summary>
      <p>A rede precisa organizar o que ensinar em cada etapa, do 1º ano do Ensino Fundamental à 3ª série do Ensino Médio.</p>
      </details>
      <details>
      <summary>
      <span className="detail-no">02</span>O estudante já vive no digital.</summary>
      <p>Feeds, vídeos, chats, jogos e IA fazem parte da rotina. Algoritmos influenciam o que os estudantes veem, consomem e acreditam. Desinformação, golpes, exposição de dados, conflitos online e uso pouco crítico da IA já fazem parte dessa realidade.</p>
      </details>
      <details>
      <summary>
      <span className="detail-no">03</span>O professor não foi formado para isso.</summary>
      <p>Nem para ensinar esses temas, nem para incorporar a IA às aulas de forma crítica e pedagógica. E não há tempo de sobra para pesquisar, planejar e construir tudo sozinho.</p>
      </details>
      <details>
      <summary>
      <span className="detail-no">04</span>A infraestrutura ainda limita.</summary>
      <p>A conectividade e a disponibilidade de dispositivos variam entre as escolas e até dentro de uma mesma rede. Uma solução que depende de acesso pleno à tecnologia pode limitar o engajamento e ampliar desigualdades entre os estudantes.</p>
      </details>
      <details>
      <summary>
      <span className="detail-no">05</span>E existe fadiga de plataformas.</summary>
      <p>As escolas já convivem com diferentes sistemas e ferramentas digitais. Quando uma nova plataforma adiciona trabalho, não se conecta ao currículo ou não engaja o estudante, tende a ser abandonada. O resultado é conhecido: mais uma licença comprada e pouco utilizada.</p>
      </details>
      </div>
      <p className="problem-tail">Educação Digital e Midiática precisa deixar de ser palestra, campanha ou ação isolada e ganhar progressão, prática e acompanhamento.</p>
      </div>
      </div>
      </div>
      </section>

      <section className="section soft" id="resposta" aria-labelledby="response-title">
      <div className="container">
      <div className="section-top">
      <div className="eyebrow">
      <span className="num">03 / 09</span> Nossa resposta</div>
      <span className="section-name">Um programa. Diferentes perspectivas.</span>
      </div>
      <div className="reveal">
      <h2 id="response-title" className="section-heading">Uma solução completa para fazer Educação Digital e Midiática acontecer na escola real.</h2>
      <p className="lead section-description">O ENTRE REDES integra currículo, experiências digitais, apoio ao professor e implementação em uma única solução educacional.</p>
      </div>
      <div className="vertical-panels">

      <div role="region" id="benefit-panel-0" aria-labelledby="benefit-heading-0" className="benefit-panel">
      <div className="benefit-number" aria-hidden="true">01</div>
      <div>
      <span className="mobile-panel-label">Estudante</span>
      <h3 id="benefit-heading-0">O estudante não assiste ao digital.<br /> Ele vive a experiência.</h3>
      <p>Missões imersivas colocam o estudante diante de situações que fazem parte da sua vida: IA, algoritmos, redes sociais, desinformação, privacidade e escolhas digitais.</p>
      </div>
      </div>
      <div role="region" id="benefit-panel-1" aria-labelledby="benefit-heading-1" className="benefit-panel">
      <div className="benefit-number" aria-hidden="true">02</div>
      <div>
      <span className="mobile-panel-label">Professor</span>
      <h3 id="benefit-heading-1">Menos trabalho para o professor.<br /> Mais tempo para ensinar.</h3>
      <p>O professor recebe a jornada pronta e conta com IA para apoiar planejamento, preparação e atividades do dia a dia.</p>
      </div>
      </div>
      <div role="region" id="benefit-panel-2" aria-labelledby="benefit-heading-2" className="benefit-panel">
      <div className="benefit-number" aria-hidden="true">03</div>
      <div>
      <span className="mobile-panel-label">Gestão</span>
      <h3 id="benefit-heading-2">Uma nova aprendizagem.<br /> Sem precisar inventar uma nova escola.</h3>
      <p>O modelo pedagógico foi desenhado para integrar Educação Digital e Midiática à grade e à rotina que a escola já tem.</p>
      </div>
      </div>
      <div role="region" id="benefit-panel-3" aria-labelledby="benefit-heading-3" className="benefit-panel">
      <div className="benefit-number" aria-hidden="true">04</div>
      <div>
      <span className="mobile-panel-label">SAEB</span>
      <h3 id="benefit-heading-3">Competências para a vida digital que também potencializam habilidades avaliadas pelo SAEB.</h3>
      <p>As missões desenvolvem competências digitais enquanto mobilizam leitura, interpretação, argumentação, resolução de problemas e pensamento crítico.</p>
      </div>
      </div>
      </div>
      </div>
      </section>

      <section className="section ecosystem" id="metodo" aria-labelledby="ecosystem-title">
      <div className="container">
      <div className="section-top">
      <div className="eyebrow"><span className="num">04 / 09</span> O método</div>
      </div>
      <div className="ecosystem-intro reveal" id="ecossistema">
      <h2 id="ecosystem-title">Um <mark>ecossistema,</mark><br /> não uma soma de peças.</h2>
      <p className="lead">Conteúdo, experiência, apoio docente e gestão foram desenhados juntos. Cada parte prepara a seguinte e transforma Educação Digital e Midiática em uma jornada única, do planejamento à evidência de aprendizagem.</p>
      </div>
      <div className="ecosystem-grid reveal">
      <article className="ecosystem-card">
      <span>01 · Construir repertório</span>
      <h3>Materiais do estudante</h3>
      <p>Livro impresso e digital, além de uma narrativa literária que conecta os temas ao longo do ano.</p>
      </article>
      <article className="ecosystem-card">
      <span>02 · Viver e decidir</span>
      <h3>Missões Digitais</h3>
      <p>Simulações seguras com IA, feeds, chats, buscas e sistemas para tornar conceitos visíveis.</p>
      </article>
      <article className="ecosystem-card">
      <span>03 · Mediar e adaptar</span>
      <h3>Professor apoiado</h3>
      <p>Guia, plataforma, formação e Assistente AI para preparar, aplicar e fechar cada ciclo.</p>
      </article>
      <article className="ecosystem-card">
      <span>04 · Acompanhar</span>
      <h3>Gestão da rede</h3>
      <p>Painel, suporte e indicadores para enxergar a implementação e agir durante o percurso.</p>
      </article>
      </div>
      <div className="ecosystem-difference reveal">
      <strong>Por que é diferente?</strong>
      <p>A rede não precisa articular materiais, tecnologia, formação e acompanhamento em iniciativas separadas. Tudo faz parte da mesma solução, segue uma única lógica pedagógica e se integra à rotina escolar.</p>
      </div>
      </div>
      </section>

      <section className="section method-cycle" id="ciclo" aria-labelledby="method-title">
      <div className="container">
      <div className="section-top">
      <div className="eyebrow">
      Método · O ciclo por unidade</div>
      <span className="section-name">Um ciclo por unidade conectado ao percurso do ano</span>
      </div>
      <div className="method-heading reveal">
      <h2 id="method-title">Quatro unidades. Quatro ciclos.<br /> <span className="emphasis">Um método que se repete.</span></h2>
      <p className="lead">A escola não precisa criar uma nova dinâmica a cada unidade. O percurso mantém uma lógica clara para o professor e evolui de forma progressiva para o estudante.</p>
      </div>
      <div className="vertical-panels">

      <div className="method-panel" role="region" id="method-panel-0" aria-labelledby="method-heading-0">
      <div>
      <span className="mobile-panel-label">01 · Repertório</span>
      <h3 id="method-heading-0">Construir repertório.</h3>
      <p>O livro desenvolve conceitos, leituras, discussões e produções.</p>
      </div>
      <div className="method-note">
      <strong>Ao longo da unidade</strong>O material didático constrói e amplia o repertório do estudante.</div>
      </div>
      <div className="method-panel" role="region" id="method-panel-1" aria-labelledby="method-heading-1">
      <div>
      <span className="mobile-panel-label">02 · Missão Digital</span>
      <h3 id="method-heading-1">Viver a experiência.</h3>
      <p>Em cerca de 50 minutos, o estudante vive uma situação e precisa decidir.</p>
      </div>
      <div className="method-note">
      <strong>Uma Missão Digital por unidade</strong>A Missão Digital coloca o conhecimento em uma situação prática.</div>
      </div>
      <div className="method-panel" role="region" id="method-panel-2" aria-labelledby="method-heading-2">
      <div>
      <span className="mobile-panel-label">03 · Mediação</span>
      <h3 id="method-heading-2">Conectar experiência e conceito.</h3>
      <p>O professor conecta a experiência ao conceito e provoca reflexão.</p>
      </div>
      <div className="method-note">
      <strong>Professor como mediador</strong>Mediar, provocar e conectar a experiência à aprendizagem.</div>
      </div>
      <div className="method-panel" role="region" id="method-panel-3" aria-labelledby="method-heading-3">
      <div>
      <span className="mobile-panel-label">04 · Evidência</span>
      <h3 id="method-heading-3">Tornar a aprendizagem visível.</h3>
      <p>Decisões, produções ou reflexões viram registros de aprendizagem.</p>
      </div>
      <div className="method-note">
      <strong>Acompanhamento do percurso</strong>A produção do estudante vira evidência.</div>
      </div>
      </div>
      </div>
      </section>

      <section className="section dark" id="missoes" aria-labelledby="mission-title">
      <div className="container">
      <div className="section-top">
      <div className="eyebrow">
      <span className="num">05 / 09</span> As missões</div>
      <span className="section-name">Decisões. Consequências. Aprendizagem.</span>
      </div>
      <div className="mission-intro reveal">
      <h2 id="mission-title">Missões são experiências digitais em que o estudante <span className="accent">aprende decidindo.</span>
      </h2>
      <p className="lead">Em cerca de 50 minutos, a turma vivencia uma situação inspirada no mundo digital, investiga informações, faz escolhas e acompanha suas consequências. Depois, o professor conduz a reflexão, consolida os conceitos e ajuda os estudantes a transformar a experiência em critérios para a vida real.</p>
      </div>
      <figure className="infinity-stage infinity-interlude" aria-label="O infinito da Unooria formado por pontos de luz">
      <canvas className="infinity-canvas" id="brand-infinity" role="button" tabIndex={0} aria-label="Arraste para girar o infinito de estrelas. Toque ou pressione Enter para refazer. Use as setas para girar e Home para centralizar."></canvas>
      <div className="infinity-controls">
      <button id="infinity-replay" aria-label="Rever a formação do infinito" title="Rever a formação">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5v5h5L7.6 7.6A6 6 0 1 1 6 12H4a8 8 0 1 0 2.2-5.5L5 5Z" /></svg>
      </button>
      <button id="infinity-pause" aria-label="Pausar animação do infinito" aria-pressed="false" title="Pausar animação">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z" /></svg>
      </button>
      </div>
      </figure>
      <div className="mission-layout">
      <div className="reveal">
      <div className="mission-flow">
      <div>
      <b>01</b>
      <h3>Contexto</h3>
      <p>Uma situação próxima da vida digital desperta curiosidade e propósito.</p>
      </div>
      <div>
      <b>02</b>
      <h3>Decisão</h3>
      <p>O estudante investiga sinais, testa hipóteses e precisa escolher.</p>
      </div>
      <div>
      <b>03</b>
      <h3>Consequência</h3>
      <p>O ambiente responde e torna visível o efeito de cada decisão.</p>
      </div>
      <div>
      <b>04</b>
      <h3>Mediação</h3>
      <p>O professor conecta o que aconteceu ao conteúdo e à vida real.</p>
      </div>
      </div>
      <p className="mission-why">
      <strong>Por que potencializa a aprendizagem?</strong> Porque o conteúdo deixa de ser abstrato: o estudante mobiliza conhecimento, argumenta e revê escolhas em uma experiência que pode ser discutida pela turma.</p>
      </div>
      <figure className="mission-print portrait-print reveal">
      <div className="print-heading">
      <span>InstaNooria</span>
      <span className="print-kind">Feed simulado</span>
      </div>
      <button className="print-open" data-print="" data-title="InstaNooria · Feed simulado" aria-label="Ampliar print da missão InstaNooria" aria-haspopup="dialog">
      <img src="/site/assets/f5765ff402c3b4a4.png" width="381" height="822" loading="lazy" alt="Print do InstaNooria: publicação de defesa.popular sobre a Revolução Francesa, curtida e salva pelo estudante" />
      <span className="print-zoom-label">Ampliar imagem <span aria-hidden="true">↗︎</span>
      </span>
      </button>
      <figcaption>O estudante não assiste ao digital. Ele vive a experiência.</figcaption>
      </figure>
      </div>
      <figure className="mission-print landscape-print reveal">
      <div className="print-heading">
      <div>
      <span>UnooGPT · Missão Tempestade</span>
      <p>O estudante entra em uma situação digital simulada.</p>
      </div>
      <span className="print-kind">Decisões e consequências</span>
      </div>
      <button className="print-open" data-print="" data-title="UnooGPT · Missão Tempestade" aria-label="Ampliar print da missão Tempestade no UnooGPT" aria-haspopup="dialog">
      <img src="/site/assets/3bbc897c3c2f8a47.png" width="1872" height="877" loading="lazy" alt="Print da missão Tempestade no UnooGPT: quatro bairros em risco, duas equipes e uma decisão sobre para onde enviar ajuda" />
      <span className="print-zoom-label">Ampliar imagem <span aria-hidden="true">↗︎</span>
      </span>
      </button>
      <figcaption>Quatro bairros em risco. Duas equipes. O Cientista de Dados apoia a investigação — quem decide é o estudante.</figcaption>
      </figure>
      <div className="mission-bottom reveal">
      <div>
      <h3>Ambiente fechado, seguro e curado.</h3>
      <p>A tecnologia é usada para dar concretude aos conceitos; o professor continua responsável pela mediação e pelo fechamento pedagógico.</p>
      </div>
      <div>
      <h3>Plugado quando a experiência digital agrega.</h3>
      <p>Simulações, feeds, mensagens, buscas, dados e IA entram quando tornam o conceito visível e experiencial.</p>
      </div>
      <div>
      <h3>Desplugado para não depender da infraestrutura.</h3>
      <p>Uso coletivo, poucos dispositivos e alternativas equivalentes para contextos de baixa conectividade.</p>
      </div>
      </div>
      </div>
      </section>

      <section className="section" id="gestao" aria-labelledby="manager-title">
      <div className="container">
      <div className="section-top">
      <div className="eyebrow">
      <span className="num">06 / 09</span> Gestão e implementação</div>
      <span className="section-name">Da preparação às evidências</span>
      </div>
      <div className="manager-heading reveal">
      <h2 id="manager-title">A rede começa com o que já tem.<br /> <span className="emphasis">O ENTRE REDES organiza o restante.</span></h2>
      <p className="lead">O ENTRE REDES entra na grade e na rotina existente. A implementação reúne planejamento, materiais, formação, suporte e acompanhamento em um único processo.</p>
      </div>
      <h3 className="deploy-title reveal">Três movimentos para a solução virar rotina.</h3>
      <div className="deploy reveal">
      <div className="deploy-item">
      <span>01</span>
      <h3>Preparar</h3>
      <p>Entendemos calendário, infraestrutura e prioridades da rede. Organizamos acessos, materiais e formação inicial.</p>
      </div>
      <div className="deploy-item">
      <span>02</span>
      <h3>Aplicar</h3>
      <p>O professor recebe cada ciclo pronto: repertório, Missão Digital, orientações de mediação e fechamento.</p>
      </div>
      <div className="deploy-item">
      <span>03</span>
      <h3>Acompanhar</h3>
      <p>Suporte contínuo e indicadores mostram onde a aplicação avança e onde a rede precisa agir.</p>
      </div>
      </div>
      <div className="indicators reveal">
      <h3>A gestão acompanha<br /> apenas o que importa.</h3>
      <div className="indicator-list">
      <div>
      <h4>Implementação</h4>
      <p>Escolas e turmas que avançaram em cada etapa.</p>
      </div>
      <div>
      <h4>Participação</h4>
      <p>Adesão dos estudantes às atividades e às missões.</p>
      </div>
      <div>
      <h4>Evidências</h4>
      <p>Produções, decisões e competências mobilizadas no percurso.</p>
      </div>
      </div>
      </div>
      <p className="manager-note">Sem projetos paralelos e sem exigir uma nova infraestrutura: o programa se adapta ao contexto da rede, inclusive com alternativas para poucos dispositivos e baixa conectividade.</p>
      </div>
      </section>

      <section className="section soft" id="curriculo" aria-labelledby="curriculum-title">
      <div className="container">
      <div className="section-top">
      <div className="eyebrow">
      <span className="num">07 / 09</span> Currículo e progressão</div>
      <span className="section-name">Do 1º EF ao 3º EM</span>
      </div>
      <div className="curriculum-top reveal">
      <h2 id="curriculum-title">Uma jornada que cresce com o estudante.</h2>
      <div className="stats">
      <div>
      <strong>12</strong>
      <span>anos escolares</span>
      </div>
      <div>
      <strong>4</strong>
      <span>missões por ano</span>
      </div>
      <div>
      <strong>48</strong>
      <span>missões na jornada</span>
      </div>
      </div>
      </div>
      <p className="curriculum-lead reveal">Progressão contínua, não uma coleção de temas soltos.</p>
      <div className="curriculum-cards" aria-label="As três jornadas de aprendizagem">
      <article className="curriculum-panel" id="stage-panel-0" aria-labelledby="stage-title-0">
      <div>
      <h3 className="stage-title" id="stage-title-0">Anos Iniciais</h3>
      <div className="age">1º ao 5º ano · Ensino Fundamental</div>
      <h4>Entender, verificar,<br /> proteger e produzir.</h4>
      <p>O estudante começa a ler criticamente o que vê, reconhecer sinais de confiabilidade, proteger dados e criar com responsabilidade. Primeiros critérios para viver no digital.</p>
      </div>
      <div className="stage-aside">
      <strong>Mais concreto. Mais guiado.</strong>
      </div>
      <figure className="progression" data-progression="initial" aria-label="Progressão pedagógica real dos Anos Iniciais">
      <button type="button" className="progression-art" data-print="" data-title="Jornada de aprendizagem · Anos Iniciais" aria-label="Ampliar a progressão dos Anos Iniciais" aria-haspopup="dialog">
      <img src="/site/assets/jornada-anos-iniciais.webp" width="935" height="1683" alt="Progressão pedagógica real: entender o que vê, verificar antes de acreditar, proteger-se e produzir com responsabilidade, com missões guiadas e simulações seguras." loading="lazy" decoding="async" />
      <span className="progression-zoom" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5M7.5 10.5h6m-3-3v6" /></svg></span>
      </button>
      </figure>
      </article>
      <article className="curriculum-panel" id="stage-panel-1" aria-labelledby="stage-title-1">
      <div>
      <h3 className="stage-title" id="stage-title-1">Anos Finais</h3>
      <div className="age">6º ao 9º ano · Ensino Fundamental</div>
      <h4>Ler a plataforma<br /> e questionar o sistema.</h4>
      <p>O estudante passa a analisar plataformas, algoritmos, dados, desinformação e IA, questionando regras e consequências. Mais autonomia e leitura crítica.</p>
      </div>
      <div className="stage-aside">
      <strong>Mais crítico. Mais sistêmico.</strong>
      </div>
      <figure className="progression" data-progression="final" aria-label="Progressão pedagógica real dos Anos Finais">
      <button type="button" className="progression-art" data-print="" data-title="Jornada de aprendizagem · Anos Finais" aria-label="Ampliar a progressão dos Anos Finais" aria-haspopup="dialog">
      <img src="/site/assets/533fde8478eb99dd.webp" width="935" height="1683" alt="Progressão pedagógica real: ler a plataforma criticamente, entender algoritmos e dados, investigar desinformação e IA e posicionar-se com evidências." loading="lazy" decoding="async" />
      <span className="progression-zoom" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5M7.5 10.5h6m-3-3v6" /></svg></span>
      </button>
      </figure>
      </article>
      <article className="curriculum-panel" id="stage-panel-2" aria-labelledby="stage-title-2">
      <div>
      <h3 className="stage-title" id="stage-title-2">Ensino Médio</h3>
      <div className="age">1ª a 3ª série - Ensino Médio</div>
      <h4>Posicionar-se, criar<br /> e avaliar impacto.</h4>
      <p>O estudante aprofunda identidade digital, sistemas automatizados, transparência, autoria e impacto social das próprias escolhas. Critério, posicionamento e impacto.</p>
      </div>
      <div className="stage-aside">
      <strong>Mais autoral. Mais consciente.</strong>
      </div>
      <figure className="progression" data-progression="high" aria-label="Progressão pedagógica real do Ensino Médio">
      <button type="button" className="progression-art" data-print="" data-title="Jornada de aprendizagem · Ensino Médio" aria-label="Ampliar a progressão do Ensino Médio" aria-haspopup="dialog">
      <img src="/site/assets/1e12b88a8d3d1c0a.webp" width="935" height="1683" alt="Progressão pedagógica real: identidade digital crítica, sistemas e decisões, informação e transparência, autoria e impacto, com portfólio vivo e diário de decisões." loading="lazy" decoding="async" />
      <span className="progression-zoom" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5M7.5 10.5h6m-3-3v6" /></svg></span>
      </button>
      </figure>
      </article>
      </div>
      <details className="pillars reveal">
      <summary>Oito territórios que atravessam a jornada.</summary>
      <ul className="pillars-grid">
      <li>
      <span>01</span>Informação e Educação Midiática</li>
      <li>
      <span>02</span>Privacidade e Dados</li>
      <li>
      <span>03</span>Segurança e Golpes</li>
      <li>
      <span>04</span>Convivência e Cidadania Digital</li>
      <li>
      <span>05</span>Autoria e Publicação</li>
      <li>
      <span>06</span>Algoritmos e Recomendação</li>
      <li>
      <span>07</span>Inteligência Artificial</li>
      <li>
      <span>08</span>Bem-estar e Uso Responsável</li>
      </ul>
      <p style={{ paddingLeft: "0" }}>Os temas retornam ao longo dos anos com profundidade crescente e linguagem adequada à idade.</p>
      </details>
      </div>
      </section>

      <section className="section" id="docentes" aria-labelledby="teacher-title">
      <div className="container">
      <div className="section-top">
      <div className="eyebrow">
      <span className="num">08 / 09</span> Docentes</div>
      <span className="section-name">O papel do professor</span>
      </div>
      <div className="teacher-lead reveal">
      <h2 className="section-heading" id="teacher-title">A tecnologia entra para<br /> <span className="emphasis">tirar peso do professor.</span></h2>
      <p className="teacher-intro">O professor não precisa ser especialista em tecnologia. O ENTRE REDES traz a complexidade pedagógica e tecnológica para dentro do produto; o docente entra com o que faz melhor: conhecer a turma, provocar reflexão e mediar a aprendizagem.</p>
      </div>
      <div className="teacher-role-grid reveal">
      <article><span>01</span><h3>Conhecer a turma</h3><p>Adaptar a condução à realidade, ao repertório e às necessidades dos estudantes.</p></article>
      <article><span>02</span><h3>Provocar reflexão</h3><p>Fazer perguntas, comparar caminhos e tornar visíveis as consequências de cada escolha.</p></article>
      <article><span>03</span><h3>Mediar a aprendizagem</h3><p>Conectar a experiência digital aos conceitos e critérios que permanecem para a vida.</p></article>
      </div>
      <p className="teacher-role reveal">As missões não tiram o professor de cena. Elas criam uma situação rica para transformar experiência em critério.</p>
      </div>
      </section>

      <section className="section teacher-support-section" id="apoio-docente" aria-labelledby="teacher-support-title">
      <div className="container">
      <div className="section-top">
      <div className="eyebrow">Docentes · Apoio à prática</div>
      </div>
      <div className="teacher-support-heading reveal">
      <h2 id="teacher-support-title">Tudo para preparar, aplicar<br /> <span className="emphasis">e aprofundar a aula.</span></h2>
      <p className="lead">Formação, materiais, inteligência artificial e suporte pedagógico acompanham o professor antes, durante e depois de cada missão.</p>
      </div>
      <div className="teacher-support-grid reveal">
      <article>
      <span>01 · Formação contínua</span>
      <h3>Preparar antes. Apoiar durante. Aprofundar ao longo do ano.</h3>
      <p>Oficina inicial, trilha on-line e Boletins AI + aprofundamentos ampliam o repertório digital, midiático e de IA para o cotidiano profissional.</p>
      </article>
      <article>
      <span>02 · Assistente AI</span>
      <h3>Menos tempo procurando como fazer.</h3>
      <p>Apoio ao planejamento, à adaptação de atividades, à mediação e à prática pedagógica para o professor decidir o que faz sentido para a turma.</p>
      </article>
      <article>
      <span>03 · Materiais do professor</span>
      <h3>O passo a passo da aula já está pronto.</h3>
      <p>Guia do Professor, Guia das Missões e Plataforma do Professor reúnem fundamentação, objetivos, tempo estimado, adaptações e avaliação.</p>
      </article>
      <article>
      <span>04 · Suporte pedagógico</span>
      <h3>O apoio continua depois da formação.</h3>
      <p>Dúvidas sobre conteúdo, mediação, situações sensíveis e adaptação de atividades recebem acompanhamento ao longo de todo o percurso.</p>
      </article>
      </div>
      <div className="teacher-ai-example reveal">
      <span>Exemplos de apoio do Assistente AI</span>
      <p>“Como adapto esta atividade para uma sala com menos computadores?”</p>
      <p>“Que perguntas posso fazer depois da missão para aprofundar a discussão?”</p>
      </div>
      </div>
      </section>

      <section className="section dark" id="familias" aria-labelledby="family-title">
      <div className="container">
      <div className="section-top">
      <div className="eyebrow">
      <span className="num">09 / 09</span> Famílias · Escola e casa</div>
      <span className="section-name">Uma linguagem comum</span>
      </div>
      <div className="family-layout">
      <div className="reveal">
      <h2 id="family-title">A aprendizagem continua depois que a aula termina.</h2>
      <p className="lead">Os desafios digitais aparecem em casa, nos jogos, vídeos, mensagens, redes e ferramentas de IA.</p>
      <div className="family-role">
      <strong>Apoiar a conversa, não assumir a responsabilidade de ensinar o currículo.</strong>A família não vira professora. Ganha repertório para conversar, reconhecer riscos e continuar reflexões. A responsabilidade pedagógica continua com a escola.</div>
      </div>
      </div>
      <h3 className="deploy-title reveal">Materiais simples para levar a conversa para casa.</h3>
      <div className="family-steps reveal">
      <div>
      <span>01</span>
      <h3>Entender</h3>
      <p>O que está sendo trabalhado em sala e por que aquele tema importa.</p>
      </div>
      <div>
      <span>02</span>
      <h3>Conversar</h3>
      <p>Como abrir diálogos sobre desafios digitais sem transformar tudo em proibição.</p>
      </div>
      <div>
      <span>03</span>
      <h3>Reconhecer</h3>
      <p>Riscos e situações que exigem atenção de adultos e da escola.</p>
      </div>
      <div>
      <span>04</span>
      <h3>Continuar</h3>
      <p>Reflexões iniciadas na escola em situações reais da rotina familiar.</p>
      </div>
      </div>
      <p className="final-quote reveal">O conteúdo deixa de ser algo que o estudante apenas sabe.<br />
      <span>Vira repertório para agir.</span>
      </p>
      </div>
      </section>
      <section className="section closing-cta" id="contato" aria-labelledby="closing-title">
      <div className="container closing-grid">
      <h2 id="closing-title">Sua rede já tem o desafio.<br />
      <span>O ENTRE REDES entrega o caminho.</span>
      </h2>
      <div className="closing-side">
      <p>Uma solução completa para transformar a prioridade de Educação Digital e Midiática em aprendizagem real, com implantação simples e acompanhamento contínuo.</p>
      <button className="button light" type="button" aria-haspopup="dialog" aria-controls="cadastro-dialog" data-abrir-cadastro="">{ROTULO_DO_CONVITE} <span className="arrow" aria-hidden="true">→</span>
      </button>
      </div>
      </div>
      </section>
      <section className="section registration" id="cadastro" aria-labelledby="registration-title">
      <div className="container registration-grid">
      <div className="registration-copy reveal">
      <div className="eyebrow">Cadastro de interesse</div>
      <h2 id="registration-title">Vamos conversar sobre a sua rede de ensino.</h2>
      <p>Preencha os dados para receber uma apresentação do ENTRE REDES e entender como a solução pode contribuir com a sua rede.</p>
      </div>
      <CadastroDeInteresse />
      </div>
      </section>
      </main>
      <footer className="footer">
      <div className="container">
      <a className="footer-brand" href="#inicio" aria-label="Unooria — voltar ao início">
      <img src="/site/assets/c391a425254523c1.webp" width="600" height="129" alt="Unooria" loading="lazy" />
      </a>
      <div className="footer-note">ENTRE REDES · Educação Digital e Midiática · © 2026 Unooria</div>
      <button id="back-top">Voltar ao início <span className="arrow" aria-hidden="true">↑</span>
      </button>
      </div>
      </footer>
      <dialog id="index-dialog" className="index-dialog" aria-labelledby="index-title">
      <div className="dialog-top">
      <span className="eyebrow" id="index-title">Explore o ENTRE REDES</span>
      <button className="close-button" data-close="" aria-label="Fechar navegação">×</button>
      </div>
      <nav className="index-links" aria-label="Índice completo">
      <a href="#inicio">
      <span>01</span>O programa <span className="arrow" aria-hidden="true">↗︎</span>
      </a>
      <a href="#desafio">
      <span>02</span>O desafio <span className="arrow" aria-hidden="true">↗︎</span>
      </a>
      <a href="#resposta">
      <span>03</span>Nossa resposta <span className="arrow" aria-hidden="true">↗︎</span>
      </a>
      <a href="#metodo">
      <span>04</span>O método <span className="arrow" aria-hidden="true">↗︎</span>
      </a>
      <a className="index-sub" href="#ecossistema">O ecossistema <span className="arrow" aria-hidden="true">↗︎</span></a>
      <a href="#missoes">
      <span>05</span>As missões <span className="arrow" aria-hidden="true">↗︎</span>
      </a>
      <a href="#gestao">
      <span>06</span>Gestão e implementação <span className="arrow" aria-hidden="true">↗︎</span>
      </a>
      <a href="#curriculo">
      <span>07</span>Currículo e progressão <span className="arrow" aria-hidden="true">↗︎</span>
      </a>
      <a href="#docentes">
      <span>08</span>Docentes <span className="arrow" aria-hidden="true">↗︎</span>
      </a>
      <a className="index-sub" href="#apoio-docente">Apoio ao professor <span className="arrow" aria-hidden="true">↗︎</span></a>
      <a href="#familias">
      <span>09</span>Famílias <span className="arrow" aria-hidden="true">↗︎</span>
      </a>
      </nav>
      </dialog>
      <dialog id="print-dialog" className="print-dialog" aria-labelledby="print-title">
      <div className="dialog-top">
      <h3 id="print-title">Missão digital</h3>
      <button className="close-button" data-close="" aria-label="Fechar imagem ampliada">×</button>
      </div>
      <div className="print-toolbar">
      <button id="print-zoom" aria-pressed="false">Ver tamanho original</button>
      <span id="print-help">Você também pode usar o gesto de pinça para ampliar.</span>
      </div>
      <div className="image-viewport" tabIndex={0} role="region" aria-label="Imagem ampliada">
      <img id="print-image" alt="" />
      </div>
      </dialog>







    </PalcoDoSite>
  );
}
