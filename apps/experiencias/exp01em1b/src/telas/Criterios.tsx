import { useEffect, useState } from "react";
import { AlertBox, Button, Card, CardContent, RadioGroup } from "@edu/ui/ds";
import { Casca } from "../componentes/Casca";
import type { Contexto } from "../contexto";
import { useInatividade } from "../hooks/tela";
import { api } from "../lib/api";
import { telemetria } from "../lib/telemetria";
import { rotuloDoCriterio, TEXTOS } from "../lib/textos";
import type { CriteriosValor, Funcao, OpcaoDeCriterio } from "../lib/tipos";

const INATIVIDADE_MS = 90_000;

/**
 * E5-ALU-03 — Explicar, parte 3: o banco de critérios 3×3 em três
 * `RadioGroup`. A configuração NO AR (`estado.criterios`: B-B-A até o
 * primeiro reteste) leva "[Ativo]" — é o que o sistema está rodando, não uma
 * dica. "Executar Novo Teste de Homologação" roda o reteste no servidor.
 *
 * "Critérios alterados" (o Figma): depois da primeira escolha, cada função
 * RESUME — mostra só o critério escolhido; "Trocar critério" reabre as três
 * opções daquela função, e escolher de novo a resume outra vez.
 *
 * Quem não fechou a classificação dos cartões vê o aviso do PO aqui também
 * (sessão de antes da 1.0.4, quando a classificação podia seguir incompleta).
 */
export function Criterios({ ctx }: { ctx: Contexto }) {
  const { estado, sessao, executar } = ctx;
  const [escolha, setEscolha] = useState<CriteriosValor>(() => ({ ...estado.criterios }));
  const [enviando, setEnviando] = useState(false);
  /** Já escolheu alguma vez? Daí em diante, as funções resumem. */
  const [alterou, setAlterou] = useState(false);
  /** A função reaberta por "Trocar critério" (as outras seguem resumidas). */
  const [reaberta, setReaberta] = useState<Funcao | null>(null);
  const parado = useInatividade(INATIVIDADE_MS, true);

  useEffect(() => {
    if (parado) telemetria.inatividade("criterios");
  }, [parado]);

  async function executarTeste() {
    setEnviando(true);
    await executar(() => api.criterios(escolha), "criterios");
    setEnviando(false);
  }

  return (
    <Casca etapas={{ atual: 5, janela: [4, 5, 6], rotulo: TEXTOS.e5.etapaDosCriterios }} equipe={estado.equipe}>
      <p className="escola__instrucao">{estado.equipe ? TEXTOS.e5.instrucaoCriteriosDaEquipe : TEXTOS.e5.instrucaoCriterios}</p>
      {!estado.classificacao?.completa && <AlertBox variant="warning" device="mobile" theme="light" description={TEXTOS.e5.incompleta} />}
      {sessao.material.criterios.map((grupo) => {
        const resumida = alterou && reaberta !== grupo.funcao;
        const opcoes = resumida ? grupo.opcoes.filter((o) => o.id === escolha[grupo.funcao]) : grupo.opcoes;
        const radios = (
          <RadioGroup
            name={`criterio-${grupo.funcao}`}
            label={TEXTOS.e5.funcao[grupo.funcao]}
            theme="light"
            value={escolha[grupo.funcao]}
            onChange={(v) => {
              setEscolha((e) => ({ ...e, [grupo.funcao]: v as OpcaoDeCriterio }));
              setAlterou(true);
              setReaberta(null);
            }}
            options={opcoes.map((o) => ({
              value: o.id,
              label: `${rotuloDoCriterio(grupo.funcao, o.id, o.rotulo)}${!alterou && estado.criterios[grupo.funcao] === o.id ? ` ${TEXTOS.e5.ativo}` : ""}`,
            }))}
          />
        );
        if (!alterou) return <div key={grupo.funcao}>{radios}</div>;
        return (
          <Card key={grupo.funcao} variant="outlined">
            <CardContent>
              <div className="escola__pilha-curta" data-funcao={grupo.funcao}>
                {radios}
                {resumida && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={TEXTOS.e5.trocarCriterio(TEXTOS.e5.funcao[grupo.funcao])}
                    onClick={() => setReaberta(grupo.funcao)}
                  >
                    {TEXTOS.e5.trocar}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
      <Button variant="primary" size="lg" fullWidth isLoading={enviando || ctx.naFila("criterios")} onClick={() => void executarTeste()}>
        {TEXTOS.e5.executar}
      </Button>
    </Casca>
  );
}
