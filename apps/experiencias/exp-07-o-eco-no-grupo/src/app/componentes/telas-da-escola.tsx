import { useEffect, useRef, useState } from "react";
import { Button, Card, Checkbox, ProgressBar, RadioButton, Stepper } from "@edu/ui/ds";
import type { Card as CardDeSintese, Escolha } from "../../lib/tipos";
import { Pausa, Play } from "./glifos";

/**
 * As telas da ESCOLA. Aqui a fronteira da revelação já foi cruzada: o estudante
 * saiu do mensageiro, e quem fala é a plataforma.
 *
 * Um componente do clone nestas telas — ou um da plataforma dentro do grupo —
 * quebraria a ilusão que a missão está medindo. É a mesma linha da exp-02, e
 * ela é a REVELAÇÃO, não o arquivo.
 *
 * `theme="light"` explícito: a seção do clone fixa o escuro na raiz, e sem a
 * prop os componentes da plataforma herdariam o tema errado no meio da mesma
 * sessão.
 */

/** E0-SIS-01 — o breakpoint entre as duas aulas. */
export function Breakpoint() {
  return (
    <div className="escola">
      <h1 className="escola__titulo">Fim da Aula 1: investigação registrada</h1>
      <p className="escola__texto">
        Seu progresso de checagem foi salvo com segurança. Na próxima aula, ouviremos o
        episódio de recapitulação e faremos a intervenção no grupo.
      </p>
      <Card
        theme="light"
        title="Aguardando a liberação da próxima aula"
        description="A turma vai continuar junta. Você não precisa fazer nada agora."
      />
    </div>
  );
}

/** O congelamento do debate: a turma inteira na mesma tela, por decisão de quem conduz. */
export function DebateCongelado() {
  return (
    <div className="escola">
      <h1 className="escola__titulo">Hora de conversar com a turma</h1>
      <p className="escola__texto">
        Guarde o que você descobriu: a conversa agora é entre vocês. A tela volta em seguida.
      </p>
    </div>
  );
}

/**
 * E0-SIS-02 — o podcast de recapitulação.
 *
 * O botão de avançar só abre com a faixa em 100%. Sem áudio preparado, o
 * roteiro aparece em texto e o avanço libera — a Aula 2 não pode ficar
 * bloqueada porque uma síntese de voz falhou.
 */
export function Podcast({
  url,
  aoConcluir,
  aoAvancar,
  jaOuviu,
}: {
  url: string | null;
  aoConcluir: () => void;
  aoAvancar: () => void;
  jaOuviu: boolean;
}) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [tocando, setTocando] = useState(false);
  const [progresso, setProgresso] = useState(jaOuviu ? 100 : 0);

  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    const aoTempo = () => setProgresso(el.duration ? (el.currentTime / el.duration) * 100 : 0);
    const aoFim = () => {
      setTocando(false);
      setProgresso(100);
      aoConcluir();
    };
    el.addEventListener("timeupdate", aoTempo);
    el.addEventListener("ended", aoFim);
    return () => {
      el.removeEventListener("timeupdate", aoTempo);
      el.removeEventListener("ended", aoFim);
    };
  }, [aoConcluir]);

  const liberado = jaOuviu || progresso >= 99.5 || !url;

  return (
    <div className="escola">
      <h1 className="escola__titulo">Podcast Entre Redes · Recapitulação</h1>
      <p className="escola__texto">Com Lucas e Bia</p>

      {url ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <Button
              theme="light"
              variant="primary"
              onClick={() => {
                const el = audio.current;
                if (!el) return;
                if (tocando) {
                  el.pause();
                  setTocando(false);
                  return;
                }
                void el.play().then(() => setTocando(true)).catch(() => setTocando(false));
              }}
              leftIcon={tocando ? <Pausa /> : <Play />}
            >
              {tocando ? "Pausar" : "Ouvir o episódio"}
            </Button>
          </div>
          <ProgressBar theme="light" value={progresso} max={100} label="Progresso do episódio" />
          <audio ref={audio} src={url} preload="none" />
        </>
      ) : (
        <Card
          theme="light"
          title="O episódio não está disponível agora"
          description="Você pode seguir para a decisão no grupo. O conteúdo dele já está no que você investigou na aula passada."
        />
      )}

      <div className="escola__rodape">
        {!liberado && (
          <p className="escola__aviso">Ouça o episódio até o fim para seguir.</p>
        )}
        <Button theme="light" variant="primary" onClick={aoAvancar} isDisabled={!liberado}>
          Ir para a decisão no grupo
        </Button>
      </div>
    </div>
  );
}

/** E5-ALU-01 — os três cards de sistematização. */
export function CardsDeSintese({
  cards,
  lidos,
  aoAvancar,
  aoConcluir,
}: {
  cards: CardDeSintese[];
  lidos: number;
  aoAvancar: () => void;
  aoConcluir: () => void;
}) {
  const indice = Math.min(lidos, cards.length - 1);
  const atual = cards[indice];
  const ultimo = indice >= cards.length - 1;

  return (
    <div className="escola">
      <Stepper
        theme="light"
        // Sem `status` por passo: o Stepper infere de `currentStep` (anterior =
        // `completed`, atual = `selected`). Passar à mão duplicaria a regra.
        steps={cards.map((_c, i) => ({ label: String(i + 1) }))}
        currentStep={indice}
      />
      <h1 className="escola__titulo" style={{ marginTop: 16 }}>
        {atual?.titulo}
      </h1>
      <p className="escola__texto">{atual?.corpo}</p>
      <div className="escola__rodape">
        <Button theme="light" variant="primary" onClick={ultimo ? aoConcluir : aoAvancar}>
          {ultimo ? "Avançar para a reflexão" : "Avançar"}
        </Button>
      </div>
    </div>
  );
}

/**
 * E6-ALU-01 — o "Meu percurso".
 *
 * Exatamente 2 estratégias e 1 justificativa, todas de lista fechada. **Zero
 * texto livre**: este é o instrumento que vira portfólio, e ele não precisa de
 * redação para medir critério de checagem — nem deve pedi-la a um menor.
 */
export function MeuPercurso({
  estrategias,
  justificativas,
  aoEnviar,
  enviando,
  erro,
}: {
  estrategias: Escolha[];
  justificativas: Escolha[];
  aoEnviar: (estrategias: string[], justificativa: string) => void;
  enviando: boolean;
  erro: string | null;
}) {
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [justificativa, setJustificativa] = useState<string | null>(null);

  function alternar(id: string) {
    setMarcadas((atual) =>
      atual.includes(id)
        ? atual.filter((x) => x !== id)
        : // Teto de 2: marcar a terceira solta a primeira, em vez de recusar em
          // silêncio um toque que a criança acabou de dar.
          [...atual, id].slice(-2),
    );
  }

  const completo = marcadas.length === 2 && justificativa !== null;

  return (
    <div className="escola">
      <h1 className="escola__titulo">Meu percurso: critérios de checagem</h1>

      <p className="escola__texto">
        Ao receber uma mensagem alarmista em grupo de conversa, quais 2 ações são prioritárias
        antes de repassar?
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {estrategias.map((e) => (
          <Checkbox
            key={e.id}
            theme="light"
            label={e.texto}
            checked={marcadas.includes(e.id)}
            onChange={() => alternar(e.id)}
          />
        ))}
      </div>

      <p className="escola__texto">
        Por que citar a fonte oficial é mais eficiente do que discutir no chat?
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {justificativas.map((j) => (
          <RadioButton
            key={j.id}
            theme="light"
            name="justificativa"
            label={j.texto}
            checked={justificativa === j.id}
            onChange={() => setJustificativa(j.id)}
          />
        ))}
      </div>

      <div className="escola__rodape">
        {marcadas.length !== 2 && (
          <p className="escola__aviso">Escolha exatamente 2 ações.</p>
        )}
        {erro && <p className="escola__aviso">{erro}</p>}
        <Button
          theme="light"
          variant="primary"
          isDisabled={!completo || enviando}
          onClick={() => justificativa && aoEnviar(marcadas, justificativa)}
        >
          {enviando ? "Salvando…" : "Concluir e salvar no portfólio"}
        </Button>
      </div>
    </div>
  );
}

/** E6-ALU-02 — o fechamento, em modo leitura (latch). */
export function MissaoCumprida({ devolutiva }: { devolutiva: string | null }) {
  return (
    <div className="escola">
      <h1 className="escola__titulo">Missão cumprida</h1>
      <p className="escola__texto">
        Você investigou os recortes da informação, desarmou o boato no grupo comunitário e
        registrou seus critérios de checagem no portfólio.
      </p>
      {devolutiva && (
        <Card theme="light" title="Sobre o seu percurso" description={devolutiva} />
      )}
      <p className="escola__aviso" style={{ marginTop: 16 }}>
        Registro sincronizado com o Entre Redes.
      </p>
    </div>
  );
}
