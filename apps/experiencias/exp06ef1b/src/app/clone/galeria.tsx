import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeUnv,
  BottomSheetUnv,
  ButtonUnv,
  Chip,
  IconUnv,
  InlineHint,
  NotificationItem,
  SearchField,
} from "@edu/ui/ds-unoovista";
import {
  areaComMaisOcultos,
  casaComABusca,
  classificarBusca,
  comCerquilha,
  iniciais,
  ocultosDaArea,
  opcoesDaTroca,
} from "../../lib/regras";
import { CONTAS, E2, E4 } from "../../lib/textos";
import type {
  AcaoDaGaleria,
  Area,
  Categoria,
  Galeria as DadosDaGaleria,
  ProjetoDaGaleria,
  Voto,
} from "../../lib/tipos";
import { altDaFoto, srcDaFoto, srcDoEstande, usePaleta } from "../componentes/midia";
import { Cabecalho } from "./cabecalho";
import { Escolha } from "./escolha";

/** Quanto a digitação precisa parar para a busca valer como UMA busca (para a api). */
const PAUSA_DA_BUSCA_MS = 1_200;

/** A revisão como a api a recebe (`RevisaoDoVotoSchema`). */
export type CorpoDaRevisao = { acao: "manter" } | { acao: "trocar"; projetoId: string };

/**
 * E4-ALU-01/02/03 — a Galeria Oculta: o AHA e o MEMORÁVEL.
 *
 * - **A notificação da comissão** abre a tela, e logo abaixo o voto lacrado.
 * - **O badge é "X de Y"** (0.5.0), os dois números REAIS da sessão
 *   (`GaleriaSchema.invisibilidade`), sem porcentagem, e logo abaixo a busca.
 * - **A contagem por área e o contraste "sem as suas curtidas" SAÍRAM da tela**
 *   na 0.7.0, a pedido do time que rodou a missão (ADR-176): a tela ficou
 *   longa demais antes da busca, e quem conduz a comparação é a grade e a
 *   lousa do professor. A api continua mandando `porArea` (é ele que escolhe a
 *   área em que a grade abre) e `semCurtidas`.
 * - **A grade é dos ocultos DE UMA ÁREA**, a dos chips. Abre na área que mais
 *   ficou fora (sem contar como busca: a criança não tocou em nada); tocar num
 *   chip troca a área e conta como busca por hashtag (a EF06CO01). Cada
 *   miniatura tem "Inspecionar Projeto", que abre a "Ficha Técnica de
 *   Auditoria". A abertura é registrada — é o que libera "Manter".
 * - **A busca por texto** procura nos quarenta. Da busca, a api recebe só o
 *   TIPO e a área (texto de menor não sai do aparelho).
 * - **A revisão tem dois botões** (PRD v2): "Manter meu voto inicial", travado
 *   com a explicação até a criança abrir ao menos UM oculto, e "Confirmar Voto
 *   Revisado", que abre a lista — FILTRADA pelos mesmos chips de área (39
 *   opções soltas não se escolhem num celular).
 */
export function Galeria({
  galeria,
  categorias,
  voto,
  enviando,
  aoAcao,
  aoRevisar,
}: {
  galeria: DadosDaGaleria;
  categorias: readonly Categoria[];
  voto: Voto | null;
  enviando: boolean;
  aoAcao: (acao: AcaoDaGaleria) => void;
  aoRevisar: (corpo: CorpoDaRevisao) => void;
}) {
  const paleta = usePaleta();
  const [texto, setTexto] = useState("");
  /* A área da grade: abre na que mais ficou fora, e os chips a trocam. Nunca vazia. */
  const [chip, setChip] = useState<Area>(
    () => areaComMaisOcultos(galeria.porArea) ?? categorias[0]?.area ?? "area_a",
  );
  const [areaDaTroca, setAreaDaTroca] = useState<Area>(chip);
  const [ficha, setFicha] = useState<ProjetoDaGaleria | null>(null);
  const [trocando, setTrocando] = useState(false);
  const [novo, setNovo] = useState<string | null>(null);
  /* "Manter" destrava na hora do toque num oculto; o servidor confirma no latch (409 `galeria-sem-inspecao`). */
  const [abriuOculto, setAbriuOculto] = useState(galeria.podeManter);
  const ultimaBusca = useRef<string | null>(null);

  const porId = useMemo(() => new Map(galeria.projetos.map((p) => [p.id, p])), [galeria.projetos]);
  const doVoto = voto ? porId.get(voto.projetoId) : undefined;

  const nomeDa = (area: Area) => categorias.find((c) => c.area === area)?.nome ?? area;
  const buscando = texto.trim() !== "";
  const ocultosDoChip = ocultosDaArea(galeria.projetos, chip);
  const visiveis = buscando ? galeria.projetos.filter((p) => casaComABusca(p, texto, categorias)) : ocultosDoChip;

  function registrarBusca(acao: Extract<AcaoDaGaleria, { tipo: "buscar" }>) {
    const chave = `${acao.busca}:${acao.area ?? "-"}`;
    if (chave === ultimaBusca.current) return;
    ultimaBusca.current = chave;
    aoAcao(acao);
  }

  // A busca por texto vale quando a digitação para.
  useEffect(() => {
    if (!texto.trim()) return;
    const relogio = window.setTimeout(() => {
      const classe = classificarBusca(texto, categorias, galeria.projetos);
      if (classe) registrarBusca({ tipo: "buscar", ...classe });
    }, PAUSA_DA_BUSCA_MS);
    return () => window.clearTimeout(relogio);
    // `registrarBusca` lê só refs e a prop estável `aoAcao`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, categorias, galeria.projetos]);

  /* O chip troca a área da grade e limpa o texto. Tocar no chip já escolhido com
     texto digitado volta à área; sem texto, não muda nada (e não conta). */
  function tocarNoChip(area: Area) {
    if (chip === area && !buscando) return;
    setChip(area);
    setTexto("");
    registrarBusca({ tipo: "buscar", busca: "hashtag", area });
  }

  function inspecionar(p: ProjetoDaGaleria) {
    setFicha(p);
    if (!p.exibidoNoSeuFeed) setAbriuOculto(true);
    aoAcao({ tipo: "abrir", projetoId: p.id });
  }

  const { ocultos, total } = galeria.invisibilidade;

  return (
    <div className="tela">
      <h1 className="so-leitor">{E4.titulo}</h1>
      <Cabecalho />
      <div className="rolagem galeria">
        <NotificationItem
          className="galeria__notificacao"
          username={CONTAS.comissao}
          initials={iniciais(CONTAS.comissao)}
          action={E4.notificacao}
          unread
        />
        {doVoto && (
          <p className="galeria__voto">
            <span className="galeria__voto-rotulo">{E4.seuVoto}</span> {doVoto.titulo}
          </p>
        )}
        <h2 className="galeria__titulo">{E4.titulo}</h2>
        <InlineHint tone="friction" announce>
          {E4.badge(ocultos, total)}
        </InlineHint>
        <SearchField
          block
          value={texto}
          placeholder={E4.busca}
          ariaLabel={E4.busca}
          clearable
          clearLabel={E4.limparBusca}
          onClear={() => setTexto("")}
          onChange={(e) => setTexto(e.target.value)}
        />
        <div className="galeria__chips" role="group" aria-label={E4.hashtags}>
          {categorias.map((c) => {
            const ativo = !buscando && chip === c.area;
            return (
              <Chip key={c.area} selected={ativo} aria-pressed={ativo} onClick={() => tocarNoChip(c.area)}>
                {comCerquilha(c.hashtag)}
              </Chip>
            );
          })}
        </div>
        {buscando ? (
          <p className="galeria__resultados" role="status">
            {E4.resultados(visiveis.length)}
          </p>
        ) : (
          <p className="galeria__subtitulo" role="status">
            {E4.subtitulo(ocultosDoChip.length)}
          </p>
        )}
        <ul className="grade-oculta" aria-label={buscando ? E4.gradeBusca : E4.gradeOculta(nomeDa(chip))}>
          {visiveis.map((p) => (
            <li key={p.id} className="grade-oculta__item">
              <img
                className="grade-oculta__miniatura"
                src={srcDoEstande({ projetoId: p.id, titulo: p.titulo, imagem: p.imagem }, paleta)}
                alt={p.titulo}
              />
              <ButtonUnv variant="secondary" size="sm" block aria-label={E4.inspecionarO(p.titulo)} onClick={() => inspecionar(p)}>
                {E4.inspecionar}
              </ButtonUnv>
            </li>
          ))}
        </ul>
      </div>
      <div className="doca revisao">
        <p className="revisao__titulo">{E4.revisao}</p>
        <ButtonUnv
          variant="secondary"
          size="md"
          block
          disabled={!abriuOculto || enviando}
          aria-describedby={abriuOculto ? undefined : "revisao-travada"}
          onClick={() => aoRevisar({ acao: "manter" })}
        >
          {E4.manter}
        </ButtonUnv>
        {!abriuOculto && (
          <p id="revisao-travada" className="revisao__explicacao">
            {E4.manterTravado}
          </p>
        )}
        <ButtonUnv
          variant="primary"
          size="md"
          block
          disabled={enviando}
          leadingIcon={<IconUnv name="check" size={18} tone="inherit" />}
          onClick={() => {
            setNovo(null);
            setAreaDaTroca(chip);
            setTrocando(true);
          }}
        >
          {E4.confirmarRevisao}
        </ButtonUnv>
      </div>

      <BottomSheetUnv open={ficha !== null} modal title={E4.fichaTitulo} maxHeight="85%" onOpenChange={(o) => !o && setFicha(null)}>
        {ficha && (
          <div className="ficha">
            <h2 className="ficha__projeto">{ficha.titulo}</h2>
            <p className="ficha__escola">{ficha.escola}</p>
            {/* A faixa rola na horizontal: recebe foco para o teclado alcançar as
                fotos escondidas (WCAG 2.1.1, ADR-162). */}
            <div className="ficha__fotos" tabIndex={0} role="group" aria-label="Fotos do projeto">
              {[1, 2, 3].map((n) => {
                const estande = { projetoId: ficha.id, titulo: ficha.titulo, imagem: ficha.imagem, laminas: ficha.laminas };
                return (
                  <img
                    key={n}
                    className="ficha__imagem"
                    src={srcDaFoto(estande, n, paleta)}
                    alt={n === 1 || ficha.laminas?.[n === 2 ? "detalhe" : "equipe"] ? altDaFoto(estande, n, E2.altDaFoto) : ""}
                  />
                );
              })}
              {ficha.laminas?.bastidor && (
                <img className="ficha__imagem" src={ficha.laminas.bastidor} alt={E2.altDoBastidor(ficha.titulo)} />
              )}
            </div>
            <p className="ficha__resumo">{ficha.resumo}</p>
            <div className="ficha__hashtags">
              {ficha.hashtags.map((h) => (
                <BadgeUnv key={h} variant="neutral">
                  {comCerquilha(h)}
                </BadgeUnv>
              ))}
            </div>
            <ButtonUnv
              variant="secondary"
              size="md"
              block
              leadingIcon={<IconUnv name="back" size={18} tone="inherit" />}
              onClick={() => setFicha(null)}
            >
              {E4.voltar}
            </ButtonUnv>
          </div>
        )}
      </BottomSheetUnv>

      <BottomSheetUnv
        open={trocando}
        modal
        title={E4.revisao}
        maxHeight="88%"
        onOpenChange={(o) => !o && !enviando && setTrocando(false)}
      >
        <div className="cedula">
          <p className="cedula__instrucao">{E4.escolhaONovo}</p>
          <div className="galeria__chips" role="group" aria-label={E4.hashtags}>
            {categorias.map((c) => (
              <Chip
                key={c.area}
                selected={areaDaTroca === c.area}
                aria-pressed={areaDaTroca === c.area}
                onClick={() => setAreaDaTroca(c.area)}
              >
                {comCerquilha(c.hashtag)}
              </Chip>
            ))}
          </div>
          <Escolha
            rotulo={`${E4.grupoDaRevisao}: ${nomeDa(areaDaTroca)}`}
            valor={novo}
            desabilitada={enviando}
            aoEscolher={setNovo}
            opcoes={opcoesDaTroca(galeria.projetos, areaDaTroca, voto?.projetoId ?? null)
              .map((p) => ({
                id: p.id,
                titulo: p.titulo,
                subtitulo: p.escola,
                imagem: { src: srcDoEstande({ projetoId: p.id, titulo: p.titulo, imagem: p.imagem }, paleta), alt: "" },
              }))}
          />
          <div className="cedula__confirmar">
            <ButtonUnv
              variant="primary"
              size="lg"
              block
              disabled={novo === null || enviando}
              onClick={() => novo && aoRevisar({ acao: "trocar", projetoId: novo })}
            >
              {E4.confirmarRevisao}
            </ButtonUnv>
          </div>
        </div>
      </BottomSheetUnv>
    </div>
  );
}
