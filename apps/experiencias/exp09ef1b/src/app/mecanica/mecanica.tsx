import { useEffect, useState, type DragEvent, type ReactNode } from "react";
import { AlertBox, Button, Card, ProgressBar, PuzzleBlock, PuzzleTrack, SpeechBubble, Table, Tag, type TableColumn } from "@edu/ui/ds";
import { OCR_MS, descartar, devolver, mover, moverNaEsteira, noBanco, podeEnviar, podeRegistrar, porNaVerificacao, type Editor } from "../../lib/regras";
import { TEXTOS } from "../../lib/textos";
import type { BlocoId, Criterio, LinhaDaTabela, ProjetoId, ProjetoNaTela, Sessao } from "../../lib/tipos";

/**
 * A MECÂNICA da missão — os componentes de interface institucional que o PO
 * pediu no lugar de formulário (painel de deliberação com ranking arrastável,
 * revisão com botões institucionais, editor de protocolo com blocos
 * arrastáveis), Amara, o OCR e a tabela. Este arquivo importa SÓ a ponte
 * `@edu/ui/ds` (seção `unooria`; DS híbrido, ADR-202). Tokens `--unooria-*`.
 *
 * Arrastar é o gesto do PO; os botões (Subir/Descer, Mover para Lixeira) e o
 * toque (toca o bloco, toca a vaga) são a mesma ação para teclado e tablet.
 * (b) COMPENSAÇÃO — sem par no DS: o arrasto nativo (HTML5 drag) em volta do
 * `PuzzleBlock`, que só conhece toque (pedido: `draggable` no PuzzleBlock).
 */

type Tela = Sessao["textos"]["tela"];

/** Amara — só no Desafiar e no Explicar (one-pager §3). */
export function Amara({ children }: { children: ReactNode }) {
  return (
    <SpeechBubble speaker={`${TEXTOS.amara} (${TEXTOS.amaraPapel})`} avatarInitials="A" tone="guide" className="amara">
      {children}
    </SpeechBubble>
  );
}

/** O ranking de três critérios: arrastar, ou Subir/Descer. */
export function Ranking({
  ranking,
  rotulos,
  tela,
  onMudar,
  travado,
}: {
  ranking: Criterio[];
  rotulos: Record<Criterio, string>;
  tela: Tela;
  onMudar?: (novo: Criterio[]) => void;
  travado?: boolean;
}) {
  const [arrastando, setArrastando] = useState<number | null>(null);
  const soltar = (para: number) => (e: DragEvent) => {
    e.preventDefault();
    if (arrastando !== null && onMudar) onMudar(mover(ranking, arrastando, para));
    setArrastando(null);
  };
  return (
    <ol className="ranking" aria-label={tela.ordeneCriterios}>
      {ranking.map((c, i) => (
        <li
          key={c}
          className={`ranking__item${arrastando === i ? " ranking__item--arrastando" : ""}`}
          draggable={!travado}
          onDragStart={() => setArrastando(i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={soltar(i)}
          onDragEnd={() => setArrastando(null)}
          data-criterio={c}
        >
          <PuzzleBlock label={`${i + 1}º ${rotulos[c]}`} state={travado ? "locked" : "placed"} className="ranking__bloco" tabIndex={-1} />
          {!travado && onMudar && (
            <span className="ranking__botoes">
              <Button variant="ghost" size="sm" disabled={i === 0} onClick={() => onMudar(mover(ranking, i, i - 1))} aria-label={`${tela.subirCriterio}: ${rotulos[c]}`}>
                {tela.subirCriterio}
              </Button>
              <Button variant="ghost" size="sm" disabled={i === ranking.length - 1} onClick={() => onMudar(mover(ranking, i, i + 1))} aria-label={`${tela.descerCriterio}: ${rotulos[c]}`}>
                {tela.descerCriterio}
              </Button>
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

/** Os três projetos como rádio: marcar um põe os outros dois na "Fila de espera" (a verba é indivisível). */
function EscolhaDoProjeto({ projetos, projeto, tela, onEscolher }: { projetos: ProjetoNaTela[]; projeto: ProjetoId | null; tela: Tela; onEscolher: (p: ProjetoId) => void }) {
  return (
    <div className="projetos" role="radiogroup" aria-label={tela.deliberacao}>
      {projetos.map((p) => {
        const marcado = projeto === p.id;
        return (
          <Card
            key={p.id}
            variant={marcado ? "elevated" : "outlined"}
            className={`projeto${marcado ? " projeto--marcado" : ""}${projeto && !marcado ? " projeto--espera" : ""}`}
            role="radio"
            aria-checked={marcado}
            tabIndex={0}
            onClick={() => onEscolher(p.id)}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                onEscolher(p.id);
              }
            }}
            data-projeto={p.id}
          >
            <strong className="projeto__nome">{p.nome}</strong>
            <span className="projeto__meta">
              {p.vagas} vagas · {p.coordenador}
            </span>
            {marcado && <Tag variant="brand">{tela.selecionado}</Tag>}
            {projeto && !marcado && <Tag variant="neutral">{tela.filaDeEspera}</Tag>}
          </Card>
        );
      })}
    </div>
  );
}

/** O Painel de Deliberação Orçamentária (E3-ALU-01, o PICO): o projeto, o ranking e o "Registrar Decisão". */
export function PainelDeDeliberacao({
  projetos,
  ordemInicial,
  rotulos,
  tela,
  ocupado,
  onRegistrar,
}: {
  projetos: ProjetoNaTela[];
  ordemInicial: Criterio[];
  rotulos: Record<Criterio, string>;
  tela: Tela;
  ocupado: boolean;
  onRegistrar: (projeto: ProjetoId, ranking: Criterio[]) => void;
}) {
  const [projeto, setProjeto] = useState<ProjetoId | null>(null);
  const [ranking, setRanking] = useState<Criterio[]>(ordemInicial);
  const [tocado, setTocado] = useState(false);
  return (
    <Card variant="outlined" className="deliberacao" data-tela="E3-ALU-01">
      <p className="deliberacao__painel">{tela.painelTitulo}</p>
      <h2 className="deliberacao__titulo">{tela.deliberacao}</h2>
      <EscolhaDoProjeto projetos={projetos} projeto={projeto} tela={tela} onEscolher={setProjeto} />
      <p className="deliberacao__guia">{projeto && !tocado ? TEXTOS.reorganize : tela.ordeneCriterios}</p>
      <Ranking
        ranking={ranking}
        rotulos={rotulos}
        tela={tela}
        onMudar={(n) => {
          setRanking(n);
          setTocado(true);
        }}
      />
      <Button fullWidth size="lg" disabled={!podeRegistrar(projeto, tocado) || ocupado} onClick={() => projeto && onRegistrar(projeto, ranking)}>
        {tela.registrar}
      </Button>
    </Card>
  );
}

/** A leitura óptica dos cadernos (2 s: 0,8 + 1,2). Sem animação com `prefers-reduced-motion`; o tempo é o mesmo. */
export function LeituraOptica({ tela, onFim }: { tela: Tela; onFim: () => void }) {
  const [estagio, setEstagio] = useState<1 | 2>(1);
  useEffect(() => {
    const um = window.setTimeout(() => setEstagio(2), OCR_MS.estagio1);
    const dois = window.setTimeout(onFim, OCR_MS.estagio1 + OCR_MS.estagio2);
    return () => {
      window.clearTimeout(um);
      window.clearTimeout(dois);
    };
  }, [onFim]);
  return (
    <Card variant="outlined" className="ocr" data-tela="ocr" aria-live="polite">
      <strong>{TEXTOS.ocrTitulo}</strong>
      <ProgressBar value={estagio === 1 ? 45 : 85} max={100} label={estagio === 1 ? tela.ocr1 : tela.ocr2} showValue={false} />
      <span className="ocr__estagio">{estagio === 1 ? TEXTOS.ocrEstagio1 : TEXTOS.ocrEstagio2}</span>
    </Card>
  );
}

/** O confronto tabular (E4-ALU-02, o AHA): o projeto escolhido × o projeto em papel depois do OCR. */
export function TabelaDeConfronto({ linhas, tela, constatacao }: { linhas: LinhaDaTabela[]; tela: Tela; constatacao: string }) {
  type Linha = LinhaDaTabela & { projetoRotulo: string };
  const colunas: TableColumn<Linha>[] = [
    { key: "projetoRotulo", title: tela.colProjeto },
    { key: "documentos", title: tela.colDocumentos },
    { key: "vagas", title: tela.colVagas },
    { key: "custo", title: tela.colCusto },
  ];
  return (
    <Card variant="outlined" className="confronto" data-tela="E4-ALU-02">
      <Table<Linha> columns={colunas} data={linhas.map((l) => ({ ...l, projetoRotulo: `${l.nome} (${l.rotulo})` }))} keyExtractor={(l) => l.projeto} />
      <p className="confronto__constatacao">{constatacao}</p>
    </Card>
  );
}

/**
 * A revisão da decisão (E4-ALU-03, o 2º voto): a escolha da E3 congelada ao
 * lado, "Manter Decisão Original" ou "Revisar Decisão", o ranking (com a ordem
 * da E3; mexer é opcional) e "Confirmar Decisão Final". Sem o motivo
 * estruturado: era Canal B, e saiu (decisão do Lucas).
 */
export function RevisaoDoVoto({
  projetos,
  decisao,
  rotulos,
  tela,
  ocupado,
  onConfirmar,
}: {
  projetos: ProjetoNaTela[];
  decisao: { projeto: ProjetoId; ranking: Criterio[] };
  rotulos: Record<Criterio, string>;
  tela: Tela;
  ocupado: boolean;
  onConfirmar: (projeto: ProjetoId, ranking: Criterio[]) => void;
}) {
  const [modo, setModo] = useState<"manter" | "revisar" | null>(null);
  const [projeto, setProjeto] = useState<ProjetoId | null>(null);
  const [ranking, setRanking] = useState<Criterio[]>(decisao.ranking);
  const nomeAnterior = projetos.find((p) => p.id === decisao.projeto)?.nome ?? "";
  const escolhido = modo === "manter" ? decisao.projeto : projeto;
  return (
    <Card variant="outlined" className="revisao" data-tela="E4-ALU-03">
      <h2 className="deliberacao__titulo">{TEXTOS.revisaoTitulo}</h2>
      <div className="revisao__colunas">
        <Card variant="default" className="revisao__anterior">
          <Tag variant="neutral">{TEXTOS.documentoCongelado}</Tag>
          <strong>{tela.escolhaAnterior}</strong>
          <span>{TEXTOS.votoAnterior(nomeAnterior)}</span>
          <span>{TEXTOS.prioridade1(rotulos[decisao.ranking[0] as Criterio])}</span>
        </Card>
        <div className="revisao__nova">
          <div className="revisao__botoes">
            <Button variant={modo === "manter" ? "primary" : "outline"} onClick={() => setModo("manter")} aria-pressed={modo === "manter"}>
              {tela.manter}
            </Button>
            <Button variant={modo === "revisar" ? "primary" : "outline"} onClick={() => setModo("revisar")} aria-pressed={modo === "revisar"}>
              {tela.revisar}
            </Button>
          </div>
          {modo === "revisar" && (
            <>
              <p className="deliberacao__guia">{TEXTOS.selecioneFinal}</p>
              <EscolhaDoProjeto projetos={projetos} projeto={projeto} tela={tela} onEscolher={setProjeto} />
            </>
          )}
          {modo && (
            <>
              <p className="deliberacao__guia">{tela.ordeneCriterios}</p>
              <Ranking ranking={ranking} rotulos={rotulos} tela={tela} onMudar={setRanking} />
              <Button fullWidth size="lg" disabled={!escolhido || ocupado} onClick={() => escolhido && onConfirmar(escolhido, ranking)}>
                {tela.confirmarFinal}
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

/** A decisão final registrada (E4-ALU-03 "homologado"). */
export function DecisaoHomologada({ projeto, criterio }: { projeto: string; criterio: string }) {
  return <AlertBox variant="success" title={TEXTOS.homologada} description={TEXTOS.homologadaProjeto(projeto, criterio)} className="homologada" />;
}

/** A trava (E3-SIS-01, E4-ALU-04): "Parecer registrado. Aguardando autorização…". */
export function Espera({ texto, detalhe }: { texto?: string; detalhe?: string }) {
  return <AlertBox variant="info" title={texto} description={detalhe} className="espera" role="status" data-tela="espera" />;
}

/** O cartão dos conceitos do Explicar (E5-ALU-01). */
export function Conceitos({ resumo, conceitos }: { resumo: string; conceitos: { termo: string; definicao: string }[] }) {
  return (
    <Card variant="outlined" className="conceitos" data-tela="E5-ALU-01">
      <strong>{TEXTOS.conceitosTitulo}</strong>
      <p>{resumo}</p>
      <dl className="conceitos__lista">
        {conceitos.map((c) => (
          <div key={c.termo}>
            <dt>{c.termo}</dt>
            <dd>{c.definicao}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/**
 * O Editor de Protocolo da IA do Conselho (E5-ALU-02). Abre LIMPO: sem
 * demonstração, sem dica de descarte (correção do PO). Três verificações (uma
 * `PuzzleTrack` de uma vaga cada) e a Área de Descarte. "Enviar Proposta"
 * acende com ≥ 1 bloco na esteira — sem trava no cliente; a régua é do servidor.
 */
export function EditorDeProtocolo({
  banco,
  rotulos,
  tela,
  ocupado,
  onEnviar,
}: {
  banco: BlocoId[];
  rotulos: Record<BlocoId, string>;
  tela: Tela;
  ocupado: boolean;
  onEnviar: (e: Editor) => void;
}) {
  const [editor, setEditor] = useState<Editor>({ slots: [null, null, null], descarte: [] });
  const [escolhido, setEscolhido] = useState<BlocoId | null>(null);
  const [arrastando, setArrastando] = useState<BlocoId | null>(null);
  const livres = noBanco(banco, editor);
  const vagas = [tela.slot1, tela.slot2, tela.slot3] as string[];

  const naVaga = (vaga: number) => {
    const bloco = arrastando ?? escolhido;
    if (!bloco) return;
    setEditor((e) => porNaVerificacao(e, bloco, vaga));
    setEscolhido(null);
    setArrastando(null);
  };
  const naLixeira = (bloco: BlocoId | null) => {
    if (!bloco) return;
    setEditor((e) => descartar(e, bloco));
    setEscolhido(null);
    setArrastando(null);
  };
  const largavel = (aoSoltar: () => void) => ({
    onDragOver: (e: DragEvent) => e.preventDefault(),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      aoSoltar();
    },
  });

  return (
    <Card variant="outlined" className="editor" data-tela="E5-ALU-02">
      <h2 className="deliberacao__titulo">{tela.editorTitulo}</h2>
      <p className="deliberacao__guia">{tela.editorOrientacao}</p>
      <div className="editor__colunas">
        <section className="editor__banco" aria-label={TEXTOS.bancoDeRegras} {...largavel(() => arrastando && setEditor((e) => devolver(e, arrastando)))}>
          <h3 className="editor__rotulo">{TEXTOS.bancoDeRegras}</h3>
          <ul className="editor__lista">
            {livres.map((b) => (
              <li key={b} draggable onDragStart={() => setArrastando(b)} onDragEnd={() => setArrastando(null)} data-bloco={b}>
                <PuzzleBlock label={rotulos[b]} state="idle" selected={escolhido === b} onClick={() => setEscolhido(escolhido === b ? null : b)} className="editor__bloco" />
                <Button variant="ghost" size="sm" onClick={() => naLixeira(b)} aria-label={`${tela.moverParaLixeira}: ${rotulos[b]}`}>
                  {tela.moverParaLixeira}
                </Button>
              </li>
            ))}
          </ul>
        </section>
        <section className="editor__esteira" aria-label={TEXTOS.esteira}>
          <h3 className="editor__rotulo">{TEXTOS.esteira}</h3>
          {editor.slots.map((b, vaga) => (
            <div key={vaga} className="editor__vaga" data-vaga={vaga} {...largavel(() => naVaga(vaga))}>
              <PuzzleTrack
                label={vagas[vaga] ?? ""}
                showEmptySlotLabel
                emptySlotLabel={() => vagas[vaga] ?? ""}
                onSlotActivate={() => naVaga(vaga)}
                slotsDisabled={!escolhido && !arrastando && b === null}
                slots={[
                  b ? (
                    <span key={b} className="editor__encaixado" draggable onDragStart={() => setArrastando(b)} onDragEnd={() => setArrastando(null)} data-bloco={b}>
                      <PuzzleBlock label={rotulos[b]} state="placed" onClick={() => setEditor((e) => devolver(e, b))} />
                    </span>
                  ) : null,
                ]}
              />
              {b && (
                <span className="editor__botoes">
                  <Button variant="ghost" size="sm" disabled={vaga === 0} onClick={() => setEditor((e) => moverNaEsteira(e, vaga, -1))}>
                    {tela.subir}
                  </Button>
                  <Button variant="ghost" size="sm" disabled={vaga === 2} onClick={() => setEditor((e) => moverNaEsteira(e, vaga, 1))}>
                    {tela.descer}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => naLixeira(b)}>
                    {tela.moverParaLixeira}
                  </Button>
                </span>
              )}
            </div>
          ))}
          <div className="editor__descarte" data-descarte {...largavel(() => naLixeira(arrastando))}>
            <PuzzleTrack
              label={tela.descarte}
              showEmptySlotLabel
              emptySlotLabel={() => tela.descarte}
              onSlotActivate={() => naLixeira(escolhido)}
              slotsDisabled={!escolhido}
              slots={
                editor.descarte.length > 0
                  ? editor.descarte.map((d) => <PuzzleBlock key={d} label={rotulos[d]} state="returned" onClick={() => setEditor((e) => devolver(e, d))} />)
                  : [null]
              }
            />
          </div>
        </section>
      </div>
      <Button fullWidth size="lg" disabled={!podeEnviar(editor) || ocupado} onClick={() => onEnviar(editor)}>
        {tela.enviarProposta}
      </Button>
    </Card>
  );
}

/** O fim (E6-ALU-03, os autos encerrados): somente leitura. */
export function Conclusao({ tela, destino }: { tela: Tela; destino: string }) {
  return (
    <Card variant="outlined" className="conclusao" data-tela="concluida">
      <AlertBox variant="success" title={TEXTOS.autosEncerrados} description={TEXTOS.autosProtegidos} />
      <p className="conclusao__selo">{tela.concluida}</p>
      <ul className="conclusao__lista">
        <li>{TEXTOS.destinacaoFinal(destino)}</li>
        <li>{TEXTOS.protocoloSubmetido}</li>
      </ul>
    </Card>
  );
}
