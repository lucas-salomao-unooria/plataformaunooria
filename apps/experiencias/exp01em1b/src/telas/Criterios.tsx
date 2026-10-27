import { useEffect, useState } from "react";
import { AlertBox, Button, RadioGroup } from "@edu/ui/ds";
import { Casca } from "../componentes/Casca";
import type { Contexto } from "../contexto";
import { useInatividade } from "../hooks/tela";
import { api } from "../lib/api";
import { telemetria } from "../lib/telemetria";
import { rotuloDoCriterio, TEXTOS } from "../lib/textos";
import type { CriteriosValor, OpcaoDeCriterio } from "../lib/tipos";

const INATIVIDADE_MS = 90_000;

/**
 * E5-ALU-03 — Explicar, parte 3: o banco de critérios 3×3 em três
 * `RadioGroup`. A configuração NO AR (`estado.criterios`: B-B-A até o
 * primeiro reteste) leva "[Ativo]" — é o que o sistema está rodando, não uma
 * dica. "Executar Novo Teste de Homologação" roda o reteste no servidor.
 *
 * Quem não fechou a classificação dos cartões vê o aviso do PO aqui também
 * ("Ignorou a classificação…": o banco abre normalmente, com o aviso).
 */
export function Criterios({ ctx }: { ctx: Contexto }) {
  const { estado, sessao, executar } = ctx;
  const [escolha, setEscolha] = useState<CriteriosValor>(() => ({ ...estado.criterios }));
  const [enviando, setEnviando] = useState(false);
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
    <Casca etapas={{ atual: 5, janela: [4, 5, 6] }} equipe={estado.equipe}>
      <p className="escola__instrucao">{estado.equipe ? TEXTOS.e5.instrucaoCriteriosDaEquipe : TEXTOS.e5.instrucaoCriterios}</p>
      {!estado.classificacao?.completa && <AlertBox variant="warning" device="mobile" theme="light" description={TEXTOS.e5.incompleta} />}
      {sessao.material.criterios.map((grupo) => (
        <RadioGroup
          key={grupo.funcao}
          name={`criterio-${grupo.funcao}`}
          label={TEXTOS.e5.funcao[grupo.funcao]}
          theme="light"
          value={escolha[grupo.funcao]}
          onChange={(v) => setEscolha((e) => ({ ...e, [grupo.funcao]: v as OpcaoDeCriterio }))}
          options={grupo.opcoes.map((o) => ({
            value: o.id,
            label: `${rotuloDoCriterio(grupo.funcao, o.id, o.rotulo)}${estado.criterios[grupo.funcao] === o.id ? ` ${TEXTOS.e5.ativo}` : ""}`,
          }))}
        />
      ))}
      <Button variant="primary" size="lg" fullWidth isLoading={enviando || ctx.naFila("criterios")} onClick={() => void executarTeste()}>
        {TEXTOS.e5.executar}
      </Button>
    </Casca>
  );
}
