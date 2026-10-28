import "@unooria/design-system/unoojornal.css";
import "@unooria/design-system/fonts/unoojornal.css";
import "@unooria/design-system/unooria.css";
import "@unooria/design-system/fonts/unooria.css";
import "../estilos/globals.css";

import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { AvisoDeConexao } from "../app/jornal/avisos";
import { Espera } from "../app/mecanica/espera";
import { TelaDosCarimbos } from "../app/telas/carimbos";
import { TelaDoCaso } from "../app/telas/caso";
import { TelaDoDesfecho } from "../app/telas/desfecho";
import { TelaDaEscolha } from "../app/telas/escolha";
import { TelaDaFicha } from "../app/telas/ficha";
import { TelaDoFiltro } from "../app/telas/filtro";
import { TelaDoFim } from "../app/telas/fim";
import { TelaDaGaleria } from "../app/telas/galeria";
import { TelaDaOmissao } from "../app/telas/omissao";
import { TelaDaPonte } from "../app/telas/ponte";
import { TelaDoReparo } from "../app/telas/reparo";
import { TelaDaRotina } from "../app/telas/rotina";
import { ILUSTRACAO } from "../app/comum/midia";
import { E3, GLOBAL } from "../lib/textos";
import { BLOCOS, CASO, ESTEIRA_DO_PROTOTIPO, ETIQUETAS, FIM, IDS, JORNAL, SIMULACAO } from "./dados";

/**
 * VITRINE — só desenvolvimento (`/vitrine.html?q=<nome do print>`). Cada
 * entrada desenha UMA tela num estado, com os dados de exemplo e sem api,
 * para a comparação lado a lado com os prints do protótipo (1024×768). Os
 * nomes são os dos prints.
 */
const nada = () => undefined;
const telao = JORNAL.reportagens[2]!;
const FICHA_DO_TELAO = { quem: "estudantes", onde: null, quando: "sexta" } as const;

const ESTADOS: Record<string, () => ReactNode> = {
  "11-E1-ALU-01-padrao": () => <TelaDaGaleria jornal={JORNAL} selos={[]} ocupado={false} aoSelar={nada} aoAvancar={nada} inicial={{ erroDeMidia: false, pulsando: false }} />,
  "12-E1-ALU-01-modal_aberto": () => (
    <TelaDaGaleria jornal={JORNAL} selos={[]} ocupado={false} aoSelar={nada} aoAvancar={nada} inicial={{ aberta: IDS[0], erroDeMidia: false, pulsando: false }} />
  ),
  "12b-E1-ALU-01-cartaz_pulsando": () => (
    <TelaDaGaleria jornal={JORNAL} selos={[]} ocupado={false} aoSelar={nada} aoAvancar={nada} inicial={{ aberta: IDS[0], erroDeMidia: false, pulsando: true }} />
  ),
  "13-E1-ALU-01-confirmado": () => <TelaDaGaleria jornal={JORNAL} selos={IDS} ocupado={false} aoSelar={nada} aoAvancar={nada} inicial={{ erroDeMidia: false, pulsando: false }} />,
  "14-E1-SIS-01-erro_midia": () => <TelaDaGaleria jornal={JORNAL} selos={[]} ocupado={false} aoSelar={nada} aoAvancar={nada} inicial={{ erroDeMidia: true, pulsando: false }} />,
  "15-E2-ALU-01-vazia": () => <TelaDaEscolha reportagens={JORNAL.reportagens} previsao={{ itens: [], travada: false }} ocupado={false} aoTravar={nada} />,
  "16-E2-ALU-01-preenchida": () => (
    <TelaDaEscolha reportagens={JORNAL.reportagens} previsao={{ itens: [], travada: false }} ocupado={false} aoTravar={nada} inicial={{ caixa: IDS }} />
  ),
  "17-E2-ALU-01-travada": () => <TelaDaEscolha reportagens={JORNAL.reportagens} previsao={{ itens: IDS, travada: true }} ocupado={false} aoTravar={nada} />,
  "18-E3-ALU-01-padrao": () => <TelaDoFiltro ocupado={false} aoBuscar={() => Promise.resolve(0)} />,
  "19-E3-ALU-01-pastilha_selecionada": () => <TelaDoFiltro ocupado={false} aoBuscar={() => Promise.resolve(2)} inicial={{ campo: "onde", valor: "patio" }} />,
  "19b-E3-ALU-01-zero_resultados": () => <TelaDoFiltro ocupado={false} aoBuscar={() => Promise.resolve(0)} inicial={{ campo: "quem", valor: "professores", zero: true }} />,
  "20-E3-ALU-02-omissao_visivel": () => (
    <TelaDaOmissao reportagens={JORNAL.reportagens} escolhidas={IDS} encontradas={IDS.slice(0, 2)} aguardando={false} ocupado={false} aoConfrontar={nada} />
  ),
  "21-E3-SIS-01-espera_professor": () => (
    <TelaDaOmissao reportagens={JORNAL.reportagens} escolhidas={IDS} encontradas={IDS.slice(0, 2)} aguardando ocupado={false} aoConfrontar={nada} />
  ),
  "22-E3-SIS-02-sem_sinal": () => (
    <>
      <TelaDoFiltro ocupado={false} aoBuscar={() => Promise.resolve(0)} inicial={{ campo: "onde", valor: null }} />
      <AvisoDeConexao aviso="rede" aoReconectar={nada} />
    </>
  ),
  "24-E4-PROF-01-sala_pausada": () => (
    <>
      <div className="app__tela" inert>
        <TelaDosCarimbos fotoDoTelao={ILUSTRACAO.telao} ocupado={false} aoEnviar={nada} />
      </div>
      <Espera titulo={E3.conversar} apoio={GLOBAL.pausa} />
    </>
  ),
  "25-E4-ALU-01-ficha_aberta": () => <TelaDaFicha telao={telao} ficha={FICHA_DO_TELAO} jaAberta ocupado={false} aoAbrir={nada} aoAvancar={nada} inicial={{ pulsando: false }} />,
  "25b-E4-ALU-01-pulso": () => <TelaDaFicha telao={telao} ficha={FICHA_DO_TELAO} jaAberta={false} ocupado={false} aoAbrir={nada} aoAvancar={nada} inicial={{ pulsando: true }} />,
  "26-E4-ALU-02-carimbado": () => <TelaDosCarimbos fotoDoTelao={ILUSTRACAO.telao} ocupado={false} aoEnviar={nada} inicial={{ k1: "v", k2: "x", k3: "v" }} />,
  "27-E4-ALU-03-em_reparo": () => <TelaDoReparo etiquetas={ETIQUETAS} ocupado={false} aoConcluir={nada} />,
  "28-E4-ALU-03-validacao_pendente": () => (
    <TelaDoReparo
      etiquetas={ETIQUETAS}
      ocupado={false}
      aoConcluir={nada}
      inicial={{ montagem: { quem: "et-2mz", onde: "et-k9p", quando: "et-q7r" } }}
    />
  ),
  "28b-E4-ALU-03-etiqueta_escolhida": () => (
    <TelaDoReparo etiquetas={ETIQUETAS} ocupado={false} aoConcluir={nada} inicial={{ montagem: { quem: null, onde: "et-k9p", quando: null }, escolhida: "et-2mz" }} />
  ),
  "29-E4-ALU-04-sucesso_reparado": () => <TelaDoDesfecho desfecho="sucesso" reportagens={JORNAL.reportagens} ocupado={false} aoContinuar={nada} />,
  "30-E4-ALU-05-erro_explicado": () => <TelaDoDesfecho desfecho="erro" reportagens={JORNAL.reportagens} ocupado={false} aoContinuar={nada} />,
  "31-E5-ALU-00-padrao": () => <TelaDaPonte ocupado={false} aoContinuar={nada} />,
  "32-E5-ALU-01-em_edicao": () => (
    <TelaDaRotina
      blocos={BLOCOS}
      simulacaoSalva={null}
      ocupado={false}
      aoTestar={() => Promise.resolve(null)}
      aoIrParaCaso={nada}
      inicial={{ esteira: [ESTEIRA_DO_PROTOTIPO[0]!, ESTEIRA_DO_PROTOTIPO[1]!, null, null, null, null, null], escolhido: "bl-h3j" }}
    />
  ),
  "33-E5-ALU-01-executando": () => (
    <TelaDaRotina
      blocos={BLOCOS}
      simulacaoSalva={SIMULACAO}
      ocupado={false}
      aoTestar={() => Promise.resolve(null)}
      aoIrParaCaso={nada}
      inicial={{ esteira: ESTEIRA_DO_PROTOTIPO, modo: "executando", quadro: 1 }}
    />
  ),
  "34-E5-ALU-01-concluido": () => (
    <TelaDaRotina blocos={BLOCOS} simulacaoSalva={SIMULACAO} ocupado={false} aoTestar={() => Promise.resolve(null)} aoIrParaCaso={nada} />
  ),
  "35-E5-SIS-01-erro_parada": () => (
    <TelaDaRotina
      blocos={BLOCOS}
      simulacaoSalva={null}
      ocupado={false}
      aoTestar={() => Promise.resolve(null)}
      aoIrParaCaso={nada}
      inicial={{ esteira: ESTEIRA_DO_PROTOTIPO, modo: "erro" }}
    />
  ),
  "36-E6-ALU-01-investigando": () => (
    <TelaDoCaso caso={CASO} ocupado={false} aoEnviar={nada} inicial={{ marcas: { k4: "v" }, ferramenta: CASO.ferramentas[0] ?? null }} />
  ),
  "37-E6-ALU-01-carimbado": () => <TelaDoCaso caso={CASO} ocupado={false} aoEnviar={nada} inicial={{ marcas: { k4: "v", k5: "duvida", k6: "x" } }} />,
  "40-E6-ALU-03-congelado_final": () => <TelaDoFim resumo={FIM.resumo} desafioExtra={FIM.desafioExtra} />,
  "40b-E6-ALU-03-desafio_extra": () => <TelaDoFim resumo={FIM.resumo} desafioExtra={FIM.desafioExtra} inicial={{ desafioAberto: true }} />,
};

function Vitrine() {
  const q = new URLSearchParams(window.location.search).get("q") ?? "";
  const estado = ESTADOS[q];
  if (!estado) {
    return (
      <ul>
        {Object.keys(ESTADOS).map((k) => (
          <li key={k}>
            <a href={`?q=${k}`}>{k}</a>
          </li>
        ))}
      </ul>
    );
  }
  return <div className="app">{estado()}</div>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Vitrine />
  </StrictMode>,
);
