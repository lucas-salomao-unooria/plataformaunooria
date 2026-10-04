"use client";

import { useEffect, useMemo, useState } from "react";
import { Selection, TextField } from "@edu/ui/ds";

/**
 * A escolha da escola de quem atende a rede inteira — o administrador do
 * contrato (e o `admin`), que viaja com `escola_id` VAZIO no token e precisa
 * dizer em qual escola está trabalhando (H03.4.2).
 *
 * Era um `TextField` "Escola (id)" em quatro telas (Usuários, Turmas, Importar
 * e Análise de produto): só funcionava para quem sabia de cor o código interno
 * de cada uma das cem escolas da rede.
 *
 * **Composição de duas peças do DS, e não componente novo.** O `Selection` não
 * tem busca embutida; com cem opções, a lista sozinha vira rolagem sem fim.
 * Então a busca é um `TextField` que FILTRA as opções do `Selection` ao lado,
 * por nome, código INEP, município ou código interno — os mesmos campos que a
 * busca de `GET /escolas` olha. A lista vem UMA vez (as escolas do contrato
 * cabem folgadas no teto de mil da rota) e o filtro é local: digitar não
 * dispara uma chamada por tecla. Quando o DS publicar seleção com busca, esta
 * peça vira um componente só.
 *
 * Não confundir com `seletor-de-escola.tsx`: aquele é a escola ATIVA da sessão,
 * entre as lotações da pessoa; este escolhe QUALQUER escola do contrato.
 */

interface EscolaDaRede {
  id: string;
  nome: string;
  codigoInep: string | null;
  municipio: string | null;
  uf: string | null;
}

/** Sem acento e sem caixa: "sao jose" acha "São José". */
const normalizar = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

function rotulo(escola: EscolaDaRede): string {
  const onde = [escola.municipio, escola.uf].filter(Boolean).join("/");
  const inep = escola.codigoInep ? `INEP ${escola.codigoInep}` : null;
  const detalhe = [onde, inep].filter(Boolean).join(" · ");
  return detalhe ? `${escola.nome} — ${detalhe}` : escola.nome;
}

export function EscolhaDeEscola({
  id,
  valor,
  aoEscolher,
}: {
  /** Prefixo dos ids dos campos. */
  id: string;
  /** O `escola_id` escolhido; vazio quando ainda não há escolha. */
  valor: string;
  aoEscolher: (escolaId: string) => void;
}) {
  const [escolas, setEscolas] = useState<EscolaDaRede[] | null>(null);
  const [erro, setErro] = useState(false);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const resposta = await fetch("/api/plataforma/escolas?tipo=escola", { cache: "no-store" });
        if (!resposta.ok) throw new Error(String(resposta.status));
        const lidas = (await resposta.json()) as EscolaDaRede[];
        if (vivo) setEscolas(lidas);
      } catch {
        if (vivo) setErro(true);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const opcoes = useMemo(() => {
    const lista = escolas ?? [];
    const termo = normalizar(busca.trim());
    const filtradas = termo
      ? lista.filter((e) =>
          [e.nome, e.codigoInep ?? "", e.municipio ?? "", e.id].some((campo) =>
            normalizar(campo).includes(termo),
          ),
        )
      : lista;
    /* A escolhida continua na lista mesmo fora do filtro: sumir com ela faria
       o campo mostrar "Escolha a escola" para uma escola que está escolhida. */
    const escolhida = lista.find((e) => e.id === valor);
    const comEscolhida =
      escolhida && !filtradas.some((e) => e.id === valor) ? [escolhida, ...filtradas] : filtradas;
    return comEscolhida.map((e) => ({ value: e.id, label: rotulo(e) }));
  }, [escolas, busca, valor]);

  const ajuda = erro
    ? "Não deu para carregar as escolas agora. Recarregue a página."
    : escolas === null
      ? "Carregando as escolas da rede…"
      : busca.trim() && opcoes.length === 0
        ? "Nenhuma escola com esse nome, código INEP ou município."
        : `${opcoes.length} de ${escolas.length} escola${escolas.length === 1 ? "" : "s"}`;

  return (
    <div className="flex flex-wrap items-start gap-3">
      <div className="w-[260px] max-w-full">
        <TextField
          id={`${id}-busca`}
          label="Buscar escola"
          placeholder="Nome, código INEP ou município"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>
      <div className="w-[420px] max-w-full">
        <Selection
          id={`${id}-escola`}
          label="Escola"
          placeholder="Escolha a escola"
          value={valor}
          onChange={(escolhido) => aoEscolher(String(escolhido ?? ""))}
          options={opcoes}
          disabled={escolas === null || erro}
          error={erro}
          helperText={ajuda}
          maxBoxHeight={320}
          showOptionCheckbox={false}
          fullWidth
        />
      </div>
    </div>
  );
}
