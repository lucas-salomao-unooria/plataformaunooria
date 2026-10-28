import { IconUnv } from "@edu/ui/ds-unoovista";
import { TEXTOS } from "../lib/textos";

/**
 * E4-SIS-01 — o congelamento do professor ("Pausar Telas para Debate"). Uma
 * camada por cima de QUALQUER tela, sem botão de fechar: só o gate da turma a
 * tira (o polling relê a sessão). O que está embaixo fica `inert` (App).
 *
 * COMPENSAÇÃO MARCADA: o véu de 60% e a caixa central são leiaute
 * (`.pausa` em `globals.css`); o `ConfirmDialog` do Unoovista exige ações e o
 * `BottomSheet` fecha pelo véu e pelo ESC — nenhum dos dois é uma espera sem
 * escape. LACUNA DO DS: a seção não tem glifo de pausa; vai o `lock`.
 */
export function Pausa() {
  return (
    <div className="pausa" data-unv-theme="dark">
      <div className="pausa__caixa" role="alert">
        <span className="pausa__icone">
          <IconUnv name="lock" size="lg" />
        </span>
        <p className="pausa__texto">{TEXTOS.pausa}</p>
      </div>
    </div>
  );
}
