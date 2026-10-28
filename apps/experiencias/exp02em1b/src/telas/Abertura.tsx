import { Badge, Button, FeatureCard } from "@edu/ui/ds-unooriaai";
import { TEXTOS } from "../lib/textos";
import type { Sessao } from "../lib/tipos";
import { FaixaDeConexao } from "./FaixaDeConexao";

/**
 * E1-ALU-01 — a pauta da semana, já DENTRO do UnooriaAI (seção `unooriaai`,
 * ADR-191): a 2.1.0 tirou a tela da escola da frente; o estudante abre a
 * missão no app. A pauta é do pacote que o professor homologou (`textos.pauta`).
 * Sem pacote no ar, a mesma tela espera o professor, na voz da ficção.
 */
export function Abertura({
  preparada,
  pauta,
  semRede,
  onAbrir,
}: {
  preparada: boolean;
  pauta: Sessao["textos"]["pauta"];
  semRede: boolean;
  onAbrir: () => void;
}) {
  return (
    <main className="uai-tela">
      {semRede && <FaixaDeConexao />}
      <header className="uai-topo">
        <span className="uai-topo__titulo">{TEXTOS.abertura.marca}</span>
      </header>
      <div className="uai-corpo uai-corpo--centrado">
        <section className="uai-pauta" aria-labelledby="pauta-titulo">
          <Badge variant="primary">{TEXTOS.abertura.tag}</Badge>
          <h1 id="pauta-titulo" className="uai-pauta__titulo">
            {TEXTOS.abertura.titulo}
          </h1>
          <p className="uai-pauta__texto">{TEXTOS.abertura.briefing}</p>
          {preparada && pauta && (
            <FeatureCard
              block
              className="uai-pauta__cartao"
              title={pauta.titulo}
              description={
                <>
                  <span className="uai-pauta__descricao">{pauta.descricao}</span>
                  <ul className="uai-pauta__orientacoes">
                    {pauta.orientacoes.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                </>
              }
            />
          )}
          {preparada ? (
            <Button block size="lg" onClick={onAbrir}>
              {TEXTOS.abertura.abrir}
            </Button>
          ) : (
            <p className="uai-pauta__espera" role="status">
              {TEXTOS.abertura.preparo}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
