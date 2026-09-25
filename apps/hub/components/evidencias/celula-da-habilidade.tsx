"use client";

import { Icon, Tag } from "@edu/ui/ds";
import { ICONE_A_REVISAR, ICONE_DA_ORIGEM, descricaoDaCelula, type LeituraDaCelula } from "@/lib/evidencias";

/**
 * Uma célula do painel: o nível numa `Tag` do DS e, embaixo, a marca DISCRETA
 * de onde ele veio ("da equipe", "projeção", "revisado" ou "a revisar"). A
 * evidência própria não leva marca — é o caso comum.
 *
 * Clicável só quando `onAbrir` vem: o professor numa RODADA. O resultado da
 * atividade não se edita (ele é derivado das rodadas), e a coordenação só lê.
 * A `Tag` do DS com `onClick` já vira botão (papel, foco e teclado); o nome
 * acessível diz quem, qual habilidade e o que está lá hoje.
 */
export function CelulaDaHabilidade({
  nome,
  codigo,
  leitura,
  onAbrir,
}: {
  nome: string;
  codigo: string;
  leitura: LeituraDaCelula;
  onAbrir?: () => void;
}) {
  const icone = leitura.aRevisar ? ICONE_A_REVISAR : leitura.origem ? ICONE_DA_ORIGEM[leitura.origem] : null;
  return (
    <span className="flex flex-col items-start gap-1">
      {onAbrir ? (
        <Tag
          variant={leitura.variante}
          size="sm"
          onClick={onAbrir}
          aria-label={`Alterar: ${descricaoDaCelula(nome, codigo, leitura)}`}
        >
          {leitura.rotulo}
        </Tag>
      ) : (
        <Tag variant={leitura.variante} size="sm">
          {leitura.rotulo}
        </Tag>
      )}
      {leitura.marca ? (
        <span
          className={`flex items-center gap-1 text-[11px] leading-none ${
            leitura.aRevisar ? "font-semibold text-unooria-neutral-700" : "text-unooria-neutral-500"
          }`}
        >
          {icone ? <Icon name={icone} size={12} color="currentColor" aria-hidden /> : null}
          {leitura.marca}
        </span>
      ) : null}
    </span>
  );
}
