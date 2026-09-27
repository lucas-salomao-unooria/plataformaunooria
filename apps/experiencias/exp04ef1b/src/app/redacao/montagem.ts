import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { rotas } from "../../lib/api";
import { gravarMemoria, lerMemoria } from "../../lib/memoria";
import { chaveDasVagas, completas, vagasValidas, VAGAS_VAZIAS, type Vagas } from "../../lib/regras";
import type { Diagramacao, IdDeNoticia } from "../../lib/tipos";

/**
 * O MODELO AUTOMÁTICO de reserva do lado da tela: quando nem a api respondeu
 * (rede fora), a página sai no layout clássico e a publicação segue. A api já
 * tem a própria reserva (a IA que falha vira `origem: "modelo"`), então isto só
 * vale para a queda de rede — e não mostra erro nenhum: a diagramação é
 * cosmética, e a missão não pode parar por ela (PDF §5).
 */
export const RESERVA_DA_TELA: Diagramacao = { layout: "classic", origem: "modelo" };

/**
 * A página EM MONTAGEM de uma edição: as três vagas, a memória delas na aba
 * (`lib/memoria.ts` — o F5 não as apaga) e a diagramação.
 *
 * **A diagramação é pedida quando as três vagas estão cheias**, uma vez por
 * combinação (cache por ids na ordem, como a api): trocar uma notícia pede de
 * novo; voltar a uma combinação já vista não. Enquanto ela não volta, a tela
 * diz "A redação está montando a página…" e o botão de publicar espera — o
 * layout vai no corpo da publicação.
 *
 * **Sem repetição**: a IA mora na api, que nunca falha por causa dela; o que
 * pode falhar aqui é a rede, e aí vale a reserva da tela, na hora.
 */
export function useMontagem({
  sessaoId,
  edicao,
  ids,
  inicial,
}: {
  sessaoId: string;
  edicao: 1 | 2;
  /** Os ids desta mesa — o que a memória da aba pode devolver. */
  ids: ReadonlySet<string>;
  /** As vagas de partida quando a memória não tem nada (na revisão, as da 1ª edição). */
  inicial?: readonly IdDeNoticia[];
}) {
  const campo = edicao === 1 ? "vagas1" : "vagas2";
  const [vagas, setVagasNoEstado] = useState<Vagas>(
    () => vagasValidas(lerMemoria(sessaoId)[campo], ids) ?? (inicial ? [...inicial] : VAGAS_VAZIAS),
  );

  const mudarVagas = useCallback(
    (novas: Vagas) => {
      setVagasNoEstado(novas);
      gravarMemoria(sessaoId, { [campo]: [...novas] });
    },
    [sessaoId, campo],
  );

  const esquecer = useCallback(() => gravarMemoria(sessaoId, { [campo]: undefined }), [sessaoId, campo]);

  const slots = useMemo(() => completas(vagas), [vagas]);
  const chave = slots ? chaveDasVagas(slots) : null;

  const cache = useRef(new Map<string, Diagramacao>());
  const [pronta, setPronta] = useState<{ chave: string; valor: Diagramacao } | null>(null);

  useEffect(() => {
    if (!slots || !chave) return;
    const guardada = cache.current.get(chave);
    if (guardada) {
      setPronta({ chave, valor: guardada });
      return;
    }
    let vivo = true;
    void (async () => {
      try {
        const valor = await rotas.diagramar(slots);
        cache.current.set(chave, valor);
        if (vivo) setPronta({ chave, valor });
      } catch {
        if (vivo) setPronta({ chave, valor: RESERVA_DA_TELA });
      }
    })();
    return () => {
      vivo = false;
    };
  }, [chave, slots]);

  const diagramacao = chave && pronta?.chave === chave ? pronta.valor : null;

  return {
    vagas,
    mudarVagas,
    esquecer,
    /** As três vagas cheias, na ordem — o `slots` da publicação. */
    slots,
    diagramacao,
    /** Três vagas cheias e a diagramação ainda não voltou. */
    montando: slots !== null && diagramacao === null,
  };
}
