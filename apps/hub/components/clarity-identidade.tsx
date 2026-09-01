"use client";
import { clarityIdentify, claritySet } from "@edu/sdk";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type { Papel } from "@/lib/papeis";

/**
 * Quem é a pessoa e onde ela está, para o Clarity (ADR-59).
 *
 * Separado do `ClarityHub` porque a sessão não existe no layout raiz: o hub é
 * 100% server (`await auth()`), não tem `SessionProvider` nem `useSession`, e o
 * layout raiz cobre também o login, onde não há ninguém logado. Então quem sabe
 * da sessão passa os campos como props — este componente só emite.
 *
 * `identify` re-dispara a cada mudança de rota, e não uma vez por sessão: o App
 * Router navega sem recarregar a página, e a doc do Clarity pede a chamada POR
 * PÁGINA. Sem isso, tudo depois do primeiro render cai numa página só no painel.
 *
 * REGRA (regra 6, LGPD): daqui sai o UUID opaco e mais nada que identifique uma
 * pessoa. O `friendlyName` do `identify` — que levaria o nome — fica de fora de
 * propósito, e o nome da escola e da turma também: vão os ids.
 */
export function ClarityIdentidade(props: {
  id: string;
  papel: Papel;
  escolaId: string;
  turmaId?: string;
  serie?: string;
}) {
  const pathname = usePathname();
  const { id, papel, escolaId, turmaId, serie } = props;

  useEffect(() => {
    // `pathname` é o custom-page-id: é o que separa "tela de turmas" de "tela
    // de atividade" num App Router que não recarrega a página.
    clarityIdentify(id, pathname);
    claritySet("superficie", "hub");
    claritySet("perfil", papel);
    claritySet("escola_id", escolaId);
    claritySet("turma_id", turmaId);
    claritySet("serie", serie);
    claritySet("rota", pathname);
  }, [id, papel, escolaId, turmaId, serie, pathname]);

  return null;
}
