import { useEffect, useState } from "react";
import { createExperiencia, type ExperienciaHandle } from "@edu/sdk";

import { EXP_VERSION } from "./lib/versao";

import { api, definirExperiencia } from "./lib/api";
import type { Configuracao } from "./lib/tipos";
import { PlanoDeEnsinoApp } from "./app/plano-de-ensino-app";

/**
 * Entrada da experiência, em duas etapas (padrão da exp-01 e da exp-90):
 *  1. handshake com o hub (SDK): token, usuário logado e apiUrl chegam por
 *     `hub:init` — NÃO há tela de login, quem autentica é o hub, e a api impõe
 *     `@Roles("professor")`;
 *  2. `GET /planejamento/configuracoes`: as regências que o professor já tem.
 *
 * O catálogo curricular NÃO é carregado aqui: são 1.616 habilidades, e o
 * professor só precisa das do componente que escolher. Carregar tudo no boot
 * atrasaria a primeira tela por dado que 99% das sessões não usa.
 */
export function Bootstrap() {
  const [boot, setBoot] = useState<{ nome: string; configuracoes: Configuracao[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      let exp: ExperienciaHandle | null = null;
      try {
        exp = await createExperiencia({
          expId: "exp-92-plano-de-ensino",
          expVersion: EXP_VERSION,
        });
        definirExperiencia(exp);
        const { configuracoes } = await api.get<{ configuracoes: Configuracao[] }>(
          "/planejamento/configuracoes",
        );
        // `estudante` carrega o usuário logado no protocolo v1, qualquer que
        // seja o papel — o nome do campo é do contrato, não do papel.
        if (ativo) setBoot({ nome: exp.estudante.nome, configuracoes });
      } catch (falha) {
        console.error("[plano-de-ensino] boot falhou", falha);
        // O boot que falha DEPOIS do handshake tem token, e por isso pode
        // reportar: era esta a falha que o estudante via como "não deu para
        // abrir agora" e que não deixava rastro nenhum no servidor (ADR-84).
        // Antes do handshake `exp` é null — ali não há token, e o sinal é a
        // ausência de `exp:ready`, que o hub observa.
        exp?.reportarErro(falha);
        if (ativo) {
          setErro(
            "Não foi possível abrir o planejamento agora. Recarregue a página ou tente mais tarde.",
          );
        }
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  if (erro) {
    return (
      <main
        className="app-shell app-main"
        style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}
      >
        <p>{erro}</p>
      </main>
    );
  }
  if (!boot) {
    return (
      <main className="app-shell app-main" style={{ alignItems: "center", justifyContent: "center" }}>
        <p aria-live="polite">Abrindo o planejamento…</p>
      </main>
    );
  }
  return <PlanoDeEnsinoApp professorNome={boot.nome} configuracoesIniciais={boot.configuracoes} />;
}
