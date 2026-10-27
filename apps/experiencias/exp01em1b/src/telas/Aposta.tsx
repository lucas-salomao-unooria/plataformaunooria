import { useEffect, useState } from "react";
import { AlertBox, Button, Card, CardContent, CardHeader, RadioGroup, Tag } from "@edu/ui/ds";
import { Casca } from "../componentes/Casca";
import type { Contexto } from "../contexto";
import { useInatividade } from "../hooks/tela";
import { api } from "../lib/api";
import { telemetria } from "../lib/telemetria";
import { TEXTOS } from "../lib/textos";
import type { ApostaId, Ficha, Sessao } from "../lib/tipos";

/** A ordem das fichas no Figma (E3-ALU-01): Beatriz, Thiago, Lucas. */
const ORDEM = ["beatriz", "thiago", "lucas"];
const INATIVIDADE_MS = 60_000;

/**
 * E3-ALU-01 — Decidir: as três fichas de cadastro (todas pedindo a Trilha
 * Avançada) e a aposta da comissão em `RadioGroup`. "Disparar Simulação" grava
 * o LATCH 1 ("Previsão arquivada"); a partir daí a tela é `ApostaTravada`,
 * que espera "Liberar Início da Simulação" (E3-PROF-01, 100% das apostas).
 *
 * E3-SIS-01: com o pacote na reserva (`pacote.contingencia`), a faixa
 * "Carregando versão de contingência da rede escolar" e a tag "Pacote Padrão".
 */
export function Aposta({ ctx }: { ctx: Contexto }) {
  const { estado, sessao, executar } = ctx;
  const [escolha, setEscolha] = useState<ApostaId | null>(estado.aposta);
  const [enviando, setEnviando] = useState(false);
  const parado = useInatividade(INATIVIDADE_MS, escolha === null);

  useEffect(() => {
    if (parado) telemetria.inatividade("aposta");
  }, [parado]);

  if (escolha && ctx.naFila("aposta")) return <ApostaTravada ctx={ctx} aposta={escolha} />;

  async function disparar() {
    if (!escolha) return;
    setEnviando(true);
    await executar(() => api.aposta(escolha), "aposta");
    setEnviando(false);
  }

  return (
    <Casca etapas={{ atual: 3, janela: [2, 3, 4, 5] }} equipe={estado.equipe}>
      <Contingencia sessao={sessao} />
      <p className="escola__instrucao">{estado.equipe ? TEXTOS.e3.instrucaoDaEquipe : TEXTOS.e3.instrucao}</p>
      <div className="escola__lista">
        {fichasNaOrdem(sessao.material.fichas).map((f) => (
          <Card key={f.perfil} variant="outlined">
            <CardHeader
              title={TEXTOS.e3.idade(f.nome, f.idade)}
              tag={
                <Tag variant="neutral" size="sm">
                  {TEXTOS.e3.fornecido}
                </Tag>
              }
            />
            <CardContent>
              <p className="escola__texto">{TEXTOS.e3.preferencia}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <RadioGroup
        name="aposta"
        label={TEXTOS.e3.pergunta}
        value={escolha ?? ""}
        onChange={(v) => setEscolha(v as ApostaId)}
        options={sessao.material.apostas.map((a) => ({ value: a.id, label: a.texto }))}
        theme="light"
      />
      {!escolha && <p className="escola__dica">{TEXTOS.e3.dica}</p>}
      <Button variant="primary" size="lg" fullWidth disabled={!escolha} isLoading={enviando} onClick={() => void disparar()}>
        {TEXTOS.e3.disparar}
      </Button>
    </Casca>
  );
}

/** E3-ALU-01 "travado": o LATCH 1 gravado, esperando a turma inteira apostar. */
export function ApostaTravada({ ctx, aposta }: { ctx: Contexto; aposta?: ApostaId }) {
  const { estado, sessao } = ctx;
  const id = aposta ?? estado.aposta;
  const texto = sessao.material.apostas.find((a) => a.id === id)?.texto ?? "";
  return (
    <Casca etapas={{ atual: 3, janela: [2, 3, 4, 5] }} equipe={estado.equipe}>
      <Contingencia sessao={sessao} />
      <Card variant="outlined">
        <CardContent>
          <div className="escola__pilha-curta">
            <Tag variant="brand" size="sm" leftIcon="lock">
              {TEXTOS.e3.latch}
            </Tag>
            <p className="escola__destaque">{TEXTOS.e3.arquivada(texto)}</p>
            <p className="escola__texto">{TEXTOS.e3.definitiva}</p>
          </div>
        </CardContent>
      </Card>
      <Button variant="secondary" size="lg" fullWidth disabled isLoading aria-live="polite">
        {TEXTOS.e3.iniciando}
      </Button>
    </Casca>
  );
}

function Contingencia({ sessao }: { sessao: Sessao }) {
  if (!sessao.pacote?.contingencia) return null;
  return (
    <AlertBox
      variant="info"
      device="mobile"
      theme="light"
      title={TEXTOS.e3.contingencia}
      description={`${TEXTOS.e3.contingenciaFichas}. ${TEXTOS.e3.contingenciaSegue}`}
      actions={
        <Tag variant="neutral" size="sm">
          {TEXTOS.e3.pacotePadrao}
        </Tag>
      }
    />
  );
}

function fichasNaOrdem(fichas: Ficha[]): Ficha[] {
  return [...fichas].sort((a, b) => ORDEM.indexOf(a.perfil) - ORDEM.indexOf(b.perfil));
}
