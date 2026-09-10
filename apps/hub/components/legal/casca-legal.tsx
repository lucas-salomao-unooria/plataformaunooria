import "./legal.css";

import { Button, Icon, Logo, ScrollBar } from "@edu/ui/ds";
import { CascaPlataforma } from "@/components/casca-plataforma";
import { FundoAnimado } from "@/components/landing/fundo-animado";
import { SumarioAtivo } from "./sumario-ativo";

/**
 * Casca das páginas legais públicas (`/privacidade`, `/termos`).
 *
 * As duas páginas são a MESMA página com outro texto: mesma nav, mesmo fundo,
 * mesmo sumário lateral, mesmo pé. Só o conteúdo muda — por isso ele entra como
 * dado (`secoes`) e não como marcação livre. É o que mantém o sumário em
 * sincronia com o texto: numeração, âncora e ordem saem da mesma lista que
 * renderiza as seções, então não existe o estado em que o índice promete um
 * item que o corpo não tem.
 *
 * Reaproveita o `FundoAnimado` e a folha da landing (via `legal.css`) porque
 * é a mesma superfície pública: quem chega aqui veio do rodapé de lá, e a
 * página não pode parecer de outro produto.
 */

export type SecaoLegal = {
  /** Âncora da seção — entra na URL, então não muda sem quebrar link salvo. */
  id: string;
  titulo: string;
  conteudo: React.ReactNode;
};

export type MetaLegal = { rotulo: string; valor: string };

export type AtalhoLegal = {
  href: string;
  titulo: string;
  texto: string;
  icone: string;
};

export function CascaLegal({
  titulo,
  resumo,
  meta,
  secoes,
  atalhos,
  aviso,
}: {
  titulo: string;
  resumo: React.ReactNode;
  meta: MetaLegal[];
  secoes: SecaoLegal[];
  atalhos: AtalhoLegal[];
  /** Faixa acima do texto (ex.: documento em revisão). Omitida quando ausente. */
  aviso?: React.ReactNode;
}) {
  const itens = secoes.map(({ id, titulo: t }) => ({ id, titulo: t }));

  return (
    <CascaPlataforma style={{ background: "transparent" }}>
      <div className="landing legal">
        <FundoAnimado />

        <div className="landing__conteudo">
          {/* ---- navegação (a mesma da landing) --------------------------- */}
          <nav className="landing-nav" aria-label="Principal">
            <div className="landing-nav__miolo">
              <a
                href="/"
                aria-label="Unooria — início"
                className="flex items-center"
              >
                <Logo size="md" color="navy" ariaLabel="Unooria" />
              </a>
              <Button variant="primary" size="md" href="/login">
                Entrar
              </Button>
            </div>
          </nav>

          {/* ---- cabeçalho ------------------------------------------------ */}
          <header className="legal-cabecalho">
            <a
              className="legal-cabecalho__trilha landing-rotulo landing-cor-apoio"
              href="/"
            >
              <Icon
                name="arrow_back"
                size="s"
                color="var(--unooria-color-neutral-700, #475157)"
              />
              Voltar para a página inicial
            </a>
            <h1 className="landing-display legal-cabecalho__titulo">
              {titulo}
            </h1>
            <div className="landing-corpo-lg landing-cor-apoio legal-cabecalho__resumo">
              {resumo}
            </div>
            <dl className="legal-meta">
              {meta.map((item) => (
                <div className="legal-meta__item" key={item.rotulo}>
                  <dt className="legal-meta__rotulo">{item.rotulo}</dt>
                  <dd className="legal-meta__valor">{item.valor}</dd>
                </div>
              ))}
            </dl>
          </header>

          {/* ---- sumário + artigo ----------------------------------------- */}
          <div className="legal-miolo">
            <aside className="landing-vidro legal-sumario" aria-label="Sumário">
              {/* Quem GRUDA é o `<aside>` (`position: sticky`), quem ROLA é o
                  `ScrollBar` do DS. Separado assim de propósito: o elemento
                  semântico do índice continua sendo o `<aside>`. */}
              <ScrollBar autoHide className="legal-sumario__rolagem">
                <p className="legal-sumario__titulo">Nesta página</p>
                <SumarioAtivo itens={itens} />
              </ScrollBar>
            </aside>

            <article className="landing-vidro legal-artigo">
              {aviso}
              {secoes.map((secao, i) => (
                <section className="legal-secao" key={secao.id}>
                  <div className="legal-secao__cabecalho" id={secao.id}>
                    <span className="legal-secao__numero" aria-hidden="true">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h2 className="landing-titulo">{secao.titulo}</h2>
                  </div>
                  <div className="legal-texto">{secao.conteudo}</div>
                </section>
              ))}
            </article>
          </div>

          {/* ---- pé -------------------------------------------------------- */}
          <div className="legal-pe">
            {atalhos.map((atalho) => (
              <a
                className="landing-vidro landing-cartao legal-atalho"
                href={atalho.href}
                key={atalho.href}
              >
                <Icon
                  name={atalho.icone}
                  size={28}
                  color="var(--unooria-color-brandnavy-900, #2f4f7f)"
                />
                <span className="legal-atalho__texto">
                  <span className="landing-subtitulo">{atalho.titulo}</span>
                  <span className="landing-corpo landing-cor-apoio">
                    {atalho.texto}
                  </span>
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </CascaPlataforma>
  );
}
