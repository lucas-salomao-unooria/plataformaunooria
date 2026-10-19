import { useState } from "react";
import { Button, Card, CardContent, PuzzleBlock, PuzzleTrack, RevealClue, ScrollBar } from "@edu/ui/ds";
import { gravarMemoria, lerMemoria } from "../../lib/memoria";
import { ICONE_DA_PISTA, ICONE_DO_BLOCO } from "../../lib/meios";
import {
  abrirNaSimulacao,
  corpoDaSimulacao,
  decidirNaSimulacao,
  jaAberta,
  marcarNaSimulacao,
  MATERIA_NOVA,
  materiaValida,
  type MateriaEmSimulacao,
} from "../../lib/regras";
import { E5, ERROS, PISTA, SIM } from "../../lib/textos";
import {
  TIPOS_DE_PISTA,
  type CorpoDaSimulacao,
  type DecisaoDaSimulacao,
  type IdDeSimulacao,
  type MateriaDaSimulacao,
  type SimulacaoDaTela,
} from "../../lib/tipos";
import { Cabecalho } from "./cabecalho";
import { JulgarPista } from "./julgar-pista";
import { MateriaOriginal } from "./materia-original";

type Materias = Partial<Record<IdDeSimulacao, MateriaEmSimulacao>>;

const DECISOES: readonly DecisaoDaSimulacao[] = ["publicar", "nao_publicar"];

function lerDaMemoria(sessaoId: string): Materias {
  const bruto = lerMemoria(sessaoId).simulacao;
  if (!bruto || typeof bruto !== "object") return {};
  const salvo = bruto as Record<string, unknown>;
  const saida: Materias = {};
  for (const id of ["s1", "s2"] as const) {
    const m = materiaValida(salvo[id]);
    if (m) saida[id] = m;
  }
  return saida;
}

/**
 * A SIMULAÇÃO da Chave (3.0.0, ADR-168) — a redação fala, o Bento não. A Chave
 * que a dupla MONTOU aparece como roteiro (`PuzzleTrack` com os blocos
 * travados: vaga 1, 2, 3, o rótulo e o "se falhar"; na vaga com isca, a frase
 * neutra de pulo que a api mandou), e as duas matérias novas vêm UMA por vez.
 *
 * **A ordem é a evidência, e a tela não a força**: as três pistas ficam
 * tocáveis em qualquer ordem. Mas, aberta uma pista, a marcação é OBRIGATÓRIA
 * — "✓ Confio" / "✗ Não confio" — antes de abrir outra ou decidir (é o que
 * torna "parou onde a regra dela manda" sempre decidível na api). Vaga com
 * isca não tem pista a abrir: ela conta como pulada. A qualquer momento,
 * "Publicar" ou "Não publicar" fecha a matéria.
 *
 * **Nada de certo ou errado na tela.** Depois das duas, a tela manda tudo de
 * uma vez (`POST simulacao`, as pistas na ordem em que ela abriu) e mostra a
 * `referencia` que a api devolve — a mesma frase para todos, sem comparar com a
 * Chave dela. A casca segura esta tela até "Continuar". A simulação em curso
 * vive na memória da aba: o F5 não apaga a ordem já dada.
 */
export function TelaDaSimulacao({
  sessaoId,
  dados,
  referencia,
  aoEnviar,
  aoContinuar,
}: {
  sessaoId: string;
  /** O `GET simulacao`; `null` enquanto ele não volta. */
  dados: SimulacaoDaTela | null;
  /** A frase de referência, depois do envio; `null` antes. */
  referencia: string | null;
  /** O `POST simulacao`. `false` = falhou por um motivo que não se repete (a casca já tratou). */
  aoEnviar: (corpo: CorpoDaSimulacao) => Promise<boolean>;
  aoContinuar: () => void;
}) {
  const [materias, setMaterias] = useState<Materias>(() => lerDaMemoria(sessaoId));
  const [enviando, setEnviando] = useState(false);

  if (!dados) {
    return (
      <div className="tela">
        <Cabecalho titulo={SIM.titulo} />
        <div className="tela__corpo" aria-busy="true" />
      </div>
    );
  }

  const ids = dados.materias.map((m) => m.id);
  const atual = dados.materias.find((m) => materias[m.id]?.decisao == null) ?? null;
  const posicao = atual ? ids.indexOf(atual.id) + 1 : ids.length;

  function mudar(id: IdDeSimulacao, nova: MateriaEmSimulacao) {
    const todas = { ...materias, [id]: nova };
    setMaterias(todas);
    gravarMemoria(sessaoId, { simulacao: todas });
    const corpo = corpoDaSimulacao(ids, todas);
    if (corpo) void enviar(corpo);
  }

  async function enviar(corpo: CorpoDaSimulacao) {
    setEnviando(true);
    const ok = await aoEnviar(corpo);
    setEnviando(false);
    if (ok) gravarMemoria(sessaoId, { simulacao: undefined });
  }

  const roteiro = dados.chave.vagas.map((vaga) => (
    <PuzzleBlock
      key={vaga.bloco}
      label={vaga.rotulo}
      description={vaga.pulo ?? SIM.seFalhar(E5.opcoesSeFalhar[vaga.seFalhar])}
      icon={ICONE_DO_BLOCO[vaga.bloco]}
      state="locked"
    />
  ));

  return (
    <div className="tela">
      <Cabecalho titulo={SIM.titulo} />
      <ScrollBar className="rolagem" autoHide>
        <div className="tela__corpo">
          {referencia !== null ? (
            <Card>
              <CardContent>
                <p className="tela__destaque">{SIM.referencia}</p>
                <p className="tela__texto" role="status">
                  {referencia}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <p className="tela__texto">{SIM.instrucao}</p>
              <PuzzleTrack
                label={SIM.suaChave}
                slots={roteiro}
                status={SIM.repeticao(E5.opcoesRepeticao[dados.chave.repeticao])}
              />
              {atual && !enviando ? (
                <MateriaNaSimulacao
                  key={atual.id}
                  materia={atual}
                  rotulo={SIM.materia(posicao, ids.length)}
                  estado={materias[atual.id] ?? MATERIA_NOVA}
                  aoMudar={(nova) => mudar(atual.id, nova)}
                />
              ) : enviando ? (
                <p className="tela__mensagem" role="status" aria-busy="true">
                  {SIM.enviando}
                </p>
              ) : (
                /* As duas decididas e nada enviado: o envio falhou por um motivo
                   que não se repete, ou o F5 caiu entre a decisão e a resposta. */
                <Button
                  size="lg"
                  fullWidth
                  className="acao-crianca"
                  onClick={() => {
                    const corpo = corpoDaSimulacao(ids, materias);
                    if (corpo) void enviar(corpo);
                  }}
                >
                  {ERROS.tentarNovamente}
                </Button>
              )}
            </>
          )}
        </div>
      </ScrollBar>
      {referencia !== null && (
        <div className="tela__acao">
          <Button size="lg" fullWidth className="acao-crianca" onClick={aoContinuar}>
            {SIM.continuar}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Uma matéria: a peça no formato original, as três pistas tocáveis e a decisão. */
function MateriaNaSimulacao({
  materia,
  rotulo,
  estado,
  aoMudar,
}: {
  materia: MateriaDaSimulacao;
  rotulo: string;
  estado: MateriaEmSimulacao;
  aoMudar: (nova: MateriaEmSimulacao) => void;
}) {
  const pendente = estado.pendente;
  return (
    <section className="simulacao__materia" aria-label={rotulo}>
      <p className="tela__destaque">{rotulo}</p>
      <MateriaOriginal
        noticia={{ ...materia, corpo: materia.resumo, legenda: null, imagem: null }}
        aoFalharMidia={() => undefined}
      />

      <div className="gaveta__pistas">
        {TIPOS_DE_PISTA.map((tipo) => {
          const passo = estado.passos.find((p) => p.tipo === tipo);
          return (
            <RevealClue
              key={tipo}
              label={PISTA[tipo].rotulo}
              question={PISTA[tipo].pergunta}
              icon={ICONE_DA_PISTA[tipo]}
              open={jaAberta(estado, tipo)}
              onOpenChange={(aberta) => {
                /* Abrir só vale com nenhuma outra esperando a marcação; fechar não
                   existe aqui — a pista aberta fica à vista, com a marca dela. */
                if (aberta) aoMudar(abrirNaSimulacao(estado, tipo));
              }}
            >
              {materia.pistas[tipo]}
              <JulgarPista
                veredito={passo?.veredito ?? null}
                enviando={false}
                aoJulgar={(v) => aoMudar(marcarNaSimulacao(estado, v))}
              />
            </RevealClue>
          );
        })}
      </div>

      <p className="mesa__status" role="status">
        {pendente ? SIM.marqueParaSeguir : ""}
      </p>

      <div className="julgar">
        {DECISOES.map((d) => (
          <Button
            key={d}
            variant="outline"
            size="lg"
            fullWidth
            className="acao-crianca"
            disabled={pendente !== null}
            onClick={() => aoMudar(decidirNaSimulacao(estado, d))}
          >
            {SIM.decisao[d]}
          </Button>
        ))}
      </div>
    </section>
  );
}
