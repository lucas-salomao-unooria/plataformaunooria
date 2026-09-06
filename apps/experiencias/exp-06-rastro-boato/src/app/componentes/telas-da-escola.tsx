import { useEffect, useRef, useState } from "react";
import {
  AlertBox,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  TextArea,
} from "@edu/ui/ds";
import { SEGUNDOS_DE_LEITURA_DO_GRAFICO, segundosDesde } from "../../lib/regras";
import type { Bloco, Curvas, IdDeBloco, Podcast, Topologia } from "../../lib/tipos";
import { GraficoDasCurvas } from "./curvas";
import { MapaDaRede } from "./mapa-da-rede";

/**
 * As telas de FORA do mensageiro — da revelação em diante.
 *
 * **A linha é a REVELAÇÃO, não o arquivo.** O disfarce vale enquanto o
 * estudante está dentro do grupo tomando a decisão. Do breakpoint em diante
 * quem conduz é a escola: a professora abre a Aula 2, a plataforma revela a
 * topologia, sistematiza o ciclo e guarda o percurso.
 *
 * **Afastamento declarado do PRD**: os wireframes põem a Etapa 4 dentro do
 * clone, como um "painel de métricas do grupo". O WhatsApp real não tem
 * visualizador de topologia de rede — inventar a tela quebraria o "Teste do App
 * sem Legenda" que o próprio QA de design aplicou, e é a mesma decisão que o
 * ranking do UnooTube já tinha tomado. Ver o `AGENTS.md` desta pasta.
 */

// ───────────────────────────────────────────── Etapa 1: contexto (a largada)

export function TelaDeContexto({ nome, aoEntrar }: { nome: string; aoEntrar: () => void }) {
  return (
    <div className="escola">
      <div className="escola__pilha">
        <h1 style={{ fontSize: 20, margin: 0 }}>Olá, {nome}.</h1>
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          Uma mensagem sobre a água da escola gerou pânico e correu quatro grupos em dez minutos.
          Mas quase ninguém viu a nota da direção. Por que o boato voa e a checagem fica para trás?
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Mensagem de alerta não confirmada</CardTitle>
          </CardHeader>
          <CardContent>
            <strong style={{ fontSize: 22 }}>480 encaminhamentos</strong>
            <div>em 10 minutos</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nota oficial com laudo técnico</CardTitle>
          </CardHeader>
          <CardContent>
            <strong style={{ fontSize: 22 }}>12 encaminhamentos</strong>
            <div>em 10 minutos</div>
          </CardContent>
        </Card>

        <Button onClick={aoEntrar}>Entrar no aplicativo</Button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────── breakpoint: a pausa entre as aulas

/**
 * A espera do fim da Aula 1.
 *
 * A frase diz que está tudo bem e que o progresso está salvo. Uma tela de
 * bloqueio genérica faria a criança achar que perdeu a missão — e ela não fez
 * nada errado: ela chegou ao fim da aula.
 */
export function TelaDeEspera() {
  return (
    <div className="escola">
      <div className="escola__pilha">
        <AlertBox>
          <strong>Debate em andamento — olhe para a frente da sala.</strong>
        </AlertBox>
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          Sua investigação e sua resposta estão salvas. A conversa continua na próxima aula.
        </p>
      </div>
    </div>
  );
}

// ────────────────────────────────────── Etapa 4: as curvas e a malha de nós

export function TelaDasCurvas({
  curvas,
  aoVerOMapa,
}: {
  curvas: Curvas;
  aoVerOMapa: (permanenciaSeg: number) => void;
}) {
  const [liberado, setLiberado] = useState(false);
  const abertaEm = useRef(Date.now());

  useEffect(() => {
    const id = window.setTimeout(
      () => setLiberado(true),
      SEGUNDOS_DE_LEITURA_DO_GRAFICO * 1000,
    );
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="escola">
      <div className="escola__pilha">
        <h2 style={{ fontSize: 17, margin: 0 }}>Velocidade nas primeiras horas</h2>
        <GraficoDasCurvas curvas={curvas} />
        <p className="legenda">
          Aviso não confirmado: {curvas.boato.at(-1)} conexões em {curvas.minutos.at(-1)} min
        </p>
        <p className="legenda">
          Nota oficial: {curvas.laudo.at(-1)} conexões em {curvas.minutos.at(-1)} min
        </p>
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          O aviso correu <strong>{curvas.razao} vezes</strong> mais que a nota da direção.
        </p>
        {/* A trava de 5s é analítica: sem ela o estudante toca "Ver mapa" antes
            de ler a assimetria, e o Aha! chega sem o contraste que o sustenta. */}
        <Button
          disabled={!liberado}
          onClick={() => aoVerOMapa(segundosDesde(abertaEm.current))}
        >
          {liberado ? "Ver o mapa da rede" : "Leia o gráfico…"}
        </Button>
      </div>
    </div>
  );
}

export function TelaDoMapa({
  topologia,
  aoVoltar,
  aoAvancar,
}: {
  topologia: Topologia;
  aoVoltar: () => void;
  aoAvancar: () => void;
}) {
  return (
    <div className="escola">
      <div className="escola__pilha">
        <h2 style={{ fontSize: 17, margin: 0 }}>Por onde a mensagem passou</h2>
        <MapaDaRede topologia={topologia} />
        <Card>
          <CardContent>
            <strong>{topologia.legenda}</strong>
            <div style={{ marginTop: 4 }}>
              Alcance total: {topologia.alcance.toLocaleString("pt-BR")} pessoas
            </div>
          </CardContent>
        </Card>
        {/* Voltar às curvas é intencional: comparar as duas leituras é o que a
            Etapa 4 pede, e travar o caminho de volta empobreceria a análise. */}
        <Button variant="secondary" onClick={aoVoltar}>
          Ver o gráfico de novo
        </Button>
        <Button onClick={aoAvancar}>Construir o ciclo do boato</Button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────── Etapa 5: o construtor

/**
 * A decomposição do ciclo, por TOQUE SEQUENCIAL — não por arraste.
 *
 * Toca no bloco, toca no slot. `drag-and-drop` num Chromebook de escola é
 * hostil, não funciona com teclado e é inacessível a leitor de tela
 * (RNF-A11Y-001). O toque sequencial faz as três coisas de graça, e o PRD já o
 * previa como alternativa — aqui ele é o caminho principal.
 */
export function TelaDoConstrutor({
  blocos,
  aoConfirmar,
  erro,
}: {
  blocos: Bloco[];
  aoConfirmar: (ordem: IdDeBloco[]) => void;
  erro: string | null;
}) {
  const [slots, setSlots] = useState<(IdDeBloco | null)[]>([null, null, null, null]);
  const [naMao, setNaMao] = useState<IdDeBloco | null>(null);

  const usados = new Set(slots.filter((s): s is IdDeBloco => s !== null));
  const completo = slots.every((s) => s !== null);

  function tocarNoSlot(indice: number) {
    setSlots((atuais) => {
      const copia = [...atuais];
      /* Tocar num slot cheio devolve o bloco ao banco. É o "desfazer" que a
         criança procura primeiro, e sem ele a única saída seria recarregar. */
      if (!naMao) {
        copia[indice] = null;
        return copia;
      }
      const anterior = copia.indexOf(naMao);
      if (anterior >= 0) copia[anterior] = null;
      copia[indice] = naMao;
      return copia;
    });
    setNaMao(null);
  }

  return (
    <div className="escola">
      <div className="construtor">
        <h2 style={{ fontSize: 17, margin: 0 }}>O ciclo do boato</h2>
        <p style={{ margin: 0, fontSize: 13 }}>
          Toque num bloco e depois no lugar dele na ordem.
        </p>

        <div className="construtor__slots">
          {slots.map((id, i) => {
            const bloco = blocos.find((b) => b.id === id);
            return (
              <button
                type="button"
                key={i}
                className={`construtor__slot${id ? " construtor__slot--cheio" : ""}`}
                onClick={() => tocarNoSlot(i)}
                aria-label={bloco ? `Posição ${i + 1}: ${bloco.texto}` : `Posição ${i + 1}, vazia`}
              >
                <span className="construtor__numero">{i + 1}</span>
                <span>{bloco?.texto ?? "—"}</span>
              </button>
            );
          })}
        </div>

        <div className="construtor__banco">
          {blocos
            .filter((b) => !usados.has(b.id))
            .map((b) => (
              <button
                type="button"
                key={b.id}
                className="construtor__bloco"
                aria-pressed={naMao === b.id}
                onClick={() => setNaMao(naMao === b.id ? null : b.id)}
              >
                {b.texto}
              </button>
            ))}
        </div>

        {erro && <AlertBox>{erro}</AlertBox>}

        <Button
          disabled={!completo}
          onClick={() => aoConfirmar(slots.filter((s): s is IdDeBloco => s !== null))}
        >
          Confirmar o modelo
        </Button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────── Etapa 6: o Meu percurso

export function TelaDoPercurso({
  pergunta,
  teto,
  podcast,
  aoSalvar,
  salvando,
}: {
  pergunta: string;
  teto: number;
  podcast: Podcast;
  aoSalvar: (texto: string) => void;
  salvando: boolean;
}) {
  const [texto, setTexto] = useState("");
  const limpo = texto.trim();

  return (
    <div className="escola">
      <div className="escola__pilha">
        <h2 style={{ fontSize: 17, margin: 0 }}>Meu percurso</h2>

        <Card>
          <CardContent>{pergunta}</CardContent>
        </Card>

        <TextArea
          value={texto}
          maxLength={teto}
          rows={5}
          onChange={(e: { target: { value: string } }) => setTexto(e.target.value)}
          placeholder="Escreva sua resposta"
        />
        <p className="escola__contador">
          {texto.length}/{teto} caracteres
        </p>

        {/* O episódio em TEXTO. A locução ainda não foi gravada, e a missão roda
            igual — quando o áudio chegar, ele entra ao lado, nunca no lugar. */}
        <Card>
          <CardHeader>
            <CardTitle>{podcast.titulo}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="escola__podcast">
              {podcast.blocos.map((b) => (
                <div key={b.rotulo}>
                  <strong style={{ fontSize: 12 }}>{b.rotulo}</strong>
                  <ul className="escola__falas">
                    {b.falas.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Button disabled={limpo.length === 0 || salvando} onClick={() => aoSalvar(limpo)}>
          Salvar no Meu percurso
        </Button>
      </div>
    </div>
  );
}

export function TelaConcluida({ texto }: { texto: string | null }) {
  return (
    <div className="escola">
      <div className="escola__pilha">
        <AlertBox>
          <strong>Missão concluída.</strong> Sua reflexão foi gravada no portfólio.
        </AlertBox>
        {texto && (
          <Card>
            <CardContent>{texto}</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
