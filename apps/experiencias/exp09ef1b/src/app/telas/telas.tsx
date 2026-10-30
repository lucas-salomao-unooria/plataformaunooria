import { useCallback, useState } from "react";
import { api } from "../../lib/api";
import { primeiroCriterio } from "../../lib/regras";
import { telemetria } from "../../lib/telemetria";
import { TEXTOS } from "../../lib/textos";
import type { AncoraId, Criterio, PilulaId, ProjetoId, Sessao } from "../../lib/tipos";
import type { Executar } from "../../App";
import { AcaoDoApp, CartoesDosProjetos, Entrada, FalaDoAssistente, ModalDoAnexo, PilulasDirigidas, Thread, Workspace } from "../clone/clone";
import { Amara, Conceitos, Conclusao, DecisaoHomologada, EditorDeProtocolo, Espera, LeituraOptica, PainelDeDeliberacao, RevisaoDoVoto, TabelaDeConfronto } from "../mecanica/mecanica";

/**
 * As TELAS — compõem as peças do clone (`../clone`, `unooriaai`) e da
 * mecânica (`../mecanica`, `unooria`) e não importam o DS direto (DS híbrido,
 * ADR-202). O passo vem do servidor; o que é local é só o que a tela segura
 * entre um toque e a rota (o painel aberto, o OCR rodando, o editor aberto).
 */

interface Props {
  s: Sessao;
  semRede: boolean;
  executar: Executar;
}

/** O anexo aberto e o modal — o mesmo em toda tela com a thread. */
function useAnexo(s: Sessao) {
  const [arquivo, setArquivo] = useState<string | null>(null);
  const documento = s.conteudo?.projetos.flatMap((p) => p.documentos).find((d) => d.arquivo === arquivo) ?? null;
  const modal = (
    <ModalDoAnexo tela={s.textos.tela} arquivo={arquivo} documento={documento} cadernos={s.conteudo?.cadernos ?? null} onFechar={() => setArquivo(null)} />
  );
  return { abrir: setArquivo, modal };
}

/** Sem pacote no ar: a espera na voz da comissão. */
export function TelaSemPacote({ s, semRede }: { s: Sessao; semRede: boolean }) {
  return (
    <Workspace tela={s.textos.tela} semRede={semRede}>
      <Espera texto={TEXTOS.esperaDoPacote} />
    </Workspace>
  );
}

/** E1-ALU-01 — a convocação: Amara (sem spoiler), os três cartões, as pílulas e "Começar Análise". */
export function TelaAbertura({ s, semRede, executar }: Props) {
  const [ocupado, setOcupado] = useState(false);
  const comecar = async (pergunta?: string) => {
    if (ocupado) return;
    setOcupado(true);
    const aberta = await executar(api.entrar);
    if (aberta && pergunta) {
      telemetria.pergunta(pergunta.length);
      await executar(() => api.mensagem(pergunta));
    }
    setOcupado(false);
  };
  return (
    <Workspace
      tela={s.textos.tela}
      semRede={semRede}
      rodape={
        <>
          <Entrada tela={s.textos.tela} sugestoes={s.textos.sugestoes} ativo={false} enviando={ocupado} onEnviar={(t) => void comecar(t)} />
          <AcaoDoApp grande onClick={() => void comecar()} disabled={ocupado}>
            {s.textos.tela.comecar}
          </AcaoDoApp>
        </>
      }
    >
      <Amara>{s.textos.amara}</Amara>
      {s.conteudo && <CartoesDosProjetos projetos={s.conteudo.projetos} />}
    </Workspace>
  );
}

/**
 * E2 e E3 — a conversa com o assistente (E2-ALU-01), a oferta e o OCR dos
 * cadernos (E2-ALU-02), os metadados (E2-SIS-01) e o Painel de Deliberação
 * (E3-ALU-01), que abre dentro da thread no "Escolher Projeto".
 */
export function TelaConversa({ s, semRede, executar }: Props) {
  const [pendente, setPendente] = useState<string | null>(null);
  const [ocr, setOcr] = useState(false);
  const [deliberando, setDeliberando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const anexo = useAnexo(s);
  const c = s.chat;
  const ofertaAberta = c.cadernosOferecidos && !c.cadernosDigitalizados;

  async function enviar(texto: string) {
    const t = texto.trim();
    if (!t || pendente) return;
    telemetria.pergunta(t.length);
    setPendente(t);
    await executar(() => api.mensagem(t));
    setPendente(null);
  }

  const fimDoOcr = useCallback(async () => {
    const nova = await executar(api.digitalizar);
    if (nova) telemetria.digitalizou("E2");
    setOcr(false);
  }, [executar]);

  async function registrar(projeto: ProjetoId, ranking: Criterio[]) {
    setOcupado(true);
    const nova = await executar(() => api.decidir(projeto, ranking));
    if (nova) telemetria.decidiu(projeto, nova.caminho);
    setOcupado(false);
  }

  return (
    <Workspace
      tela={s.textos.tela}
      semRede={semRede}
      rodape={
        deliberando ? undefined : (
          <>
            <Entrada
              tela={s.textos.tela}
              sugestoes={c.sugestoesVisiveis ? s.textos.sugestoes : null}
              ativo={!c.limiteAtingido && !ocr}
              enviando={pendente !== null}
              onEnviar={(t) => void enviar(t)}
            />
            <div className="uai-acoes">
              {!c.podeEscolher && (
                <AcaoDoApp variante="outline" onClick={() => void executar(api.verProjetos)} disabled={ocr}>
                  {s.textos.tela.verProjetos}
                </AcaoDoApp>
              )}
              {c.podeEscolher && (
                <AcaoDoApp grande onClick={() => setDeliberando(true)} disabled={ocr}>
                  {s.textos.tela.escolherProjeto}
                </AcaoDoApp>
              )}
            </div>
          </>
        )
      }
    >
      <Amara>{s.textos.amara}</Amara>
      <Thread mensagens={c.mensagens} pendente={pendente} digitando={s.textos.tela.digitando} onAnexo={anexo.abrir} />
      {ofertaAberta && !ocr && (
        <div className="uai-acoes" data-tela="oferta-dos-cadernos">
          <AcaoDoApp onClick={() => setOcr(true)}>{s.textos.tela.digitalizar}</AcaoDoApp>
        </div>
      )}
      {ocr && <LeituraOptica tela={s.textos.tela} onFim={() => void fimDoOcr()} />}
      {c.cadernosDigitalizados && (
        <p className="uai-nota" role="status">
          {TEXTOS.caminhoA1}
        </p>
      )}
      {deliberando && s.conteudo && (
        <PainelDeDeliberacao
          projetos={s.conteudo.projetos}
          ordemInicial={s.ordemDosCriterios}
          rotulos={s.textos.criterios}
          tela={s.textos.tela}
          ocupado={ocupado}
          onRegistrar={(p, r) => void registrar(p, r)}
        />
      )}
      {anexo.modal}
    </Workspace>
  );
}

/** E3-SIS-01 e E4-ALU-04 — a trava: a thread fica, inerte, sob o aviso da presidência da mesa. */
export function TelaEspera({ s, semRede }: { s: Sessao; semRede: boolean }) {
  const anexo = useAnexo(s);
  const nome = (p: ProjetoId) => s.conteudo?.projetos.find((x) => x.id === p)?.nome ?? "";
  return (
    <Workspace tela={s.textos.tela} semRede={semRede}>
      <div className="trava" inert>
        <Thread mensagens={s.chat.mensagens} onAnexo={anexo.abrir} />
      </div>
      {s.revoto && <DecisaoHomologada projeto={nome(s.revoto.projeto)} criterio={s.textos.criterios[primeiroCriterio(s.revoto.ranking) ?? "urgencia"]} />}
      <Espera texto={s.textos.tela.espera} detalhe={TEXTOS.emEspera} />
    </Workspace>
  );
}

/**
 * E4 — a revelação: o aviso e o OCR dos cadernos (B e A2, E4-ALU-01) ou o
 * contrafactual (A1), a tabela e as pílulas dirigidas (E4-ALU-02) e, depois da
 * trava do DEBATE, a revisão da decisão (E4-ALU-03).
 */
export function TelaRevelacao({ s, semRede, executar }: Props) {
  const [ocr, setOcr] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const anexo = useAnexo(s);
  const r = s.revelacao;
  const digitalizou = s.chat.cadernosDigitalizados;

  const fimDoOcr = useCallback(async () => {
    const nova = await executar(api.digitalizar);
    if (nova) telemetria.digitalizou("E4");
    setOcr(false);
  }, [executar]);

  async function pilula(id: PilulaId) {
    const nova = await executar(() => api.pilula(id));
    if (nova) telemetria.pilula(id);
  }

  async function confirmar(projeto: ProjetoId, ranking: Criterio[]) {
    setOcupado(true);
    const nova = await executar(() => api.revotar(projeto, ranking));
    if (nova?.revoto) telemetria.revotou(projeto, nova.revoto.manteve);
    setOcupado(false);
  }

  return (
    <Workspace tela={s.textos.tela} semRede={semRede}>
      <Thread mensagens={s.chat.mensagens} onAnexo={anexo.abrir} />
      {!digitalizou && !ocr && (
        <div data-tela="E4-ALU-01">
          <FalaDoAssistente>{s.textos.tela.aviso}</FalaDoAssistente>
          <div className="uai-acoes">
            <AcaoDoApp grande onClick={() => setOcr(true)}>
              {s.textos.tela.digitalizar}
            </AcaoDoApp>
          </div>
        </div>
      )}
      {ocr && <LeituraOptica tela={s.textos.tela} onFim={() => void fimDoOcr()} />}
      {digitalizou && r && (
        <>
          {r.contrafactual && <FalaDoAssistente titulo={TEXTOS.contrafactualTitulo}>{r.contrafactual}</FalaDoAssistente>}
          {r.tabela.length > 0 && <TabelaDeConfronto linhas={r.tabela} tela={s.textos.tela} constatacao={r.constatacao} />}
          <PilulasDirigidas
            pilulas={(Object.entries(s.textos.pilulas) as Array<[PilulaId, string]>).map(([id, rotulo]) => [id, rotulo])}
            feitas={r.pilulas}
            onPilula={(id) => void pilula(id as PilulaId)}
          />
          {r.pilulas.length > 0 && !s.revotoAberto && <Espera texto={s.textos.tela.esperaDoDebate} />}
          {r.pilulas.length > 0 && s.revotoAberto && s.decisao && s.conteudo && (
            <RevisaoDoVoto
              projetos={s.conteudo.projetos}
              decisao={s.decisao}
              rotulos={s.textos.criterios}
              tela={s.textos.tela}
              ocupado={ocupado}
              onConfirmar={(p, rk) => void confirmar(p, rk)}
            />
          )}
        </>
      )}
      {anexo.modal}
    </Workspace>
  );
}

/** E5 — Amara nomeia, o estudante marca as âncoras no histórico e monta o protocolo (E5-ALU-01 e 02). */
export function TelaExplicar({ s, semRede, executar }: Props) {
  const [editor, setEditor] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const anexo = useAnexo(s);
  const marcadas = s.explicar?.ancoras ?? [];

  const alternar = (a: AncoraId) => {
    const novas = marcadas.includes(a) ? marcadas.filter((x) => x !== a) : [...marcadas, a];
    void executar(() => api.ancoras(novas));
  };

  return (
    <Workspace tela={s.textos.tela} semRede={semRede}>
      {s.explicar && <Amara>{s.explicar.falaDeAmara}</Amara>}
      <Conceitos resumo={s.textos.conceitosResumo} conceitos={s.textos.conceitos} />
      <p className="uai-nota uai-nota--instrucao">{s.textos.tela.instrucaoAncoras}</p>
      <Thread mensagens={s.chat.mensagens} onAnexo={anexo.abrir} marcar={editor ? null : { marcadas, alternar }} />
      {!editor && (
        <div className="uai-acoes">
          <AcaoDoApp grande onClick={() => setEditor(true)}>
            {s.textos.tela.abrirEditor}
          </AcaoDoApp>
        </div>
      )}
      {editor && s.protocolo && (
        <EditorDeProtocolo
          banco={s.protocolo.banco}
          rotulos={s.textos.blocos}
          tela={s.textos.tela}
          ocupado={ocupado}
          onEnviar={async (e) => {
            setOcupado(true);
            const nova = await executar(() => api.protocolo(e.slots, e.descarte));
            if (nova?.concluido) telemetria.protocolo(e.slots.filter(Boolean).length, e.descarte.length);
            setOcupado(false);
          }}
        />
      )}
      {anexo.modal}
    </Workspace>
  );
}

/** O fim: os autos encerrados, somente leitura, e o histórico para rever. */
export function TelaConcluida({ s, semRede }: { s: Sessao; semRede: boolean }) {
  const [historico, setHistorico] = useState(false);
  const anexo = useAnexo(s);
  const final = s.revoto?.projeto ?? s.decisao?.projeto;
  const destino = s.conteudo?.projetos.find((p) => p.id === final)?.nome ?? "";
  return (
    <Workspace tela={s.textos.tela} semRede={semRede}>
      <Conclusao tela={s.textos.tela} destino={destino} />
      <div className="uai-acoes">
        <AcaoDoApp variante="outline" onClick={() => setHistorico((h) => !h)}>
          {s.textos.tela.revisarAutos}
        </AcaoDoApp>
      </div>
      {historico && (
        <div className="trava" inert>
          <Thread mensagens={s.chat.mensagens} onAnexo={anexo.abrir} />
        </div>
      )}
      {anexo.modal}
    </Workspace>
  );
}
