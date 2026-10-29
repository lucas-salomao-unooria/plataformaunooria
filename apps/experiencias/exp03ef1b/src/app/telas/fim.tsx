import { useState } from "react";
import { telemetria } from "../../lib/telemetria";
import { CABECALHO, E6, NOME_CURTO_DO_SUPORTE } from "../../lib/textos";
import type { FichaExtra, ResumoDaInvestigacao } from "../../lib/tipos";
import { enderecoDaImagem } from "../comum/midia";
import { AcaoDoJornal, SeloDoJornal } from "../jornal/acoes";
import { Cabecalho } from "../jornal/cabecalho";
import { ColunaDoPainel, FotoDaMateria, JanelaDoJornal, RodapeSomenteLeitura } from "../jornal/painel";
import { FichaDeCampos } from "../mecanica/ficha";
import { conteudoDaFicha } from "./ficha";
import { Casca } from "./casca";

/**
 * E6-ALU-03 — o Painel da Investigação, CONGELADO: quatro colunas com o
 * resumo da própria sessão (o que o servidor devolveu no `concluir`) e o
 * rodapé de somente-leitura. "Desafio Extra" abre as duas fichas do banco
 * padrão, SÓ LEITURA — nada se grava.
 */
export function TelaDoFim({
  resumo,
  desafioExtra,
  inicial,
}: {
  resumo: ResumoDaInvestigacao;
  desafioExtra: readonly FichaExtra[];
  inicial?: { desafioAberto?: boolean };
}) {
  const [aberto, setAberto] = useState(inicial?.desafioAberto ?? false);
  const textos = [
    E6.suportes(resumo.suportes.escolhidas),
    E6.omissao(resumo.omissao.encontradas, NOME_CURTO_DO_SUPORTE[resumo.omissao.deFora].toLowerCase()),
    resumo.reparo.desfecho === "sucesso" ? E6.reparoSucesso : E6.reparoErro,
    E6.automacao(resumo.automacao.testes),
  ];

  return (
    <Casca
      topo={
        <Cabecalho
          edicao={CABECALHO.painel}
          acao={
            <AcaoDoJornal
              variante="secondary"
              aoTocar={() => {
                telemetria.abriuDesafioExtra();
                setAberto(true);
              }}
            >
              {E6.desafioExtra}
            </AcaoDoJornal>
          }
        />
      }
    >
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
      <JanelaDoJornal aberta={aberto} titulo={E6.desafioExtra} descricao={E6.desafioApoio} aoFechar={() => setAberto(false)}>
        <div className="desafio-extra">
          {desafioExtra.map((f, i) => (
            <div key={f.manchete} className="desafio-extra__item">
              <FotoDaMateria src={enderecoDaImagem(f.imagem, i === 0 ? "extra-1" : "extra-2")} alt={f.imagem.alt} legenda={f.manchete} />
              <FichaDeCampos compacta campos={conteudoDaFicha(f.ficha)} />
            </div>
          ))}
        </div>
      </JanelaDoJornal>
    </Casca>
  );
}

