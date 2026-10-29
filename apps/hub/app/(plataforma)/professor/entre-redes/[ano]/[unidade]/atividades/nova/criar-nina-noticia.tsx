"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, FeedbackAlert, Icon, ProgressBar, Selection, Tag, TextArea, TextField } from "@edu/ui/ds";
import {
  AssistenteDeAtividade,
  type ResultadoDaCriacao,
  type TurmaDoAssistente,
} from "@/components/atividades/assistente-de-atividade";
import {
  COPY_DO_PREPARO,
  DICAS_DA_ESPERA,
  DISCIPLINAS,
  FALHA_DA_GERACAO,
  PARAMETROS,
  PARAMETROS_VAZIOS,
  ROTULO_DA_DISCIPLINA,
  ROTULO_DO_SUPORTE,
  SUPORTE_OMITIDO,
  caminhoDaTurma,
  caminhoDoBancoPadrao,
  caminhoDoPacote,
  corpoDosParametros,
  erroDaResposta,
  falhaDaIa,
  manchetesRepetidas,
  parametrosNaTela,
  problemaDaManchete,
  problemasDosParametros,
  rotuloDaDisciplina,
  textoDaFicha,
  type ChaveDaImagem,
  type ConteudoDoPacote,
  type MotivoDoBancoPadrao,
  type PacoteDetalhe,
  type PacoteHomologado,
  type ParametrosNaTela,
  type RascunhoDoPacote,
  type ReportagemRegenerada,
  type Suporte,
} from "@/lib/nina-noticia-tipos";

import { ImagensDaNina } from "../../resultados/imagens-da-nina";

const SEM_CONEXAO = "A conexão falhou. Tente de novo.";
/** A dica do carrossel de espera troca a cada 6 s. */
const TROCA_DA_DICA_MS = 6_000;

/** Os textos homologados (a fase 1): o pacote GRAVADO, de UMA turma, com as imagens que ele já tem. */
interface TextosHomologados {
  id: string;
  turmaId: string;
  conteudo: ConteudoDoPacote;
  imagens: Partial<Record<ChaveDaImagem, string>>;
  aprovadasEm: string | null;
}

/**
 * O banco padrão aplicado (`POST banco-padrao`): a atividade GRAVADA, fora do
 * ar, com os textos curados e as imagens do banco que já existem — e, desde a
 * ADR-199, em preparo: as imagens passam pela MESMA grade da IA.
 */
type BancoPadraoAplicado = TextosHomologados;

/**
 * NOVA ATIVIDADE de NINA E A NOTÍCIA QUE DESAPARECEU (ADR-197, ADR-130): o
 * preparo do pacote de notícias é o passo de conteúdo da criação, no molde do
 * Júri (`criar-juri-estadual.tsx`). Os quadros E0-PROF-02 a 05:
 *
 * 1. **O CAMINHO CURTO no topo** (E0-PROF-02): "Usar Banco Padrão" chama `POST
 *    banco-padrao` — um clique, a Feira de Troca de Livros, sem IA nos textos.
 *    As IMAGENS passam pela mesma grade da IA (ADR-199): as que o banco já tem
 *    chegam prontas, as que faltam se geram ali (de graça se o arquivo do
 *    pedido já existe; senão com a quota dela), "Refazer imagem" e "Aprovar
 *    imagens". Antes ela não via imagem nenhuma e dependia do `admin`.
 * 2. **Ou personalize com IA**: Componente Curricular (`Selection`), Tema do
 *    Evento (≤ 60) e "Assunto da matéria" (spec §7.2); "Gerar Notícias com IA"
 *    (`gerar-conteudo`, UMA chamada que escreve só o TEXTO das três
 *    reportagens — cabe no teto do BFF). Sem cota ou com a IA fora do ar a api
 *    responde 200 com o banco padrão (`usouIa: false`, `motivo`): o quadro
 *    E0-PROF-03 de erro, com "Carregar Banco Padrão" — o banco NÃO entra na
 *    conferência como se fosse o pacote gerado.
 * 3. **A conferência** (E0-PROF-04): os três cartões com a ficha à vista (a do
 *    telão com o Onde vazio, de propósito), "Editar Manchete" e "Regenerar
 *    Notícia" (`regenerar-reportagem`, uma por vez). A ESTRUTURA (suportes,
 *    fichas, lugar) é do servidor e não se edita aqui.
 * 4. **Duas fases** (ADR-146): "Homologar Pacote" grava os TEXTOS (`homologar`,
 *    pronto e fora do ar); depois as IMAGENS, que se geram sozinhas na grade
 *    `resultados/imagens-da-nina.tsx`, com a do telão em destaque ("confira se
 *    o pátio aparece") e "Refazer imagem"; "Aprovar imagens" fecha. Imagem de
 *    rascunho gastaria quota à toa — por isso os textos vão antes.
 * 5. **"Pacote homologado e pronto."** (E0-PROF-05): o assistente segue para as
 *    equipes, e o botão final "Liberar Atividade para a Turma" põe no ar E
 *    libera na sala (`concluirCriacao` + `liberarNaSala`).
 *
 * `gerar-conteudo` e `regenerar-reportagem` NÃO persistem: o rascunho vive aqui.
 */
export function CriarNinaNoticia({
  turmas,
  turmaInicial,
  rotaDaMissao,
}: {
  turmas: TurmaDoAssistente[];
  turmaInicial: string;
  rotaDaMissao: string;
}) {
  const [parametros, setParametros] = useState<ParametrosNaTela>(PARAMETROS_VAZIOS);
  const [preparoIniciadoEm] = useState(() => new Date().toISOString());
  const [bancoPadrao, setBancoPadrao] = useState<BancoPadraoAplicado | null>(null);
  const [aplicandoPadrao, setAplicandoPadrao] = useState(false);
  const [conteudo, setConteudo] = useState<ConteudoDoPacote | null>(null);
  const [editando, setEditando] = useState<Suporte | null>(null);
  const [gerando, setGerando] = useState(false);
  const [dica, setDica] = useState(0);
  const [regenerando, setRegenerando] = useState<Suporte | null>(null);
  const [falha, setFalha] = useState<MotivoDoBancoPadrao | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "success" | "warning"; texto: string } | null>(null);
  const [erro, setErro] = useState<{ mensagem: string; erros: string[] } | null>(null);
  const [homologados, setHomologados] = useState<TextosHomologados | null>(null);
  const [homologando, setHomologando] = useState(false);
  const [imagensAprovadas, setImagensAprovadas] = useState(false);
  const aoMudarAprovacao = useCallback((sim: boolean) => setImagensAprovadas(sim), []);

  /* O carrossel de dicas só gira enquanto a IA escreve. */
  useEffect(() => {
    if (!gerando) return;
    const id = setInterval(() => setDica((d) => (d + 1) % DICAS_DA_ESPERA.length), TROCA_DA_DICA_MS);
    return () => clearInterval(id);
  }, [gerando]);

  const errosDosParametros = problemasDosParametros(parametros);
  const parametrosValidos = Object.keys(errosDosParametros).length === 0;
  const problemasDasManchetes = new Map(
    (conteudo?.reportagens ?? []).map((r) => [r.suporte, problemaDaManchete(r.manchete)] as const),
  );
  const repetidas = conteudo ? manchetesRepetidas(conteudo) : false;
  const comProblema = [...problemasDasManchetes.values()].some(Boolean) || repetidas;
  const pronto = conteudo !== null && parametrosValidos && !comProblema;
  const ocupado = gerando || regenerando !== null || aplicandoPadrao || homologando;
  const erroDoCampo = (campo: "tema" | "assuntos") => (parametros[campo] ? errosDosParametros[campo] : undefined);

  function limparRecados() {
    setErro(null);
    setAviso(null);
    setFalha(null);
  }

  function trocarParametro(campo: keyof ParametrosNaTela, valor: string) {
    setParametros((atual) => ({ ...atual, [campo]: valor }));
  }

  /** "Usar Banco Padrão" / "Carregar Banco Padrão": a atividade pronta, sem IA, fora do ar. */
  async function usarBancoPadrao(turmaId: string) {
    setAplicandoPadrao(true);
    limparRecados();
    try {
      const r = await fetch(`/api/plataforma${caminhoDoBancoPadrao(turmaId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ porNoAr: false }),
      });
      if (!r.ok) {
        setErro(erroDaResposta(await r.json().catch(() => null), "Não deu para usar o banco padrão agora."));
        return;
      }
      const criado = (await r.json()) as PacoteHomologado;
      /* O detalhe traz os textos do banco (que só a api conhece), as imagens
         que ele já tem e se já estão aprovadas (o reaproveitado completo). */
      const detalhe = await fetch(`/api/plataforma${caminhoDoPacote(turmaId, criado.id)}`, { cache: "no-store" });
      if (!detalhe.ok) {
        setErro(erroDaResposta(await detalhe.json().catch(() => null), "O banco padrão foi aplicado, mas não deu para abrir as imagens."));
        return;
      }
      const lido = (await detalhe.json()) as PacoteDetalhe;
      setImagensAprovadas(false);
      setBancoPadrao({ id: criado.id, turmaId, conteudo: lido.conteudo, imagens: lido.imagens, aprovadasEm: lido.imagensAprovadasEm });
    } catch {
      setErro({ mensagem: SEM_CONEXAO, erros: [] });
    } finally {
      setAplicandoPadrao(false);
    }
  }

  async function gerar(turmaId: string) {
    if (!parametrosValidos) return;
    setGerando(true);
    setDica(0);
    limparRecados();
    try {
      const r = await fetch(`/api/plataforma${caminhoDaTurma(turmaId)}/gerar-conteudo`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpoDosParametros(parametros)),
      });
      const corpo: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        const { codigo, mensagem } = erroDaResposta(corpo, "O gerador não respondeu. Tente de novo.");
        const tipo = falhaDaIa(r.status, codigo);
        if (tipo) setFalha(tipo);
        else setErro({ mensagem, erros: [] });
        return;
      }
      const rascunho = corpo as RascunhoDoPacote;
      if (!rascunho.usouIa) {
        /* Sem cota ou sem IA: o conteúdo é o banco padrão. Ele não entra na
           conferência como se fosse o pacote gerado — o botão o aplica inteiro. */
        setFalha(rascunho.motivo ?? "ia-indisponivel");
        return;
      }
      setParametros(parametrosNaTela(rascunho.parametros));
      setConteudo(rascunho.conteudo);
      setEditando(null);
    } catch {
      setErro({ mensagem: SEM_CONEXAO, erros: [] });
    } finally {
      setGerando(false);
    }
  }

  function mudarManchete(suporte: Suporte, manchete: string) {
    setConteudo((atual) =>
      atual ? { ...atual, reportagens: atual.reportagens.map((r) => (r.suporte === suporte ? { ...r, manchete } : r)) } : atual,
    );
  }

  async function regenerar(turmaId: string, suporte: Suporte) {
    if (!conteudo) return;
    if (!parametrosValidos) {
      setErro({ mensagem: "Para regenerar uma notícia, preencha o componente, o tema e o assunto da matéria.", erros: [] });
      return;
    }
    setRegenerando(suporte);
    limparRecados();
    try {
      const r = await fetch(`/api/plataforma${caminhoDaTurma(turmaId)}/regenerar-reportagem`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...corpoDosParametros(parametros), conteudo, suporte }),
      });
      const corpo: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        const { codigo, mensagem } = erroDaResposta(corpo, "Não deu para regenerar agora. Tente de novo em instantes.");
        const tipo = falhaDaIa(r.status, codigo);
        if (tipo) setAviso({ tipo: "warning", texto: `${FALHA_DA_GERACAO[tipo].titulo} A notícia ficou como estava.` });
        else setErro({ mensagem, erros: [] });
        return;
      }
      const { reportagem, usouIa } = corpo as ReportagemRegenerada;
      if (!usouIa) {
        setAviso({ tipo: "warning", texto: "A inteligência artificial não respondeu desta vez, e a notícia ficou como estava." });
        return;
      }
      setConteudo((atual) =>
        atual ? { ...atual, reportagens: atual.reportagens.map((x) => (x.suporte === suporte ? reportagem : x)) } : atual,
      );
      setEditando(null);
      setAviso({ tipo: "success", texto: `Notícia do ${ROTULO_DO_SUPORTE[suporte]} regenerada. Leia de novo antes de homologar.` });
    } catch {
      setErro({ mensagem: SEM_CONEXAO, erros: [] });
    } finally {
      setRegenerando(null);
    }
  }

  /** A FASE 1: grava os textos como a professora os deixou, e as imagens começam. */
  async function homologar(turmaId: string) {
    if (!conteudo) return;
    setHomologando(true);
    limparRecados();
    try {
      const r = await fetch(`/api/plataforma${caminhoDaTurma(turmaId)}/homologar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ parametros: corpoDosParametros(parametros), conteudo, preparoIniciadoEm }),
      });
      if (!r.ok) {
        setErro(erroDaResposta(await r.json().catch(() => null), "Não deu para homologar o pacote agora."));
        return;
      }
      const criado = (await r.json()) as PacoteHomologado;
      /* O detalhe traz as imagens que o pacote JÁ tem (o mesmo conteúdo
         devolve o próprio pacote, que pode já estar aprovado). */
      const detalhe = await fetch(`/api/plataforma${caminhoDoPacote(turmaId, criado.id)}`, { cache: "no-store" });
      const lido = detalhe.ok ? ((await detalhe.json()) as PacoteDetalhe) : null;
      setImagensAprovadas(false);
      setEditando(null);
      setHomologados({
        id: criado.id,
        turmaId,
        conteudo: lido?.conteudo ?? conteudo,
        imagens: lido?.imagens ?? {},
        aprovadasEm: lido?.imagensAprovadasEm ?? null,
      });
    } catch {
      setErro({ mensagem: SEM_CONEXAO, erros: [] });
    } finally {
      setHomologando(false);
    }
  }

  /** O "Liberar Atividade para a Turma" do assistente: o pacote já está gravado. */
  async function criar(turmaId: string): Promise<ResultadoDaCriacao> {
    if (bancoPadrao) {
      if (bancoPadrao.turmaId !== turmaId) {
        return { ok: false, mensagem: "O banco padrão foi aplicado para outra turma. Volte a ela ou aplique de novo.", erros: [] };
      }
      return imagensAprovadas
        ? { ok: true, id: bancoPadrao.id }
        : { ok: false, mensagem: "Aprove as imagens do banco padrão antes de liberar a atividade.", erros: [] };
    }
    if (!homologados || homologados.turmaId !== turmaId || !imagensAprovadas) {
      return { ok: false, mensagem: "Homologue o pacote e aprove as imagens desta turma antes de liberar a atividade.", erros: [] };
    }
    return { ok: true, id: homologados.id };
  }

  function recomecar() {
    setBancoPadrao(null);
    setHomologados(null);
    setImagensAprovadas(false);
  }

  const outraTurma = (
    <FeedbackAlert
      type="warning"
      description={
        <span className="flex flex-col items-start gap-2">
          <span>Este pacote foi preparado para outra turma. Volte à turma anterior, ou recomece o preparo para esta.</span>
          <Button variant="secondary" size="sm" onClick={recomecar} data-acao="recomecar-preparo">
            Recomeçar o preparo
          </Button>
        </span>
      }
    />
  );

  return (
    <AssistenteDeAtividade
      expId="exp03ef1b"
      rotaDaMissao={rotaDaMissao}
      turmas={turmas}
      turmaInicial={turmaInicial}
      conteudoPronto={(bancoPadrao !== null || homologados !== null) && imagensAprovadas}
      resumoDoConteudo={
        bancoPadrao
          ? "Banco padrão · Feira de Troca de Livros · três notícias, com as imagens aprovadas"
          : homologados
            ? `“${homologados.conteudo.tema}” · ${rotuloDaDisciplina(parametros.disciplina)} · três notícias, com os textos e as imagens aprovados`
            : null
      }
      rotuloDoCriar={(porNoAr) => (porNoAr ? COPY_DO_PREPARO.liberar : "Criar atividade")}
      criar={criar}
      conteudo={(turmaId) =>
        bancoPadrao ? (
          <Card variant="outlined" title={COPY_DO_PREPARO.tituloDaAtivacao}>
            <div className="flex flex-col gap-3" data-preparo-nina data-fase="banco-padrao">
              {bancoPadrao.turmaId !== turmaId ? (
                outraTurma
              ) : (
                <>
                  <p className="max-w-3xl text-[13px] leading-relaxed text-unooria-neutral-700">
                    As três notícias da Feira de Troca de Livros são o pacote curado padrão, sem uso de IA, e a atividade
                    está gravada, ainda fora do ar. Agora as imagens: as que o banco já tem chegam prontas, e as que
                    faltam são geradas aqui.{" "}
                    <strong>Nenhuma imagem gerada por inteligência artificial é exibida aos estudantes sem a sua aprovação.</strong>
                  </p>
                  <ImagensDaNina
                    key={bancoPadrao.id}
                    turmaId={turmaId}
                    pacoteId={bancoPadrao.id}
                    conteudo={bancoPadrao.conteudo}
                    imagensIniciais={bancoPadrao.imagens}
                    aprovadasEmInicial={bancoPadrao.aprovadasEm}
                    podeEditar
                    gerarAoAbrir
                    aoMudarAprovacao={aoMudarAprovacao}
                    moldura={false}
                  />
                  {imagensAprovadas ? (
                    <PacotePronto
                      tema="Feira de Troca de Livros"
                      detalhe="O pacote curado padrão, com as três notícias da feira, sem uso de IA nos textos, e as imagens aprovadas."
                      aoRecomecar={recomecar}
                    />
                  ) : null}
                </>
              )}
            </div>
          </Card>
        ) : homologados ? (
          <Card variant="outlined" title={COPY_DO_PREPARO.tituloDaConferencia}>
            <div className="flex flex-col gap-4" data-preparo-nina data-fase="imagens">
              <p className="text-[13px] font-semibold text-unooria-neutral-950" data-fase-da-aprovacao>
                Fase 2 de 2: as imagens
              </p>
              {homologados.turmaId !== turmaId ? (
                outraTurma
              ) : (
                <>
                  <p className="max-w-3xl text-[13px] leading-relaxed text-unooria-neutral-700">
                    Os textos de “{homologados.conteudo.tema}” estão homologados e a atividade está gravada, ainda fora do
                    ar. Agora as imagens:{" "}
                    <strong>nenhuma imagem gerada por inteligência artificial é exibida aos estudantes sem a sua aprovação.</strong>
                  </p>
                  <ImagensDaNina
                    key={homologados.id}
                    turmaId={turmaId}
                    pacoteId={homologados.id}
                    conteudo={homologados.conteudo}
                    imagensIniciais={homologados.imagens}
                    aprovadasEmInicial={homologados.aprovadasEm}
                    podeEditar
                    gerarAoAbrir
                    aoMudarAprovacao={aoMudarAprovacao}
                    moldura={false}
                  />
                  {imagensAprovadas ? (
                    <PacotePronto
                      tema={homologados.conteudo.tema}
                      detalhe="Os textos e as imagens estão aprovados."
                      aoRecomecar={recomecar}
                    />
                  ) : null}
                </>
              )}
            </div>
          </Card>
        ) : (
          <Card variant="outlined" title={COPY_DO_PREPARO.tituloDoRecorte}>
            <div className="flex flex-col gap-5" data-preparo-nina data-fase="textos">
              {/* O CAMINHO CURTO (E0-PROF-02): no topo e em destaque, antes de qualquer campo. */}
              <div
                className="flex flex-col gap-3 rounded-lg border-2 border-unooria-neutral-950 bg-unooria-neutral-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                data-caminho-curto
              >
                <div className="flex flex-col gap-1">
                  <p className="text-[15px] font-semibold text-unooria-neutral-950">{COPY_DO_PREPARO.caminhoCurto}</p>
                  <p className="text-[13px] text-unooria-neutral-700">{COPY_DO_PREPARO.descricaoDoCaminhoCurto}</p>
                  <p className="text-[12px] text-unooria-neutral-600">{COPY_DO_PREPARO.apoioDoBancoPadrao}</p>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={<Icon name="inventory_2" size={18} />}
                  onClick={() => void usarBancoPadrao(turmaId)}
                  isDisabled={ocupado}
                  isLoading={aplicandoPadrao}
                  data-acao="usar-banco-padrao"
                >
                  {COPY_DO_PREPARO.botaoPadrao}
                </Button>
              </div>

              {/* ─────────────────────────────── personalizar com IA ───── */}
              <div className="flex flex-col gap-3 border-t border-unooria-neutral-200 pt-4">
                <p className="text-[14px] font-semibold text-unooria-neutral-950">{COPY_DO_PREPARO.personalizar}</p>
                <p className="max-w-3xl text-[13px] leading-relaxed text-unooria-neutral-700">
                  {COPY_DO_PREPARO.explicacaoDoRecorte}{" "}
                  <strong>Nenhum texto gerado por inteligência artificial é exibido aos estudantes sem a sua aprovação.</strong>
                </p>
                <div className="grid gap-3 lg:grid-cols-2">
                  <Selection
                    label={COPY_DO_PREPARO.rotuloDaDisciplina}
                    placeholder="Selecione"
                    value={parametros.disciplina || undefined}
                    showOptionCheckbox={false}
                    options={DISCIPLINAS.map((d) => ({ value: d, label: ROTULO_DA_DISCIPLINA[d] }))}
                    onChange={(valor) => trocarParametro("disciplina", Array.isArray(valor) ? (valor[0] ?? "") : String(valor))}
                  />
                  <TextField
                    label={COPY_DO_PREPARO.rotuloDoTema}
                    placeholder="Feira de Troca de Livros"
                    helperText={erroDoCampo("tema") ? undefined : COPY_DO_PREPARO.ajudaDoTema}
                    value={parametros.tema}
                    maxLength={PARAMETROS.tema.max}
                    error={erroDoCampo("tema")}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => trocarParametro("tema", e.target.value)}
                  />
                </div>
                <TextArea
                  label={COPY_DO_PREPARO.rotuloDosAssuntos}
                  placeholder="notícia escolar, suportes de comunicação, local do evento"
                  helperText={erroDoCampo("assuntos") ? undefined : COPY_DO_PREPARO.ajudaDosAssuntos}
                  value={parametros.assuntos}
                  rows={2}
                  maxLength={PARAMETROS.assuntos.max}
                  error={erroDoCampo("assuntos")}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => trocarParametro("assuntos", e.target.value)}
                />
                <div>
                  <Button
                    variant="ai"
                    size="md"
                    leftIcon={<Icon name="auto_awesome" size={18} />}
                    onClick={() => void gerar(turmaId)}
                    isDisabled={ocupado || !parametrosValidos}
                    data-acao="gerar-noticias"
                  >
                    {gerando ? "Gerando…" : COPY_DO_PREPARO.botaoGerar}
                  </Button>
                </div>
                {gerando ? (
                  <div className="flex flex-col gap-2" data-gerando-noticias>
                    <ProgressBar indeterminate label={COPY_DO_PREPARO.gerando} variant="brand" />
                    <p className="text-[12px] text-unooria-neutral-600">{COPY_DO_PREPARO.espera}</p>
                    <p className="max-w-3xl text-[12px] italic text-unooria-neutral-700" aria-live="polite" data-dica-da-espera>
                      Dica: {DICAS_DA_ESPERA[dica]}
                    </p>
                  </div>
                ) : null}
              </div>

              {/* E0-PROF-03: sem cota ou sem IA — o banco padrão em um clique. */}
              {falha ? (
                <div data-falha-da-ia={falha} aria-live="polite">
                  <FeedbackAlert
                    type={falha === "sem-saldo-de-ia" ? "warning" : "error"}
                    title={FALHA_DA_GERACAO[falha].titulo}
                    description={FALHA_DA_GERACAO[falha].texto}
                    action={
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => void usarBancoPadrao(turmaId)}
                        isDisabled={ocupado}
                        isLoading={aplicandoPadrao}
                        data-acao="carregar-banco-padrao"
                      >
                        {COPY_DO_PREPARO.botaoContingencia}
                      </Button>
                    }
                  />
                </div>
              ) : null}
              {aviso ? <FeedbackAlert type={aviso.tipo} description={aviso.texto} /> : null}
              {erro ? (
                <FeedbackAlert
                  type="error"
                  description={
                    erro.erros.length > 0 ? (
                      <span className="flex flex-col gap-1">
                        <span>{erro.mensagem}</span>
                        <ul className="list-disc pl-5">
                          {erro.erros.map((e) => (
                            <li key={e}>{e}</li>
                          ))}
                        </ul>
                      </span>
                    ) : (
                      erro.mensagem
                    )
                  }
                />
              ) : null}

              {/* ─────────────────────────────── a conferência (E0-PROF-04) ───── */}
              {conteudo ? (
                <div className="flex flex-col gap-3 border-t border-unooria-neutral-200 pt-4" data-conferencia-do-pacote>
                  <p className="text-[13px] font-semibold text-unooria-neutral-950" data-fase-da-aprovacao>
                    Fase 1 de 2: os textos
                  </p>
                  <div className="flex flex-col gap-1">
                    <p className="text-[16px] font-semibold text-unooria-neutral-950">{COPY_DO_PREPARO.tituloDaConferencia}</p>
                    <p className="text-[13px] text-unooria-neutral-700">{COPY_DO_PREPARO.instrucaoCurta}</p>
                    <p className="max-w-3xl text-[12px] leading-snug text-unooria-neutral-600">
                      {COPY_DO_PREPARO.instrucaoDaConferencia}
                    </p>
                  </div>
                  {repetidas ? (
                    <p className="text-[12px] text-unooria-danger" role="status">
                      As manchetes se repetem: cada notícia precisa de uma manchete própria.
                    </p>
                  ) : null}
                  <ul className="grid gap-4 lg:grid-cols-3" aria-label="As três notícias do pacote">
                    {conteudo.reportagens.map((r) => {
                      const destaque = r.suporte === SUPORTE_OMITIDO;
                      const problema = problemasDasManchetes.get(r.suporte) ?? null;
                      return (
                        <li
                          key={r.suporte}
                          className={`flex flex-col gap-2 rounded-lg p-4 ${
                            destaque ? "border-2 border-dashed border-unooria-neutral-950" : "border border-unooria-neutral-200"
                          }`}
                          data-reportagem={r.suporte}
                        >
                          <span className="text-[12px] font-semibold uppercase tracking-wide text-unooria-neutral-600">
                            {ROTULO_DO_SUPORTE[r.suporte]}
                          </span>
                          {editando === r.suporte ? (
                            <TextField
                              label="Manchete"
                              value={r.manchete}
                              maxLength={40}
                              error={problema ?? undefined}
                              helperText={problema ? undefined : "Até quatro palavras."}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => mudarManchete(r.suporte, e.target.value)}
                            />
                          ) : (
                            <p className="text-[16px] font-semibold leading-snug text-unooria-neutral-950">{r.manchete}</p>
                          )}
                          {problema && editando !== r.suporte ? (
                            <p className="text-[12px] text-unooria-danger">{problema}</p>
                          ) : null}
                          <p className="text-[13px] leading-snug text-unooria-neutral-700">{r.legenda}</p>
                          {destaque ? (
                            <Tag variant="warning" size="sm">
                              Ficha: Onde vazio, de propósito
                            </Tag>
                          ) : null}
                          <p className="text-[12px] text-unooria-neutral-600">Ficha: {textoDaFicha(r.ficha)}</p>
                          <p className="text-[12px] leading-snug text-unooria-neutral-600">
                            <span className="font-semibold">A foto vai mostrar:</span> {r.imagem.descricao}
                          </p>
                          {destaque ? (
                            <p className="text-[12px] font-semibold leading-snug text-unooria-neutral-950">
                              {COPY_DO_PREPARO.destaqueDoTelao}
                            </p>
                          ) : null}
                          <div className="mt-auto flex flex-wrap gap-2 pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              leftIcon={<Icon name="edit" size={16} />}
                              onClick={() => setEditando((atual) => (atual === r.suporte ? null : r.suporte))}
                              isDisabled={ocupado}
                              data-acao="editar-manchete"
                            >
                              {editando === r.suporte ? "Concluir edição" : COPY_DO_PREPARO.editarManchete}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              leftIcon={<Icon name="refresh" size={16} />}
                              onClick={() => void regenerar(turmaId, r.suporte)}
                              isDisabled={ocupado}
                              isLoading={regenerando === r.suporte}
                              data-acao="regenerar-noticia"
                            >
                              {COPY_DO_PREPARO.regenerarNoticia}
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="flex flex-wrap items-center gap-3 border-t border-unooria-neutral-200 pt-4">
                    <Button
                      variant="primary"
                      size="md"
                      leftIcon={<Icon name="check" size={18} />}
                      onClick={() => void homologar(turmaId)}
                      isDisabled={!pronto || ocupado}
                      isLoading={homologando}
                      data-acao="homologar-pacote"
                    >
                      {COPY_DO_PREPARO.homologar}
                    </Button>
                    <span className="text-[12px] text-unooria-neutral-600">
                      Os textos ficam gravados e as imagens começam a ser geradas. Depois disso, os textos não mudam aqui.
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
        )
      }
    />
  );
}

/** E0-PROF-05: "Pacote homologado e pronto." — o assistente segue para as equipes e para o "Liberar". */
function PacotePronto({ tema, detalhe, aoRecomecar }: { tema: string; detalhe: string; aoRecomecar: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-unooria-neutral-200 p-4" data-pacote-pronto>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[16px] font-semibold text-unooria-neutral-950">Nina e a Notícia que Desapareceu · {tema}</p>
        <Tag variant="success" size="sm">
          Pacote pronto
        </Tag>
      </div>
      <FeedbackAlert type="success" description={`${COPY_DO_PREPARO.pacotePronto} ${detalhe}`} />
      <p className="max-w-3xl text-[13px] leading-relaxed text-unooria-neutral-700">
        {COPY_DO_PREPARO.instrucaoDaAtivacao} Continue para escolher como a turma se senta; o botão final libera a
        atividade e a missão na sala de aula.
      </p>
      <div>
        <Button variant="secondary" size="sm" onClick={aoRecomecar} data-acao="recomecar-preparo">
          Recomeçar o preparo
        </Button>
      </div>
    </div>
  );
}
