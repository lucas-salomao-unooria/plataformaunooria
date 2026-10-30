import { useEffect, useState } from "react";
import { ESTEIRA_VAZIA, quadrosDaSimulacao, sequenciaDaEsteira, soltarBloco, tirarBloco, vagasVazias, type Esteira } from "../../lib/regras";
import { CABECALHO, E5 } from "../../lib/textos";
import { SIMULACAO_DA_ROTINA_MS, type BlocoPublico, type PassoDaSimulacao } from "../../lib/tipos";
import { useArrastar } from "../comum/arrastar";
import { Icone } from "../comum/icone";
import { Cabecalho } from "../jornal/cabecalho";
import { AcaoDaMissao } from "../mecanica/acoes";
import { BandejaDeBlocos, EsteiraDaRotina, FichaEmTeste } from "../mecanica/esteira";
import { PainelCentral } from "../mecanica/painel-central";
import { Casca } from "./casca";

export type ModoDaRotina = "edicao" | "executando" | "sucesso" | "erro";

/**
 * E5-ALU-01 — a rotina automática. Os sete blocos descem EMBARALHADOS e com
 * ids opacos (a ordem é do servidor; a tela não reordena). A criança monta a
 * esteira por toque ou arraste (ADR-201) e toca "Testar Rotina"; quem decide se ela para é o
 * SERVIDOR (`POST rotina`):
 *
 * - válida → a simulação que a api devolveu, ficha a ficha (contador 3 → 0,
 *   ~1,8 s; a do Clube de Xadrez recebe a bandeira), e o sucesso com "Ir
 *   para o Caso Novo";
 * - inválida → E5-SIS-01, "A rotina não para." e "Reorganizar", que volta à
 *   esteira COMO ESTAVA.
 */
export function TelaDaRotina({
  blocos,
  simulacaoSalva,
  ocupado,
  aoTestar,
  aoIrParaCaso,
  inicial,
}: {
  blocos: readonly BlocoPublico[];
  simulacaoSalva: readonly PassoDaSimulacao[] | null;
  ocupado: boolean;
  aoTestar: (sequencia: string[]) => Promise<{ valida: boolean; simulacao: PassoDaSimulacao[] | null } | null>;
  aoIrParaCaso: () => void;
  inicial?: { esteira?: Esteira; modo?: ModoDaRotina; quadro?: number; escolhido?: string | null };
}) {
  const [esteira, setEsteira] = useState<Esteira>(inicial?.esteira ?? ESTEIRA_VAZIA);
  const [escolhido, setEscolhido] = useState<string | null>(inicial?.escolhido ?? null);
  const [modo, setModo] = useState<ModoDaRotina>(inicial?.modo ?? (simulacaoSalva ? "sucesso" : "edicao"));
  const [simulacao, setSimulacao] = useState<readonly PassoDaSimulacao[]>(simulacaoSalva ?? []);
  const [quadro, setQuadro] = useState(inicial?.quadro ?? 0);

  // A simulação: um quadro por ficha, no compasso de `SIMULACAO_DA_ROTINA_MS`.
  useEffect(() => {
    if (modo !== "executando" || inicial?.modo === "executando") return;
    const quadros = quadrosDaSimulacao(simulacao, SIMULACAO_DA_ROTINA_MS);
    const relogios = quadros.map((q) => window.setTimeout(() => setQuadro(q.indice), q.emMs));
    relogios.push(window.setTimeout(() => setModo("sucesso"), SIMULACAO_DA_ROTINA_MS + 300));
    return () => relogios.forEach((r) => window.clearTimeout(r));
  }, [modo, simulacao, inicial?.modo]);

  const { arrastavel } = useArrastar((id, alvo) => {
    setEscolhido(null);
    if (alvo.zona === "esteira" && alvo.vaga !== null) setEsteira((e) => soltarBloco(e, id, alvo.vaga!));
    else if (alvo.zona === "bandeja") setEsteira((e) => (e.includes(id) ? tirarBloco(e, e.indexOf(id)) : e));
  }, modo === "edicao");

  const sequencia = sequenciaDaEsteira(esteira);
  const faltam = vagasVazias(esteira);
  const rotuloEscolhido = blocos.find((b) => b.id === escolhido)?.rotulo;
  const status = rotuloEscolhido ? E5.escolhido(rotuloEscolhido) : faltam > 0 ? E5.faltam(faltam) : E5.bandejaAjuda;

  if (modo === "sucesso") {
    return (
      <Casca topo={<Cabecalho direita={CABECALHO.pilhaZerada} />} corpo="casca__corpo--centro">
        <PainelCentral
          simbolo={<Icone nome="revisar" tamanho={40} />}
          titulo={E5.sucessoTitulo}
          texto={E5.sucessoTexto}
          acao={
            <AcaoDaMissao depois="play_arrow" aoTocar={aoIrParaCaso}>
              {E5.irParaCaso}
            </AcaoDaMissao>
          }
        />
      </Casca>
    );
  }

  if (modo === "erro") {
    return (
      <Casca topo={<Cabecalho />} corpo="casca__corpo--centro">
        <PainelCentral
          simbolo={<Icone nome="enquanto" tamanho={40} className="gira" />}
          titulo={E5.erroTitulo}
          texto={E5.erroTexto}
          acao={<AcaoDaMissao aoTocar={() => setModo("edicao")}>{E5.reorganizar}</AcaoDaMissao>}
        />
      </Casca>
    );
  }

  const executando = modo === "executando";
  const atual = simulacao[quadro];
  const ativo = atual ? (blocos.find((b) => b.bloco === atual.marca)?.id ?? null) : null;
  const total = simulacao.length;

  return (
    <Casca
      topo={<Cabecalho direita={executando ? CABECALHO.pilhaRestante(total - quadro) : CABECALHO.pilha(3)} />}
    >
      <div className="rotina">
        {executando && atual ? (
          <FichaEmTeste
            titulo={E5.fichaEmTeste(quadro + 1, total)}
            manchete={atual.manchete}
            onde={atual.marca === "revisar" ? E5.ondeVazio : E5.ondePreenchido}
            marca={atual.marca === "revisar" ? E5.marcaRevisar : E5.marcaOk}
          />
        ) : (
          <BandejaDeBlocos
            blocos={blocos}
            naEsteira={esteira}
            escolhido={escolhido}
            aoEscolher={(id) => setEscolhido((a) => (a === id ? null : id))}
            arrastavel={arrastavel}
            status={status}
          />
        )}
        <EsteiraDaRotina
          blocos={blocos}
          esteira={esteira}
          executando={executando}
          ativo={ativo}
          temEscolhido={escolhido !== null}
          aoSoltar={(vaga) => {
            if (!escolhido) return;
            setEsteira((e) => soltarBloco(e, escolhido, vaga));
            setEscolhido(null);
          }}
          aoTirar={(vaga) => setEsteira((e) => tirarBloco(e, vaga))}
          arrastavel={arrastavel}
          acoes={
            executando ? (
              <AcaoDaMissao variante="outline" desabilitado aoTocar={() => undefined}>
                {E5.executando}
              </AcaoDaMissao>
            ) : (
              <AcaoDaMissao
                desabilitado={!sequencia}
                ocupado={ocupado}
                aoTocar={() => {
                  if (!sequencia) return;
                  void aoTestar(sequencia).then((r) => {
                    if (!r) return;
                    if (r.valida && r.simulacao) {
                      setSimulacao(r.simulacao);
                      setQuadro(0);
                      setModo("executando");
                    } else {
                      setModo("erro");
                    }
                  });
                }}
              >
                {E5.testar}
              </AcaoDaMissao>
            )
          }
        />
      </div>
    </Casca>
  );
}
