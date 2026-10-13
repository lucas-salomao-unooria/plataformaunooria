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
import { casaComABusca, classificarBusca, comCerquilha, iniciais } from "../../lib/regras";
import { CONTAS, E4 } from "../../lib/textos";
import type {
  AcaoDaGaleria,
  Area,
  Categoria,
  Galeria as DadosDaGaleria,
  ProjetoDaGaleria,
  Voto,
} from "../../lib/tipos";
import { srcDaFoto, srcDoEstande, usePaleta } from "../componentes/midia";
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
 * - **O badge e o subtítulo usam o número REAL** desta sessão
 *   (`GaleriaSchema.invisibilidade`), na moldura da copy. Com a saturação, quem
 *   curte vê 11–12 de 16 fora (69–75%); quem não curte, o que a permanência deu.
 * - **A grade tem 3 colunas e cresce com os ocultos** (12 = 3×4). Cada
 *   miniatura tem o botão "Inspecionar Projeto", que abre a "Ficha Técnica de
 *   Auditoria" (folha modal, foco preso pelo DS, "Voltar à Galeria"). A
 *   abertura é registrada — é o que libera "Manter" e o que a EF06CO01 lê.
 * - **A busca e os chips** (as hashtags que a API mandou) filtram os
 *   DEZESSEIS: é assim que a criança descobre que os da área dela também
 *   estavam lá. Da busca, a api recebe só o TIPO e a área (texto de menor não
 *   sai do aparelho).
 * - **A revisão tem dois botões** (PRD v2): "Manter meu voto inicial", travado
 *   com a explicação até a criança abrir ao menos UM oculto, e "Confirmar Voto
 *   Revisado", que abre a lista para escolher o novo projeto.
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
  const [chip, setChip] = useState<Area | null>(null);
  const [ficha, setFicha] = useState<ProjetoDaGaleria | null>(null);
  const [trocando, setTrocando] = useState(false);
  const [novo, setNovo] = useState<string | null>(null);
  /* "Manter" destrava na hora do toque num oculto; o servidor confirma no latch (409 `galeria-sem-inspecao`). */
  const [abriuOculto, setAbriuOculto] = useState(galeria.podeManter);
  const ultimaBusca = useRef<string | null>(null);

  const porId = useMemo(() => new Map(galeria.projetos.map((p) => [p.id, p])), [galeria.projetos]);
  const doVoto = voto ? porId.get(voto.projetoId) : undefined;

  const buscando = chip !== null || texto.trim() !== "";
  const visiveis = galeria.projetos.filter((p) =>
    chip !== null ? p.area === chip : texto.trim() ? casaComABusca(p, texto, categorias) : !p.exibidoNoSeuFeed,
  );

  function registrarBusca(acao: Extract<AcaoDaGaleria, { tipo: "buscar" }>) {
    const chave = `${acao.busca}:${acao.area ?? "-"}`;
    if (chave === ultimaBusca.current) return;
    ultimaBusca.current = chave;
    aoAcao(acao);
  }

  // A busca por texto vale quando a digitação para.
  useEffect(() => {
    if (chip !== null) return;
    const relogio = window.setTimeout(() => {
      const classe = classificarBusca(texto, categorias, galeria.projetos);
      if (classe) registrarBusca({ tipo: "buscar", ...classe });
    }, PAUSA_DA_BUSCA_MS);
    return () => window.clearTimeout(relogio);
    // `registrarBusca` lê só refs e a prop estável `aoAcao`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, chip, categorias, galeria.projetos]);

  function tocarNoChip(area: Area) {
    if (chip === area) {
      setChip(null);
      return;
    }
    setChip(area);
    setTexto("");
    registrarBusca({ tipo: "buscar", busca: "hashtag", area });
  }

  function inspecionar(p: ProjetoDaGaleria) {
    setFicha(p);
    if (!p.exibidoNoSeuFeed) setAbriuOculto(true);
    aoAcao({ tipo: "abrir", projetoId: p.id });
  }

  const { ocultos, percentual } = galeria.invisibilidade;

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
          {E4.badge(percentual)}
        </InlineHint>
        <p className="galeria__subtitulo">{E4.subtitulo(ocultos)}</p>
        <SearchField
          block
          value={texto}
          placeholder={E4.busca}
          ariaLabel={E4.busca}
          clearable
          clearLabel={E4.limparBusca}
          onClear={() => setTexto("")}
          onChange={(e) => {
            setChip(null);
            setTexto(e.target.value);
          }}
        />
        <div className="galeria__chips" role="group" aria-label={E4.hashtags}>
          {categorias.map((c) => (
            <Chip key={c.area} selected={chip === c.area} aria-pressed={chip === c.area} onClick={() => tocarNoChip(c.area)}>
              {comCerquilha(c.hashtag)}
            </Chip>
          ))}
        </div>
        {buscando && (
          <p className="galeria__resultados" role="status">
            {E4.resultados(visiveis.length)}
          </p>
        )}
        <ul className="grade-oculta" aria-label={buscando ? E4.gradeBusca : E4.gradeOculta}>
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
              {[1, 2, 3].map((n) => (
                <img
                  key={n}
                  className="ficha__imagem"
                  src={srcDaFoto({ projetoId: ficha.id, titulo: ficha.titulo, imagem: ficha.imagem }, n, paleta)}
                  alt={n === 1 ? ficha.imagem.alt : ""}
                />
              ))}
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
          <Escolha
            rotulo={E4.grupoDaRevisao}
            valor={novo}
            desabilitada={enviando}
            aoEscolher={setNovo}
            opcoes={galeria.projetos
              .filter((p) => p.id !== voto?.projetoId)
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
