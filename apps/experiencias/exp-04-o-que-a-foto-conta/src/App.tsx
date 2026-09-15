import { useEffect, useState } from "react";
import { createExperiencia, type ExperienciaHandle } from "@edu/sdk";
import { FotoContaApp } from "./app/foto-conta-app";
import { TelaErro } from "./app/telas-casca";
import { EXP_ID, EXP_VERSION } from "./lib/versao";

/**
 * Bootstrap: o handshake com o hub (token, estudante, apiUrl) e a troca para
 * a máquina da missão. Fora do hub o handshake expira — e a mensagem de erro
 * fala na voz da ficção, nunca em jargão (o leitor tem 6 anos).
 */
export function App() {
  const [exp, setExp] = useState<ExperienciaHandle | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    createExperiencia({ expId: EXP_ID, expVersion: EXP_VERSION })
      .then(setExp)
      .catch(() => setFalhou(true));
  }, []);

  if (falhou) {
    return <TelaErro tipo="sessao" aoTentarDeNovo={() => window.location.reload()} />;
  }
  if (!exp) return <div className="fc-tela fc-tela-casca" aria-busy="true" />;
  return <FotoContaApp exp={exp} />;
}
