import { useState } from "react";
import { ButtonUnv, PostCard, TopBar } from "@edu/ui/ds-unoovista";
import { iniciais } from "../../lib/regras";
import { CONTAS, E2, E6 } from "../../lib/textos";
import type { Cartao } from "../../lib/tipos";
import { Escolha } from "./escolha";

/**
 * E6-ALU-01 — o caso Mariana, a transferência. Volta ao CLONE: o caso é
 * contado pela comissão, como mais uma publicação dela (`PostCard` sem mídia,
 * só a legenda), e a criança escolhe UM cartão de mecanismo e UM de atitude.
 *
 * O botão fica travado até as duas escolhas. **A tela não diz qual é o certo**
 * — nem depois: a escolha é gravada para o professor e não vira nota (a
 * evidência da missão está nas três habilidades). Os ids dos cartões tocados
 * ficam no `sessionStorage` até "Registrar" (`memoria.ts`), para um F5 não
 * apagar a escolha.
 */
export function Mariana({
  caso,
  mecanismos,
  atitudes,
  inicial,
  enviando,
  aoMudar,
  aoRegistrar,
}: {
  caso: string;
  mecanismos: readonly Cartao[];
  atitudes: readonly Cartao[];
  inicial: { mecanismo: string | null; atitude: string | null };
  enviando: boolean;
  aoMudar: (escolha: { mecanismo: string | null; atitude: string | null }) => void;
  aoRegistrar: (mecanismo: string, atitude: string) => void;
}) {
  const [mecanismo, setMecanismo] = useState<string | null>(
    inicial.mecanismo && mecanismos.some((c) => c.id === inicial.mecanismo) ? inicial.mecanismo : null,
  );
  const [atitude, setAtitude] = useState<string | null>(
    inicial.atitude && atitudes.some((c) => c.id === inicial.atitude) ? inicial.atitude : null,
  );

  return (
    <div className="tela">
      <h1 className="so-leitor">{E6.tituloDaTela}</h1>
      <TopBar title={E2.topo} withStatusBarInset={false} />
      <div className="rolagem mariana">
        <PostCard className="post">
          <PostCard.Header username={CONTAS.comissao} initials={iniciais(CONTAS.comissao)} verified />
          <PostCard.Caption>{caso}</PostCard.Caption>
        </PostCard>
        <p className="mariana__instrucao">{E6.instrucao}</p>
        <p className="mariana__grupo">{E6.grupoDoMecanismo}</p>
        <Escolha
          rotulo={E6.grupoDoMecanismo}
          valor={mecanismo}
          desabilitada={enviando}
          opcoes={mecanismos.map((c) => ({ id: c.id, titulo: c.texto }))}
          aoEscolher={(id) => {
            setMecanismo(id);
            aoMudar({ mecanismo: id, atitude });
          }}
        />
        <p className="mariana__grupo">{E6.grupoDaAtitude}</p>
        <Escolha
          rotulo={E6.grupoDaAtitude}
          valor={atitude}
          desabilitada={enviando}
          opcoes={atitudes.map((c) => ({ id: c.id, titulo: c.texto }))}
          aoEscolher={(id) => {
            setAtitude(id);
            aoMudar({ mecanismo, atitude: id });
          }}
        />
      </div>
      <div className="doca">
        <ButtonUnv
          variant="primary"
          size="lg"
          block
          disabled={!mecanismo || !atitude || enviando}
          onClick={() => mecanismo && atitude && aoRegistrar(mecanismo, atitude)}
        >
          {E6.avancar}
        </ButtonUnv>
      </div>
    </div>
  );
}
