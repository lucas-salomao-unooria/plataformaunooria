import "./landing.css";

import { Button, Icon, Logo, LogoSymbol } from "@edu/ui/ds";
import { CascaPlataforma } from "@/components/casca-plataforma";
import { FundoAnimado } from "./fundo-animado";
import { RevelarAoRolar } from "./revelar-ao-rolar";

/**
 * Landing pública da plataforma — a raiz (`/`) para quem não tem sessão.
 *
 * Porte da tela "Unooria - Educação Digital Infinita" do Stitch. A estrutura,
 * a copy, as seções e o movimento são os do modelo; a cor, a tipografia, os
 * ícones, o logo e os botões são os do DS (seção `unooria`, via `@edu/ui/ds`)
 * — ver `landing.css` e a ADR-40. É chrome do hub: a única superfície pública
 * fora do login, e não lê nada da sessão.
 */

const RAIZ_ID = "landing";

/**
 * Cor dos ícones pela prop `color` do `Icon` (vira estilo inline). Uma classe
 * não basta: a folha do DS vem DEPOIS no grafo de importação e, com peso igual,
 * a cor do pacote vence — os ícones saíam pretos.
 */
const COR = {
  primaria: "var(--unooria-color-brandnavy-900, #2f4f7f)",
  perigo: "var(--unooria-color-danger-600, #e31a1a)",
  roxo: "var(--unooria-color-brandpurple-700, #57547d)",
  roxoClaro: "var(--unooria-color-brandpurple-600, #716c98)",
} as const;

const DESAFIOS = [
  {
    icone: "warning",
    cor: COR.perigo,
    titulo: "Desinformação",
    texto: "Dificuldade em discernir fontes confiáveis de fake news em um mar de informações.",
  },
  {
    icone: "psychology_alt",
    cor: COR.roxo,
    titulo: "Saúde Mental",
    texto: "Impactos negativos da comparação social e tempo excessivo de tela.",
  },
  {
    icone: "security",
    cor: COR.roxoClaro,
    titulo: "Segurança",
    texto: "Exposição a riscos de privacidade e cyberbullying nas redes.",
  },
] as const;

const RESPOSTAS = [
  {
    icone: "route",
    selo: "landing-selo--navy",
    cor: COR.primaria,
    titulo: "Currículo Progressivo",
    texto: "Adaptado para cada faixa etária, do EF1 ao Ensino Médio.",
  },
  {
    icone: "explore",
    selo: "landing-selo--roxo",
    cor: COR.roxo,
    titulo: "Missões Práticas",
    texto: "Aprendizado baseado em situações reais do cotidiano digital.",
  },
] as const;

const SUPORTE = [
  {
    icone: "school",
    cor: COR.primaria,
    titulo: "Para Professores",
    texto: "Materiais completos, guias de facilitação e formação contínua.",
  },
  {
    icone: "smart_toy",
    cor: COR.roxo,
    titulo: "Copiloto IA",
    texto: "Assistente inteligente para adaptar missões e tirar dúvidas em tempo real.",
  },
] as const;

export function Landing() {
  const ano = new Date().getFullYear();

  return (
    <CascaPlataforma style={{ background: "transparent" }}>
      <div id={RAIZ_ID} className="landing">
        <FundoAnimado />
        <RevelarAoRolar raizId={RAIZ_ID} />

        <div className="landing__conteudo">
          {/* ---- navegação ------------------------------------------------ */}
          <nav className="landing-nav" aria-label="Principal">
            <div className="landing-nav__miolo">
              <a href="#" aria-label="Unooria — início" className="flex items-center">
                <Logo size="md" color="navy" ariaLabel="Unooria" />
              </a>
              <Button variant="primary" size="md" href="/login">
                Começar Agora
              </Button>
            </div>
          </nav>

          {/* ---- hero ----------------------------------------------------- */}
          <section className="landing-hero">
            <div className="landing-revelar flex max-w-3xl flex-col items-center text-center">
              <Logo size={96} color="navy" ariaLabel="Unooria" className="mb-8" />
              <h1 className="landing-display mb-6">
                Educação Digital e Midiática:
                <br />
                <span className="landing-cor-primaria">Uma Jornada para a Vida Real.</span>
              </h1>
              <p className="landing-corpo-lg landing-cor-apoio mb-10 max-w-2xl">
                Do 1º ano do Fundamental ao 3º ano do Médio. Aprender a viver melhor no mundo
                digital.
              </p>
              <Button
                variant="outline"
                size="lg"
                href="#problema"
                className="landing-botao-explorar"
                rightIcon={<Icon name="arrow_downward" size="s" className="landing-seta" />}
              >
                Explorar a Jornada
              </Button>
            </div>
          </section>

          {/* ---- o problema ----------------------------------------------- */}
          <section id="problema" className="landing-secao">
            <div className="landing-revelar mb-16 text-center">
              <h2 className="landing-titulo mb-4">O Desafio Digital Atual</h2>
              <p className="landing-corpo landing-cor-apoio mx-auto max-w-2xl">
                Nossos jovens enfrentam um ambiente digital complexo sem o preparo adequado.
              </p>
            </div>
            <ul className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {DESAFIOS.map((item, i) => (
                <li
                  key={item.titulo}
                  className={`landing-vidro landing-cartao landing-revelar landing-revelar--atraso-${i + 1} p-8`}
                >
                  <Icon name={item.icone} size={36} color={item.cor} className="mb-4" />
                  <h3 className="landing-subtitulo mb-2">{item.titulo}</h3>
                  <p className="landing-corpo landing-cor-apoio">{item.texto}</p>
                </li>
              ))}
            </ul>
          </section>

          {/* ---- nossa resposta ------------------------------------------- */}
          <section id="resposta" className="landing-secao">
            <div className="landing-vidro landing-revelar rounded-2xl p-8 md:p-12">
              <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
                <div>
                  <h2 className="landing-titulo mb-6">Nossa Resposta</h2>
                  <p className="landing-corpo-lg landing-cor-primaria mb-8 font-semibold">
                    “Aprender a partir do mundo que os estudantes já vivem.”
                  </p>
                  <ul className="flex flex-col gap-6">
                    {RESPOSTAS.map((item) => (
                      <li key={item.titulo} className="flex items-start gap-4">
                        <span className={`landing-selo ${item.selo}`}>
                          <Icon name={item.icone} size="s" color={item.cor} />
                        </span>
                        <div>
                          <h4 className="landing-subtitulo mb-1">{item.titulo}</h4>
                          <p className="landing-corpo landing-cor-apoio">{item.texto}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="landing-conceito" aria-hidden="true">
                  <LogoSymbol
                    size={340}
                    color="white"
                    className="landing-conceito__simbolo"
                    ariaLabel="Símbolo Unooria"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ---- suporte -------------------------------------------------- */}
          <section id="suporte" className="landing-secao">
            <div className="landing-revelar mb-16 text-center">
              <h2 className="landing-titulo mb-4">Suporte e Implementação</h2>
              <p className="landing-corpo landing-cor-apoio mx-auto max-w-2xl">
                Apoiamos educadores em toda a jornada.
              </p>
            </div>
            <ul className="grid grid-cols-1 gap-8 md:grid-cols-2">
              {SUPORTE.map((item, i) => (
                <li
                  key={item.titulo}
                  className={`landing-cartao landing-cartao--branco landing-revelar landing-revelar--atraso-${i + 1} flex items-center gap-6 p-8`}
                >
                  <Icon name={item.icone} size={48} weight={200} color={item.cor} />
                  <div>
                    <h3 className="landing-subtitulo mb-2">{item.titulo}</h3>
                    <p className="landing-corpo landing-cor-apoio">{item.texto}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* ---- rodapé --------------------------------------------------- */}
          <footer className="landing-rodape">
            <div className="landing-rodape__miolo">
              <div className="flex flex-col items-center gap-8 md:flex-row md:justify-between">
                <Logo size="md" color="navy" ariaLabel="Unooria" />
                <nav aria-label="Links do rodapé">
                  <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-2">
                    <li>
                      <a className="landing-rotulo" href="/privacidade">
                        Privacidade
                      </a>
                    </li>
                    <li>
                      <a className="landing-rotulo" href="/termos">
                        Termos
                      </a>
                    </li>
                    <li>
                      <a className="landing-rotulo" href="#">
                        Contato
                      </a>
                    </li>
                  </ul>
                </nav>
              </div>
              <p className="landing-rotulo landing-cor-apoio landing-rodape__assinatura">
                © {ano} Unooria.
              </p>
            </div>
          </footer>
        </div>
      </div>
    </CascaPlataforma>
  );
}
