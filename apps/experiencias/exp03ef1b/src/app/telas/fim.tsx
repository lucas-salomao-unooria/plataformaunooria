import { CABECALHO, E6, NOME_CURTO_DO_SUPORTE } from "../../lib/textos";
import type { ResumoDaInvestigacao } from "../../lib/tipos";
import { SeloDoJornal } from "../jornal/acoes";
import { Cabecalho } from "../jornal/cabecalho";
import { ColunaDoPainel, RodapeSomenteLeitura } from "../jornal/painel";
import { Casca } from "./casca";

/**
 * E6-ALU-03 — o Painel da Investigação, CONGELADO: quatro colunas com o
 * resumo da própria sessão (o que o servidor devolveu no `concluir`) e o
 * rodapé de somente-leitura. O "Desafio Extra" saiu (ADR-201): a janela só
 * mostrava duas fichas, sem nada a fazer com elas.
 */
export function TelaDoFim({ resumo }: { resumo: ResumoDaInvestigacao }) {
  const textos = [
    E6.suportes(resumo.suportes.escolhidas),
    E6.omissao(resumo.omissao.encontradas, NOME_CURTO_DO_SUPORTE[resumo.omissao.deFora].toLowerCase()),
    resumo.reparo.desfecho === "sucesso" ? E6.reparoSucesso : E6.reparoErro,
    E6.automacao(resumo.automacao.testes),
  ];

  return (
    <Casca topo={<Cabecalho edicao={CABECALHO.painel} />}>
      <div className="fim__cabeca">
        <h1 className="titulo-de-pagina">{E6.painel}</h1>
        <SeloDoJornal forte>{E6.concluida}</SeloDoJornal>
      </div>
      <div className="fim__colunas">
        {E6.colunas.map((titulo, i) => (
          <ColunaDoPainel key={titulo} titulo={titulo}>
            {textos[i]}
          </ColunaDoPainel>
        ))}
      </div>
      <RodapeSomenteLeitura>{E6.somenteLeitura}</RodapeSomenteLeitura>
    </Casca>
  );
}
