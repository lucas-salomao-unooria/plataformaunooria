import { useEffect, useState } from "react";
import { createExperiencia, type ExperienciaHandle } from "@edu/sdk";

/** Template mínimo: handshake com o hub, telemetria, progresso, conclusão.
 *  UI propositalmente crua — design vem depois (ver CLAUDE.md). */
export function App() {
  const [exp, setExp] = useState<ExperienciaHandle | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [cliques, setCliques] = useState(0);

  useEffect(() => {
    createExperiencia({ expId: "exp-template", expVersion: "0.1.0" })
      .then(async (e) => {
        setExp(e);
        const save = await e.progresso.carregar<{ cliques: number }>();
        if (save) setCliques(save.cliques);
        e.track("attempted", "exp-template");
      })
      .catch((err) => setErro(String(err)));
  }, []);

  if (erro) return <p>Erro no handshake: {erro} (abra via hub: /exp/exp-template)</p>;
  if (!exp) return <p>Conectando ao hub…</p>;

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Olá, {(exp.estudante ?? (exp as any).aluno)?.nome} ({(exp.estudante ?? (exp as any).aluno)?.serie})</h1>
      <p>Cliques: {cliques}</p>
      <button
        onClick={() => {
          const n = cliques + 1;
          setCliques(n);
          exp.track("interacted", "botao-contador", { resultado: { cliques: n } });
          void exp.progresso.salvar({ cliques: n });
        }}
      >
        Clicar
      </button>
      <button style={{ marginLeft: 8 }} onClick={() => exp.concluir({ score: cliques })}>
        Concluir atividade
      </button>
    </main>
  );
}
