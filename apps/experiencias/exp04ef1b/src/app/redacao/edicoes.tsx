import { useMemo } from "react";
import { AlertBox } from "@edu/ui/ds";
import type { CorpoDaPublicacao } from "../../lib/api";
import { EREV, REDACAO } from "../../lib/textos";
import type { IdDeNoticia, NoticiaPublica, Revisao, TipoDePista } from "../../lib/tipos";
import { Cabecalho } from "./cabecalho";
import { MesaDeEdicao } from "./mesa-de-edicao";
import { useMontagem } from "./montagem";
import { mapaDeMarcadores } from "./pagina";

interface PropsComuns {
  sessaoId: string;
  noticias: readonly NoticiaPublica[];
  pistas: ReadonlyMap<string, string>;
  publicando: boolean;
  aoRevelar: (noticiaId: IdDeNoticia, tipo: TipoDePista) => Promise<boolean>;
  /** O chip nasce aberto na gaveta? (já registrado NESTA fase) */
  abertaDeInicio: (noticiaId: IdDeNoticia, tipo: TipoDePista) => boolean;
  /** O latch. `true` = a api confirmou (a tela vai mudar de passo). */
  aoPublicar: (corpo: CorpoDaPublicacao) => Promise<boolean>;
  aoFalharMidia: () => void;
}

/** E2/E3 — a 1ª edição: a mesa, a página em branco e o latch. */
export function PrimeiraEdicao(props: PropsComuns) {
  const ids = useMemo(() => new Set(props.noticias.map((n) => n.id)), [props.noticias]);
  const m = useMontagem({ sessaoId: props.sessaoId, edicao: 1, ids });
  return (
    <MesaDeEdicao
      edicao={1}
      cabecalho={<Cabecalho titulo={REDACAO.nome} selo={REDACAO.emEdicao} />}
      noticias={props.noticias}
      vagas={m.vagas}
      pistas={props.pistas}
      diagramacao={m.diagramacao}
      montando={m.montando}
      publicando={props.publicando}
      aoMudarVagas={m.mudarVagas}
      aoRevelar={props.aoRevelar}
      abertaDeInicio={props.abertaDeInicio}
      aoFalharMidia={props.aoFalharMidia}
      aoPublicar={() => {
        if (!m.slots || !m.diagramacao) return;
        void props
          .aoPublicar({ slots: m.slots, layout: m.diagramacao.layout, origemDoLayout: m.diagramacao.origem })
          .then((ok) => {
            if (ok) m.esquecer();
          });
      }}
    />
  );
}

/**
 * EREV-ALU-01 — a mesa de revisão, depois da Chave: a MESMA mesa, com a página
 * já montada com as três da 1ª edição e o marcador que a Chave pôs em cada vaga
 * (`GET revisao`). A criança troca o que quiser — ou nada: republicar as três
 * da 1ª é caminho previsto (PDF §9, "se acertou tudo de primeira, o aluno
 * confirma") — e as pistas continuam abertas como estavam.
 */
export function SegundaEdicao({
  primeira,
  revisao,
  ...props
}: PropsComuns & { primeira: readonly IdDeNoticia[]; revisao: Revisao | null }) {
  const ids = useMemo(() => new Set(props.noticias.map((n) => n.id)), [props.noticias]);
  const m = useMontagem({ sessaoId: props.sessaoId, edicao: 2, ids, inicial: primeira });
  const marcadores = useMemo(() => (revisao ? mapaDeMarcadores(revisao.vagas) : undefined), [revisao]);
  return (
    <MesaDeEdicao
      edicao={2}
      cabecalho={<Cabecalho titulo={EREV.titulo} selo={EREV.chaveFixada} icone="key" />}
      aviso={
        <div className="tela__faixa">
          <AlertBox variant="info" theme="light" device="mobile" role="status" description={EREV.avisoChave} />
        </div>
      }
      noticias={props.noticias}
      vagas={m.vagas}
      pistas={props.pistas}
      marcadores={marcadores}
      diagramacao={m.diagramacao}
      montando={m.montando}
      publicando={props.publicando}
      aoMudarVagas={m.mudarVagas}
      aoRevelar={props.aoRevelar}
      abertaDeInicio={props.abertaDeInicio}
      aoFalharMidia={props.aoFalharMidia}
      aoPublicar={() => {
        if (!m.slots || !m.diagramacao) return;
        void props
          .aoPublicar({ slots: m.slots, layout: m.diagramacao.layout, origemDoLayout: m.diagramacao.origem })
          .then((ok) => {
            if (ok) m.esquecer();
          });
      }}
    />
  );
}
