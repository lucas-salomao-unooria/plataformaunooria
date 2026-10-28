import "./site.css";

import { ConviteDoCadastro, JanelaDoCadastro, ProvedorDoCadastro } from "./formulario-de-cadastro";
import { PalcoDoSite } from "./palco-do-site";

/**
 * O SITE PÚBLICO — ENTRE REDES (ADR-107).
 *
 * É a raiz (`/`) para quem chega sem sessão. A marcação abaixo é o porte 1:1
 * da VERSÃO FINAL do material (`entre-redes-site-final.html`, 2026-10-28):
 * mesma árvore, mesmas classes, mesmos ids, mesma ordem — porque é o
 * `site.css`, copiado camada por camada, que a estiliza, e ele casa por classe
 * e por id. Trocar um `div` por um `section`, agrupar dois irmãos ou "limpar"
 * uma classe aparece como defeito de layout, não como refatoração.
 *
 * O que mudou em relação ao pacote, e só isto:
 *  - a janela do cadastro é a NOSSA (`JanelaDoCadastro`), que posta na api; a
 *    do pacote era uma prévia que não enviava nada. O convite do fechamento
 *    (`ConviteDoCadastro`) a abre e, depois do envio, vira a confirmação;
 *  - os `<script>` viraram `efeitos/`, montados pelo `PalcoDoSite`;
 *  - dois ACRÉSCIMOS marcados que o pacote não traz: o "Entrar" do cabeçalho e
 *    os links legais do rodapé (H11.1.2).
 *
 * O QUE NÃO SE APLICA AQUI: o design system. O DS vale da porta do login para
 * dentro; esta é a superfície de marketing, e ela tem tipografia, paleta e
 * movimento próprios (ver `site.css`).
 *
 * `<img>` cru, e não `next/image`: o logo do RODAPÉ é lido PIXEL A PIXEL pelo
 * `efeitos/infinito.ts` para formar o infinito de estrelas, e as páginas dos
 * livros são relidas pelo `efeitos/paginas-do-livro.ts` pelo `src`. O
 * `next/image` serviria outro arquivo, em outro formato e outro tamanho.
 */
export function SiteEntreRedes() {
  return (
    <PalcoDoSite>
    <ProvedorDoCadastro>
      <svg className="brand-filter" xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
      <filter id="brand-on-navy" colorInterpolationFilters="sRGB">
      <feColorMatrix type="matrix" values="0 0 0 0 .88 0 0 0 0 .90 0 0 0 0 .96 .4252 1.4304 .1444 0 -.25" />
      </filter>
      </defs>
      </svg>
      <a className="skip" href="#inicio">Ir para o conteúdo</a>
      <header className="header">
      <div className="head-inner">
      <a className="brand entre-redes-brand" href="#inicio" aria-label="Entre Redes — início">
      <img src="/site/assets/entre-redes-marca.svg" width="897" height="744" alt="Entre Redes" />
      </a>
      <span className="brand-label">Educação Digital e Midiática</span>
      <nav className="main-nav" aria-label="Navegação principal">
      <a href="#proposito">Propósito</a>
      <a href="#desafio">Problema</a>
      <a href="#resposta">Como resolvemos</a>
      <a href="#missoes">Missões</a>
      <a href="#docentes">Docentes</a>
      </nav>
      {/* ACRÉSCIMO ao porte (H11.1.2): quem chega pelo site e já tem conta
          entra daqui, sem saber o endereço da tela de entrada. `<a>` e não
          `next/link`, como o resto da marcação 1:1. */}
      <a className="header-entrar" href="/login">Entrar</a>
      <button className="menu-button" id="menu-open" aria-expanded="false" aria-label="Abrir navegação" aria-haspopup="dialog" aria-controls="index-dialog">
      <span className="menu-label">Explorar</span> <span className="menu-symbol" aria-hidden="true">
      </span>
      </button>
      </div>
      <div className="progress" aria-hidden="true">
      </div>
      </header>
      <nav className="chapter-rail" aria-label="Seções do site">
      <a href="#proposito" aria-label="01 — Propósito">
      <span>01 · Propósito</span>
      </a>
      <a href="#desafio" aria-label="02 — O problema">
      <span>02 · O problema</span>
      </a>
      <a href="#resposta" aria-label="03 — Como resolvemos">
      <span>03 · Como resolvemos</span>
      </a>
      <a href="#missoes" aria-label="04 — As missões · Plugado">
      <span>04 · As missões · Plugado</span>
      </a>
      <a href="#curriculo" aria-label="05 — Currículo e progressão">
      <span>05 · Currículo e progressão</span>
      </a>
      <a href="#docentes" aria-label="06 — Docentes">
      <span>06 · Docentes</span>
      </a>
      <a href="#familias" aria-label="07 — Famílias">
      <span>07 · Famílias</span>
      </a>
      <a href="#unooria" aria-label="08 — Sobre a Unooria">
      <span>08 · Sobre a Unooria</span>
      </a>
      </nav>
      <main id="main">
      <section className="section hero dark" id="inicio" aria-labelledby="hero-title">
      <div className="container">
      <div className="hero-opening hero-split">
      <div className="hero-copy">
      <h1 id="hero-title">
      <span className="hero-line">A vida mudou de tela.</span>
      <span className="hero-line">A educação precisa <span className="hero-accent">mudar de aula.</span>
      </span>
      </h1>
      <div className="hero-sub">
      <p>O ENTRE REDES une livros, missões digitais e apoio ao professor para redes e escolas, do 1º ano do Ensino Fundamental ao 3º do Ensino Médio.</p>
      </div>
      <div className="hero-actions">
      <a className="hero-link" href="#resposta">Ver como funciona <span aria-hidden="true">↓</span>
      </a>
      </div>
      </div>
      <figure className="hero-books" aria-label="Materiais Entre Redes">
      <img src="/site/assets/livro-pagina-ia.webp" alt="Página do livro Entre Redes sobre como a Inteligência Artificial aprende." className="hero-book hero-book--page" width="600" height="800" loading="eager" fetchPriority="high" decoding="async" />
      <img src="/site/assets/livro-capa-8-ano.webp" alt="Capa real do livro Entre Redes, 8º ano do Ensino Fundamental." className="hero-book hero-book--cover" width="600" height="800" loading="eager" fetchPriority="high" decoding="async" />
      </figure>
      </div>
      </div>
      </section>
      <section className="section focus-section purpose-section" id="proposito" aria-labelledby="proposito-title">
      <div className="container">
      <div className="section-top">
      <div className="eyebrow">Propósito</div>
      </div>
      <h2 id="proposito-title">Formar critérios para <span className="accent">compreender, conviver e decidir</span> no digital.</h2>
      <p className="purpose-sub">O conteúdo deixa de ser algo que o estudante apenas sabe e vira repertório para agir.</p>
      </div>
      </section>
      <section className="section focus-section problem-section" id="desafio" aria-labelledby="desafio-title">
      <div className="container">
      <div className="section-top">
      <div className="eyebrow">O problema</div>
      </div>
      <div className="topic-heading">
      <h2 id="desafio-title">
      <span className="h2-line">Os estudantes já vivem no digital.</span> <span className="h2-line accent">Falta um caminho para ensinar isso.</span>
      </h2>
      </div>
      <ol className="problem-list">
      <li>
      <span className="problem-num">01</span>
      <h3>Sem sequência.</h3>
      <p>A educação digital costuma chegar em ações isoladas, sem um caminho do 1º ano ao Ensino Médio.</p>
      </li>
      <li>
      <span className="problem-num">02</span>
      <h3>Sem apoio ao professor.</h3>
      <p>A expectativa existe, mas faltam material, formação e orientação para mediar.</p>
      </li>
      <li>
      <span className="problem-num">03</span>
      <h3>Sem lugar na rotina.</h3>
      <p>Sem encaixe no currículo, o tema disputa espaço com tudo e acaba ficando de fora.</p>
      </li>
      </ol>
      </div>
      </section>
      <section className="section focus-section solution-section" id="resposta" aria-labelledby="resposta-title">
      <div className="container">
      <div className="section-top">
      <div className="eyebrow">Como resolvemos</div>
      </div>
      <div className="topic-heading">
      <h2 id="resposta-title">Um ecossistema, <span className="accent">não uma soma de peças.</span>
      </h2>
      <p className="lead">O livro constrói repertório. A missão convida a agir. O professor conecta experiência e reflexão.</p>
      </div>
      <ol className="flow">
      <li>
      <span className="flow-kicker">01 · Construir repertório</span>
      <h3>Livros</h3>
      <p>Leituras e atividades para investigar e produzir.</p>
      <span className="flow-answer">
      <span aria-hidden="true">↳</span> Problema 01 · Sem sequência</span>
      </li>
      <li>
      <span className="flow-kicker">02 · Viver e decidir</span>
      <h3>Missões digitais</h3>
      <p>Simulações para aplicar o que foi aprendido.</p>
      <span className="flow-answer">
      <span aria-hidden="true">↳</span> Problema 01 · Sem sequência</span>
      </li>
      <li>
      <span className="flow-kicker">03 · Mediar e adaptar</span>
      <h3>Apoio docente</h3>
      <p>Orientação, formação e apoio à prática.</p>
      <span className="flow-answer">
      <span aria-hidden="true">↳</span> Problema 02 · Sem apoio ao professor</span>
      </li>
      <li>
      <span className="flow-kicker">04 · Acompanhar</span>
      <h3>Gestão da rede</h3>
      <p>Visão do percurso para acompanhar a aprendizagem.</p>
      <span className="flow-answer">
      <span aria-hidden="true">↳</span> Problema 03 · Sem lugar na rotina</span>
      </li>
      <li>
      <span className="flow-kicker">05 · O resultado</span>
      <h3>Do repertório à prática digital.</h3>
      <p>Leitura e resolução de problemas, na vida e no SAEB.</p>
      </li>
      </ol>
      </div>
      </section>
      <section className="section focus-section" id="livros" aria-labelledby="livros-title">
      <div className="container">
      <div className="section-top">
      <div className="eyebrow">Materiais do estudante · Desplugado</div>
      </div>
      <div className="topic-heading">
      <h2 id="livros-title">No livro, começa o <span className="accent">repertório.</span>
      </h2>
      </div>
      <p className="collection-facts">
      <span>
      <strong>12</strong> anos escolares</span>
      <span>
      <strong>4</strong> unidades por ano</span>
      <span>1º ao 9º EF | 1ª a 3ª EM</span>
      </p>
      <div className="book-overview">
      <article className="book-card">
      <button className="material-zoom" type="button" data-print="" data-title="Entre Redes · Exemplo de perguntar" aria-label="Ampliar: Entre Redes · Exemplo de perguntar" aria-haspopup="dialog">
      <img src="/site/assets/livro-perguntar.webp" alt="Entre Redes · Exemplo de perguntar" loading="lazy" decoding="async" />
      <span className="zoom-corner" aria-hidden="true">↗</span>
      </button>
      <div>
      <h3>Perguntar</h3>
      <p>Perguntas do cotidiano.</p>
      </div>
      </article>
      <article className="book-card">
      <button className="material-zoom" type="button" data-print="" data-title="Entre Redes · Exemplo de investigar" aria-label="Ampliar: Entre Redes · Exemplo de investigar" aria-haspopup="dialog">
      <img src="/site/assets/livro-investigar.webp" alt="Entre Redes · Exemplo de investigar" loading="lazy" decoding="async" />
      <span className="zoom-corner" aria-hidden="true">↗</span>
      </button>
      <div>
      <h3>Investigar</h3>
      <p>Leituras para compreender.</p>
      </div>
      </article>
      <article className="book-card">
      <button className="material-zoom" type="button" data-print="" data-title="Entre Redes · Exemplo de relacionar" aria-label="Ampliar: Entre Redes · Exemplo de relacionar" aria-haspopup="dialog">
      <img src="/site/assets/livro-relacionar.webp" alt="Entre Redes · Exemplo de relacionar" loading="lazy" decoding="async" />
      <span className="zoom-corner" aria-hidden="true">↗</span>
      </button>
      <div>
      <h3>Relacionar</h3>
      <p>Conceitos em situações reais.</p>
      </div>
      </article>
      <article className="book-card">
      <button className="material-zoom" type="button" data-print="" data-title="Entre Redes · Exemplo de compartilhar" aria-label="Ampliar: Entre Redes · Exemplo de compartilhar" aria-haspopup="dialog">
      <img src="/site/assets/livro-compartilhar.webp" alt="Entre Redes · Exemplo de compartilhar" loading="lazy" decoding="async" />
      <span className="zoom-corner" aria-hidden="true">↗</span>
      </button>
      <div>
      <h3>Compartilhar</h3>
      <p>Produzir, trocar e refletir.</p>
      </div>
      </article>
      </div>
      </div>
      </section>
      <section className="section restored-section dark" id="missoes" aria-labelledby="mission-title">
      <div className="container">
      <div className="section-top">
      <div className="eyebrow">
      <span className="num">04 / 08</span> As missões · Plugado</div>
      </div>
      <div className="mission-intro reveal">
      <h2 id="mission-title">Aprender <span className="accent">decidindo.</span>
      </h2>
      <p className="lead">Missões digitais colocam em prática o conhecimento construído no livro, em um ambiente fechado, seguro e curado.</p>
      </div>
      <div className="content-carousel" id="mission-carousel" data-carousel="" role="region" aria-roledescription="carrossel" aria-label="As missões" tabIndex={0}>
      <div className="carousel-slides">
      <article className="content-slide is-active" role="group" aria-roledescription="slide" aria-label="1 de 5" aria-hidden="false">
      <div className="slide-copy">
      <span className="slide-kicker">InstaNooria · Feed simulado</span>
      <h3>Ler além da postagem.</h3>
      <p>Um ambiente de publicações, curtidas e comentários. A turma analisa o que vê e como reage, construindo critérios para avaliar informações e participar das redes com responsabilidade.</p>
      <span className="slide-detail">Um feed conhecido. Um olhar mais crítico.</span>
      </div>
      <div className="slide-visual mw-visual">
      <div className="mw mw1" role="img" aria-label="Animação: um feed simulado com publicação, curtida e comentários. A turma passa por três etapas: o que vejo, como reajo e critério.">
      <div className="mw-win">
      <div className="mw-dots">
      <b>
      </b>
      <b>
      </b>
      <b>
      </b>
      </div>
      <div className="ph pa">
      <img src="/site/assets/missao-instanooria-publicacao.webp" alt="" width="381" height="822" />
      </div>
      <div className="ring">
      </div>
      <span className="hh">♥</span>
      <span className="hh hh2">♥</span>
      <span className="hh hh3">♥</span>
      <span className="ar ar1">›</span>
      <div className="chip c1">
      <i>
      <svg viewBox="0 0 24 24">
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
      </svg>
      </i>O que vejo</div>
      <div className="chip c2">
      <i>
      <svg viewBox="0 0 24 24">
      <path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
      </i>Como reajo</div>
      <div className="chip c3">
      <i>
      <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8 12.5l2.7 2.7L16 9.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      </i>Critério<b>
      <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8 12.5l2.7 2.7L16 9.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      </b>
      </div>
      <span className="ar ar2">›</span>
      <div className="ph pb">
      <img src="/site/assets/missao-instanooria-comentarios.webp" alt="" width="375" height="813" />
      </div>
      <p className="mw-title">Ler além da postagem</p>
      </div>
      <div className="mw-real">
      <button type="button" data-print="" data-title="InstaNooria · Publicação no feed" aria-label="Ampliar: InstaNooria · Publicação no feed" aria-haspopup="dialog">
      <img src="/site/assets/missao-instanooria-publicacao.webp" width="381" height="822" alt="InstaNooria · Publicação no feed" hidden />Publicação ↗</button>
      <button type="button" data-print="" data-title="InstaNooria · Comentários" aria-label="Ampliar: InstaNooria · Comentários" aria-haspopup="dialog">
      <img src="/site/assets/missao-instanooria-comentarios.webp" width="375" height="813" alt="InstaNooria · Comentários" hidden />Comentários ↗</button>
      </div>
      <div className="mw-av art-finais" style={{ backgroundSize: "321.4% auto", backgroundPosition: "19.76% 30.13%" }}>
      </div>
      </div>
      </div>
      </article>
      <article className="content-slide" role="group" aria-roledescription="slide" aria-label="2 de 5" aria-hidden="true" inert>
      <div className="slide-copy">
      <span className="slide-kicker">UnooTube · Vídeos curtos</span>
      <h3>Escolher o que merece atenção.</h3>
      <p>Um feed de vídeos com ações de curtir e salvar. Ao selecionar conteúdos, o estudante exercita critérios e percebe que popularidade e aparência não bastam para avaliar uma informação.</p>
      <span className="slide-detail">Escolhas conscientes diante do excesso de conteúdo.</span>
      </div>
      <div className="slide-visual mw-visual">
      <div className="mw mw2" role="img" aria-label="Animação: um feed de vídeos curtos. O estudante salva três favoritos, escolhendo por critério e não só pela popularidade.">
      <div className="mw-win">
      <div className="mw-dots">
      <b>
      </b>
      <b>
      </b>
      <b>
      </b>
      </div>
      <div className="tile t0" style={{ left: "14cqw", background: "linear-gradient(160deg,#6a4cff,#ff7ad9)" }}>
      </div>
      <div className="pop pop-0" style={{ left: "14cqw" }}>
      <i style={{ width: "75%" }}>
      </i>
      </div>
      <div className="tile t1" style={{ left: "25cqw", background: "linear-gradient(160deg,#ff8a3d,#ffd36b)" }}>
      </div>
      <div className="pop pop-1" style={{ left: "25cqw" }}>
      <i style={{ width: "100%" }}>
      </i>
      </div>
      <div className="tile t2" style={{ left: "36cqw", background: "linear-gradient(160deg,#2aa8ff,#46e0a0)" }}>
      </div>
      <div className="pop pop-2" style={{ left: "36cqw" }}>
      <i style={{ width: "40%" }}>
      </i>
      </div>
      <div className="tile t3" style={{ left: "47cqw", background: "linear-gradient(160deg,#a24cff,#4cc9ff)" }}>
      </div>
      <div className="pop pop-3" style={{ left: "47cqw" }}>
      <i style={{ width: "60%" }}>
      </i>
      </div>
      <span className="lab">popularidade</span>
      <div className="ring r0" style={{ left: "13.2cqw" }}>
      </div>
      <div className="sv s0" style={{ left: "14cqw" }}>≡+ Salvar</div>
      <div className="ring r1" style={{ left: "35.2cqw" }}>
      </div>
      <div className="sv s1" style={{ left: "36cqw" }}>≡+ Salvar</div>
      <div className="ring r2" style={{ left: "46.2cqw" }}>
      </div>
      <div className="sv s2" style={{ left: "47cqw" }}>≡+ Salvar</div>
      <div className="fav">
      <h4>Favoritos salvos</h4>
      <div className="cnt">
      <span className="c mw2-c0">0 de 3</span>
      <span className="c mw2-c1">1 de 3</span>
      <span className="c mw2-c2">2 de 3</span>
      <span className="c mw2-c3">3 de 3</span>
      </div>
      <div className="slot" style={{ left: "2.6cqw" }}>
      <div className="fill f0" style={{ background: "linear-gradient(160deg,#6a4cff,#ff7ad9)" }}>
      </div>
      <span className="ok ok0">✓</span>
      </div>
      <div className="slot" style={{ left: "10.6cqw" }}>
      <div className="fill f1" style={{ background: "linear-gradient(160deg,#2aa8ff,#46e0a0)" }}>
      </div>
      <span className="ok ok1">✓</span>
      </div>
      <div className="slot" style={{ left: "18.6cqw" }}>
      <div className="fill f2" style={{ background: "linear-gradient(160deg,#a24cff,#4cc9ff)" }}>
      </div>
      <span className="ok ok2">✓</span>
      </div>
      </div>
      <p className="msg">Pronto! Seus 3 favoritos estão escolhidos.</p>
      <p className="mw-title">Escolher o que merece atenção</p>
      </div>
      <div className="mw-real">
      <button type="button" data-print="" data-title="UnooTube · Feed de vídeos curtos" aria-label="Ampliar: UnooTube · Feed de vídeos curtos" aria-haspopup="dialog">
      <img src="/site/assets/missao-unootube-feed.webp" width="460" height="705" alt="UnooTube · Feed de vídeos curtos" hidden />Tela real ↗</button>
      </div>
      <div className="mw-av art-finais" style={{ backgroundSize: "321.4% auto", backgroundPosition: "22.58% 47.93%" }}>
      </div>
      </div>
      </div>
      </article>
      <article className="content-slide" role="group" aria-roledescription="slide" aria-label="3 de 5" aria-hidden="true" inert>
      <div className="slide-copy">
      <span className="slide-kicker">UnooGPT · Missão Tempestade</span>
      <h3>Decidir com recursos limitados.</h3>
      <p>A simulação apresenta quatro bairros em risco e duas equipes de resgate. A turma precisa investigar o cenário e definir prioridades, colocando a análise de informações a serviço de uma decisão.</p>
      <span className="slide-detail">Cada decisão exige um critério.</span>
      </div>
      <div className="slide-visual mw-visual">
      <div className="mw mw3" role="img" aria-label="Animação da Missão Tempestade: quatro bairros em risco, duas equipes de resgate e um relógio. A turma escolhe quais dois bairros recebem ajuda.">
      <div className="mw-win">
      <div className="mw-dots">
      <b>
      </b>
      <b>
      </b>
      <b>
      </b>
      </div>
      <div className="hs h0" style={{ left: "12.0cqw" }}>
      <svg viewBox="0 0 24 24">
      <path d="M4 11l8-7 8 7v9H4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 20v-6h4v6" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      </div>
      <div className="hs h1" style={{ left: "23.8cqw" }}>
      <svg viewBox="0 0 24 24">
      <path d="M4 11l8-7 8 7v9H4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 20v-6h4v6" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      </div>
      <div className="hs h2" style={{ left: "35.6cqw" }}>
      <svg viewBox="0 0 24 24">
      <path d="M4 11l8-7 8 7v9H4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 20v-6h4v6" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      </div>
      <div className="hs h3" style={{ left: "47.400000000000006cqw" }}>
      <svg viewBox="0 0 24 24">
      <path d="M4 11l8-7 8 7v9H4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 20v-6h4v6" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      </div>
      <span className="lbl" style={{ left: "12.0cqw" }}>
      <b>4</b>bairros em risco</span>
      <div className="team ta">A</div>
      <div className="team tb">B</div>
      <span className="lbl" style={{ left: "64cqw" }}>
      <b>2</b>equipes para mandar</span>
      <div className="rain">
      </div>
      <div className="cloud">
      <i>
      </i>
      <i>
      </i>
      <i>
      </i>
      <i>
      </i>
      </div>
      <div className="flash">
      </div>
      <div className="clock">
      <svg viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="15" fill="none" stroke="#ffffff22" strokeWidth="3" />
      <circle className="arc" cx="18" cy="18" r="15" fill="none" stroke="#ffb04d" strokeWidth="3" strokeLinecap="round" pathLength="100" strokeDasharray="100" strokeDashoffset="62" />
      </svg>
      <span>5 min</span>
      </div>
      <p className="msg">Não dá para atender todos. <b>Você escolhe quais dois recebem ajuda.</b>
      </p>
      <div className="tok toka">A</div>
      <div className="tok tokb">B</div>
      <p className="mw-title">Decidir com recursos limitados</p>
      </div>
      <div className="mw-real">
      <button type="button" data-print="" data-title="UnooGPT · Apresentação da missão Tempestade" aria-label="Ampliar: UnooGPT · Apresentação da missão Tempestade" aria-haspopup="dialog">
      <img src="/site/assets/missao-tempestade-apresentacao.webp" width="1872" height="877" alt="UnooGPT · Apresentação da missão Tempestade" hidden />Tela real ↗</button>
      </div>
      <div className="mw-av art-medio" style={{ backgroundSize: "321.4% auto", backgroundPosition: "15.73% 34.69%" }}>
      </div>
      </div>
      </div>
      </article>
      <article className="content-slide" role="group" aria-roledescription="slide" aria-label="4 de 5" aria-hidden="true" inert>
      <div className="slide-copy">
      <span className="slide-kicker">UnooGPT · Chat de investigação</span>
      <h3>Perguntar melhor para decidir melhor.</h3>
      <p>No chat, o Cientista de Dados responde sobre a cidade e alimenta o mapa com as informações consultadas. O estudante aprende a formular perguntas e reconhecer limites dos dados antes de agir.</p>
      <span className="slide-detail">A IA informa. A decisão continua com o estudante.</span>
      </div>
      <div className="slide-visual mw-visual">
      <div className="mw mw4" role="img" aria-label="Animação do chat de investigação: o estudante pergunta ao Cientista de Dados, o mapa acende com as informações consultadas e o estudante decide os destinos das equipes.">
      <div className="mw-win">
      <div className="mw-dots">
      <b>
      </b>
      <b>
      </b>
      <b>
      </b>
      </div>
      <div className="pan chat">
      <div className="cd">
      <i>CD</i>
      <div>
      <b>Cientista de Dados</b>
      <small>Responde fatos e previsões. Não decide.</small>
      </div>
      </div>
      <div className="bub b1">O que você quer saber primeiro?</div>
      <div className="bub b2">Onde há mais risco de alagamento?</div>
      <div className="bub b3">Ribeirinha tem risco alto.<em>fonte: previsão do tempo</em>
      </div>
      <span className="tag tag1">A IA informa</span>
      <div className="cnt">
      <span className="c mw4-c0">Perguntas: 3 de 3</span>
      <span className="c mw4-c1">Perguntas: 2 de 3</span>
      </div>
      <div className="go">Definir destinos →</div>
      </div>
      <div className="pan map">
      <div className="tabs">
      <i>Risco</i>
      <i>Pessoas</i>
      <i>Alcance</i>
      <i>Confiança</i>
      </div>
      <div className="surf">
      <div className="river">
      </div>
      <div className="blk k1">Vale Verde</div>
      <div className="blk k2">Ribeirinha</div>
      <div className="blk k3">Morro Alto</div>
      <div className="blk k4">Ladeira</div>
      <div className="pin pa">A</div>
      <div className="pin pb">B</div>
      </div>
      <span className="dark">O mapa está no escuro.</span>
      <span className="leg">
      <i>
      <b style={{ color: "#2ec07a" }}>●</b> Baixo</i>
      <i>
      <b style={{ color: "#ffa94d" }}>●</b> Médio</i>
      <i>
      <b style={{ color: "#ff5a6e" }}>●</b> Alto</i>
      </span>
      <span className="you">Você decide</span>
      </div>
      <svg className="cur" viewBox="0 0 24 24">
      <path d="M5 3l14 8-6 2 4 7-3 1.5-4-7-5 4z" fill="#fff" stroke="#0b0f26" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
      <p className="mw-title">Perguntar melhor para decidir melhor</p>
      </div>
      <div className="mw-real">
      <button type="button" data-print="" data-title="UnooGPT · Chat de investigação e mapa" aria-label="Ampliar: UnooGPT · Chat de investigação e mapa" aria-haspopup="dialog">
      <img src="/site/assets/missao-tempestade-chat-e-mapa.webp" width="1875" height="817" alt="UnooGPT · Chat de investigação e mapa" hidden />Tela real ↗</button>
      </div>
      <div className="mw-av art-medio" style={{ backgroundSize: "321.4% auto", backgroundPosition: "21.77% 55.38%" }}>
      </div>
      </div>
      </div>
      </article>
      <article className="content-slide" role="group" aria-roledescription="slide" aria-label="5 de 5" aria-hidden="true" inert>
      <div className="slide-copy">
      <span className="slide-kicker">Jogo · Vila do Lume</span>
      <h3>Explorar, escolher e observar.</h3>
      <p>Um ambiente de exploração com caminhos, pistas e mensagens. A turma precisa interpretar orientações e escolher como avançar, discutindo o que guiou suas ações durante a experiência.</p>
      <span className="slide-detail">A experiência abre espaço para reflexão com o professor.</span>
      </div>
      <div className="slide-visual mw-visual">
      <div className="mw mw5" role="img" aria-label="Animação da Vila do Lume: uma vila à noite com fogueira, três caminhos e um personagem que conversa com o Lume. O estudante escolhe o caminho, coleta fagulhas e acende a fogueira.">
      <div className="mw-win">
      <div className="mw-dots">
      <b>
      </b>
      <b>
      </b>
      <b>
      </b>
      </div>
      <div className="scene">
      <div className="stars">
      </div>
      <div className="grid">
      </div>
      <div className="path pl">
      </div>
      <div className="path pm">
      </div>
      <div className="path pr">
      </div>
      <div className="hut h1">
      </div>
      <div className="hut h2">
      </div>
      <div className="hut h3">
      </div>
      <span className="sign" style={{ left: "7.4cqw", top: "12.6cqw" }}>MERCADO</span>
      <span className="sign" style={{ right: "5.4cqw", top: "14cqw" }}>MURAL DE RECADOS</span>
      <span className="sign" style={{ left: "41.6cqw", top: "17cqw" }}>PRAÇA</span>
      <div className="glow">
      </div>
      <div className="fire">
      </div>
      <i className="sp">
      </i>
      <i className="sp sp2">
      </i>
      <i className="sp sp3">
      </i>
      <div className="dlg">
      <b>🔥 Lume</b>
      <span className="ln l1">Mas a vila é tua:</span>
      <span className="ln l2">vai por onde você quiser.</span>
      </div>
      <div className="hud hud1">
      <small>FOGO SAGRADO</small>
      <span className="v cnt">
      <span className="c mw5-c0">0/8 fogueiras</span>
      <span className="c mw5-c1">1/8 fogueiras</span>
      </span>
      </div>
      <div className="hud hud2">
      <small>FAGULHAS</small>
      <span className="v cnt">
      <span className="c mw5-d0">✦ 0 fagulhas</span>
      <span className="c mw5-d1">✦ 1 fagulha</span>
      <span className="c mw5-d2">✦ 2 fagulhas</span>
      <span className="c mw5-d3">✦ 3 fagulhas</span>
      </span>
      </div>
      <div className="you">
      </div>
      <span className="plus p1">+1</span>
      <span className="plus p2">+1</span>
      <span className="plus p3">+1</span>
      </div>
      <p className="mw-title">Explorar, escolher e observar</p>
      </div>
      <div className="mw-real">
      <button type="button" data-print="" data-title="Jogo · Vila do Lume" aria-label="Ampliar: Jogo · Vila do Lume" aria-haspopup="dialog">
      <img src="/site/assets/missao-vila-do-lume.webp" width="1901" height="875" alt="Jogo · Vila do Lume" hidden />Tela real ↗</button>
      </div>
      <div className="mw-av art-finais" style={{ backgroundSize: "321.4% auto", backgroundPosition: "15.73% 11.51%" }}>
      </div>
      </div>
      </div>
      </article>
      </div>
      <div className="carousel-controls">
      <button type="button" data-prev="" aria-label="Slide anterior de As missões" disabled>Anterior</button>
      <div className="carousel-position">
      <span className="carousel-count" aria-live="polite" aria-atomic="true">01 / 05</span>
      <div className="carousel-dots">
      <button type="button" className="carousel-dot" data-slide-to="0" aria-label="Ver slide 1" aria-pressed="true">
      </button>
      <button type="button" className="carousel-dot" data-slide-to="1" aria-label="Ver slide 2" aria-pressed="false">
      </button>
      <button type="button" className="carousel-dot" data-slide-to="2" aria-label="Ver slide 3" aria-pressed="false">
      </button>
      <button type="button" className="carousel-dot" data-slide-to="3" aria-label="Ver slide 4" aria-pressed="false">
      </button>
      <button type="button" className="carousel-dot" data-slide-to="4" aria-label="Ver slide 5" aria-pressed="false">
      </button>
      </div>
      </div>
      <button type="button" data-next="" aria-label="Próximo slide de As missões">Próximo</button>
      </div>
      </div>
      </div>
      </section>
      <section className="section focus-section" id="curriculo" aria-labelledby="curriculum-title">
      <div className="container">
      <div className="section-top">
      <div className="eyebrow">
      <span className="num">05 / 08</span> Currículo e progressão</div>
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
      <p className="curriculum-lead reveal">Progressão contínua, não uma coleção de temas soltos.</p>
      </div>
      {/* O material deixa este `.container` aberto e o navegador o fecha no
          `</section>`; o JSX exige o fechamento explícito, no MESMO ponto. */}
      </div>
      </section>
      <section className="section focus-section stage-section" id="anos-iniciais" aria-labelledby="stage-title-0">
      <div className="container">
      <div className="curriculum-cards">
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
      <img src="/site/assets/jornada-anos-iniciais.webp" width="935" height="1683" alt="Progressão pedagógica real dos Anos Iniciais. Ao terminar o 5º ano, o estudante não apenas usa tecnologia; ele começa a entender o que vê, verificar antes de acreditar, proteger-se e produzir conteúdo de maneira responsável." loading="lazy" decoding="async" />
      <span className="progression-zoom" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5M7.5 10.5h6m-3-3v6" />
      </svg>
      </span>
      </button>
      </figure>
      </article>
      </div>
      </div>
      </section>
      <section className="section focus-section stage-section" id="anos-finais" aria-labelledby="stage-title-1">
      <div className="container">
      <div className="curriculum-cards">
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
      <span className="progression-zoom" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5M7.5 10.5h6m-3-3v6" />
      </svg>
      </span>
      </button>
      </figure>
      </article>
      </div>
      </div>
      </section>
      <section className="section focus-section stage-section" id="ensino-medio" aria-labelledby="stage-title-2">
      <div className="container">
      <div className="curriculum-cards">
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
      <span className="progression-zoom" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5M7.5 10.5h6m-3-3v6" />
      </svg>
      </span>
      </button>
      </figure>
      </article>
      </div>
      </div>
      </section>
      <section className="section focus-section" id="territorios" aria-labelledby="pillars-title">
      <div className="container">
      <div className="pillars reveal">
      <div className="topic-heading">
      <h2 id="pillars-title">Oito territórios que <span className="accent">atravessam a jornada.</span>
      </h2>
      </div>
      <ol className="terr-grid" role="list">
      <li className="terr">
      <div className="terr-top">
      <span className="terr-ico">
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <path d="M8 9h8M8 12.5h8M8 16h5" />
      </svg>
      </span>
      <span className="terr-n">01</span>
      </div>
      <p className="terr-t">Informação e Educação Midiática</p>
      </li>
      <li className="terr">
      <div className="terr-top">
      <span className="terr-ico">
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      <circle cx="12" cy="15" r="1.1" fill="currentColor" />
      </svg>
      </span>
      <span className="terr-n">02</span>
      </div>
      <p className="terr-t">Privacidade e Dados</p>
      </li>
      <li className="terr">
      <div className="terr-top">
      <span className="terr-ico">
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 3.5 19 6v5.5c0 4.2-2.8 7.4-7 9-4.2-1.6-7-4.8-7-9V6z" />
      <path d="M9 12l2.2 2.2L15.2 10" />
      </svg>
      </span>
      <span className="terr-n">03</span>
      </div>
      <p className="terr-t">Segurança e Golpes</p>
      </li>
      <li className="terr">
      <div className="terr-top">
      <span className="terr-ico">
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="9" cy="9" r="3" />
      <circle cx="17" cy="10.5" r="2.4" />
      <path d="M3.5 19c.4-3 2.6-4.7 5.5-4.7s5.1 1.7 5.5 4.7M15.2 14.6c2.4-.3 4.6 1 5.3 3.6" />
      </svg>
      </span>
      <span className="terr-n">04</span>
      </div>
      <p className="terr-t">Convivência e Cidadania Digital</p>
      </li>
      <li className="terr">
      <div className="terr-top">
      <span className="terr-ico">
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M4.5 19.5 5.4 15 16.6 3.8a1.9 1.9 0 0 1 2.7 0l.9.9a1.9 1.9 0 0 1 0 2.7L9 18.6z" />
      <path d="M14.5 6l3.5 3.5" />
      </svg>
      </span>
      <span className="terr-n">05</span>
      </div>
      <p className="terr-t">Autoria e Publicação</p>
      </li>
      <li className="terr">
      <div className="terr-top">
      <span className="terr-ico">
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="6" cy="6.5" r="2.2" />
      <circle cx="18" cy="9" r="2.2" />
      <circle cx="9.5" cy="18" r="2.2" />
      <path d="M8 7l8 1.4M7.2 8.4l1.6 7.4M16.7 10.9l-5.6 5.4" />
      </svg>
      </span>
      <span className="terr-n">06</span>
      </div>
      <p className="terr-t">Algoritmos e Recomendação</p>
      </li>
      <li className="terr">
      <div className="terr-top">
      <span className="terr-ico">
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="6.5" y="6.5" width="11" height="11" rx="2.2" />
      <path d="M9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3" />
      <path d="M12 9.6l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z" fill="currentColor" stroke="none" />
      </svg>
      </span>
      <span className="terr-n">07</span>
      </div>
      <p className="terr-t">Inteligência Artificial</p>
      </li>
      <li className="terr">
      <div className="terr-top">
      <span className="terr-ico">
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 20s-7-4.4-7-10a4.2 4.2 0 0 1 7-3.1A4.2 4.2 0 0 1 19 10c0 5.6-7 10-7 10z" />
      </svg>
      </span>
      <span className="terr-n">08</span>
      </div>
      <p className="terr-t">Bem-estar e Uso Responsável</p>
      </li>
      </ol>
      <p className="terr-note">Os temas retornam ao longo dos anos com profundidade crescente e linguagem adequada à idade.</p>
      </div>
      </div>
      </section>
      <section className="section focus-section" id="docentes" aria-labelledby="docentes-title">
      <div className="container">
      <div className="section-top">
      <div className="eyebrow">Docentes · Apoio à prática</div>
      </div>
      <div className="topic-heading">
      <h2 id="docentes-title">Mais apoio para <span className="accent">ensinar.</span>
      </h2>
      <p className="lead">O professor conduz a reflexão. O material oferece caminhos para preparar, mediar e acompanhar a aprendizagem.</p>
      </div>
      <ol className="flow flow--3">
      <li>
      <span className="flow-kicker">01 · Orientar</span>
      <h3>Material e guias.</h3>
      <p>Objetivos e orientações para mediar pesquisas, atividades e produções.</p>
      </li>
      <li>
      <span className="flow-kicker">02 · Preparar</span>
      <h3>Assistente de IA.</h3>
      <p>Apoio para preparar atividades e adaptar a condução à turma.</p>
      </li>
      <li>
      <span className="flow-kicker">03 · Acompanhar</span>
      <h3>Formação e apoio.</h3>
      <p>Suporte pedagógico para dúvidas e desafios ao longo do ano.</p>
      </li>
      </ol>
      </div>
      </section>
      <section className="section focus-section" id="familias" aria-labelledby="familias-title">
      <div className="container">
      <div className="section-top">
      <div className="eyebrow">Famílias · Aprendizagem no cotidiano</div>
      </div>
      <div className="topic-heading">
      <h2 id="familias-title">Aprendizado que chega <span className="accent">à família.</span>
      </h2>
      <p className="lead">O estudante leva o que aprende para casa e pode ajudar a família a escolher melhor no digital.</p>
      </div>
      <div className="family-benefits">
      <article className="compact-card">
      <span className="card-kicker">Reconhecer riscos</span>
      <h3>Mais atenção a golpes.</h3>
      <p>Reconhecer mensagens suspeitas e verificar antes de compartilhar dados.</p>
      </article>
      <article className="compact-card">
      <span className="card-kicker">Cuidar das relações</span>
      <h3>Mais cuidado nas redes.</h3>
      <p>Reconhecer cyberbullying, pedir ajuda e agir com respeito.</p>
      </article>
      <article className="compact-card">
      <span className="card-kicker">Compartilhar o que aprende</span>
      <h3>Mais autonomia em família.</h3>
      <p>Ajudar a conferir fontes, ajustar a privacidade e usar novas ferramentas.</p>
      </article>
      </div>
      </div>
      </section>
      <section className="section restored-section closing-cta" id="contato" aria-labelledby="closing-title">
      <div className="container closing-grid">
      <h2 id="closing-title">Sua rede já tem o desafio.<br />
      <span>O ENTRE REDES entrega o caminho.</span>
      </h2>
      <div className="closing-side">
      <p>Uma solução completa para transformar a prioridade de Educação Digital e Midiática em aprendizagem real, com implantação simples e acompanhamento contínuo.</p>
      <ConviteDoCadastro />
      </div>
      </div>
      </section>
      <section className="section about-unooria" id="unooria" aria-labelledby="unooria-title">
      <div className="container">
      <div className="section-top">
      <div className="eyebrow">
      <span className="num">08 / 08</span> Sobre a Unooria</div>
      </div>
      <div className="about-focus">
      <div>
      <h2 id="unooria-title">Tecnologia para <span className="accent">ampliar o conhecimento.</span>
      </h2>
      <p className="lead">A Unooria une pedagogia e tecnologia para promover aprendizagem real. Acreditamos que aprender exige participação: investigar, experimentar, criar e compreender.</p>
      <p>O ENTRE REDES traduz esse propósito em livros, missões e apoio ao professor para ensinar a viver no mundo digital com autonomia e senso crítico.</p>
      <a className="button outline" href="https://unooria-educacao.scolfaros.chatgpt.site" target="_blank" rel="noopener noreferrer">Conheça a Unooria</a>
      </div>
      <figure className="infinity-stage infinity-interlude" aria-label="O infinito da Unooria formado por pontos de luz">
      <canvas className="infinity-canvas" id="brand-infinity" role="button" tabIndex={0} aria-label="Arraste para girar o infinito de estrelas. Toque ou pressione Enter para refazer. Use as setas para girar e Home para centralizar.">
      </canvas>
      <div className="infinity-controls">
      <button id="infinity-replay" aria-label="Rever a formação do infinito" title="Rever a formação">
      <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5v5h5L7.6 7.6A6 6 0 1 1 6 12H4a8 8 0 1 0 2.2-5.5L5 5Z" />
      </svg>
      </button>
      <button id="infinity-pause" aria-label="Pausar animação do infinito" aria-pressed="false" title="Pausar animação">
      <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
      </svg>
      </button>
      </div>
      </figure>
      </div>
      </div>
      </section>
      </main>
      <JanelaDoCadastro />
      <footer className="footer">
      <div className="container">
      <a className="footer-brand" href="#inicio" aria-label="Unooria — voltar ao início">
      <img src="/site/assets/c391a425254523c1.webp" width="600" height="129" alt="Unooria" loading="lazy" />
      </a>
      {/* ACRÉSCIMO ao porte (H11.1.2): os documentos legais a um clique de
          qualquer ponto do site. */}
      <nav className="footer-legal" aria-label="Documentos legais">
      <a href="/privacidade">Política de Privacidade</a>
      <a href="/termos">Termos de Uso</a>
      </nav>
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
      <a href="#proposito">
      <span>01</span>Propósito</a>
      <a href="#desafio">
      <span>02</span>O problema</a>
      <a href="#resposta">
      <span>03</span>Como resolvemos</a>
      <a className="index-sub" href="#livros">Materiais do estudante · Desplugado</a>
      <a href="#missoes">
      <span>04</span>As missões · Plugado</a>
      <a href="#curriculo">
      <span>05</span>Currículo e progressão</a>
      <a href="#docentes">
      <span>06</span>Docentes</a>
      <a href="#familias">
      <span>07</span>Famílias</a>
      <a href="#unooria">
      <span>08</span>Sobre a Unooria</a>
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
    </ProvedorDoCadastro>
    </PalcoDoSite>
  );
}
