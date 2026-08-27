import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { RELOGIO_DA_TELA, cronometroDe, segundosRestantes } from "../../lib/relogio";
import type { EstadoDoRelogio, RelogioPublico, RespostaRelogio } from "../../lib/tipos";

/**
 * O relógio da tempestade — de parede, e da TURMA.
 *
 * Quem dá a partida é o professor, e ela vale para todos ao mesmo tempo. O aluno
 * que chega antes vê o cronômetro parado e cheio; quando o professor libera,
 * todos marcam o mesmo, porque a conta parte do instante ABSOLUTO gravado na
 * turma — a latência do polling atrasa a notícia, nunca o relógio.
 *
 * MUDANÇA DO PORTE: o cliente não recalcula mais o minuto da cidade. No projeto
 * de origem a matemática do pivô (esticar a aula sem rebobinar a chuva) existia
 * nos DOIS lados, e duas cópias de uma conta sutil são duas chances de divergir.
 * Agora a api manda `EstadoDoRelogio` pronto e o cliente só faz o número descer
 * de um em um entre dois pollings — que é desenho, não medida.
 */

/**
 * Busca o relógio da turma de tempos em tempos: é assim que a partida dada pelo
 * professor chega ao aluno que está esperando, sem ele ter o que enviar.
 */
export function useRelogioDaTurma(
  inicial: { relogio: RelogioPublico; estado: EstadoDoRelogio },
  ativo: boolean,
): { relogio: RelogioPublico; estado: EstadoDoRelogio } {
  const [atual, setAtual] = useState(inicial);

  const buscar = useCallback(async () => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    try {
      const dados = await api.get<RespostaRelogio>("/unoogpt/relogio");
      if (dados?.relogio) setAtual({ relogio: dados.relogio, estado: dados.estado });
    } catch {
      // Rede instável de laboratório: a próxima volta resolve. A contagem local
      // continua andando com o que já sabe.
    }
  }, []);

  useEffect(() => {
    if (!ativo) return;
    // `void` explícito: `buscar` é async e um listener espera retorno vazio.
    // A promessa é deliberadamente descartada — falha de rede de laboratório se
    // resolve na volta seguinte, e o cronômetro local continua andando.
    const disparar = () => {
      void buscar();
    };
    const id = setInterval(disparar, 5000);
    window.addEventListener("focus", disparar);
    document.addEventListener("visibilitychange", disparar);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", disparar);
      document.removeEventListener("visibilitychange", disparar);
    };
  }, [ativo, buscar]);

  return atual;
}

/**
 * Os segundos que faltam, descendo de um em um.
 *
 * Quantizado em segundos: a tela toda pendura neste estado, e redesenhar o mapa
 * quatro vezes por segundo pica a leitura sem mostrar nada novo.
 */
export function useContagem(relogio: RelogioPublico, estado: EstadoDoRelogio): number | null {
  const [segundos, setSegundos] = useState(() => segundosRestantes(relogio, estado, Date.now()));

  useEffect(() => {
    setSegundos(segundosRestantes(relogio, estado, Date.now()));
    if (estado.fase !== "correndo") return;
    const id = setInterval(() => {
      setSegundos(segundosRestantes(relogio, estado, Date.now()));
    }, 500);
    return () => clearInterval(id);
  }, [relogio, estado]);

  return segundos;
}

export function RelogioDaTempestade({
  estado,
  segundos,
}: {
  estado: EstadoDoRelogio;
  segundos: number | null;
}) {
  if (estado.fase === "aguardando") {
    return (
      <span className="flex items-center gap-2 rounded-gpt-md border border-gpt-borda px-3 py-2">
        <span className="text-sm text-gpt-suave-60">Aguardando o professor</span>
        <span className="font-mono text-lg font-bold tabular-nums text-gpt-suave-60">
          {cronometroDe(segundos ?? RELOGIO_DA_TELA.duracaoRealEmSegundos)}
        </span>
      </span>
    );
  }

  if (segundos === null) {
    return (
      <span className="flex items-center gap-2 rounded-gpt-md border border-gpt-borda px-3 py-2">
        <span className="text-sm font-semibold text-gpt-tinta">Sem tempo marcado</span>
        <span className="text-xs text-gpt-suave-60">até o professor encerrar</span>
      </span>
    );
  }

  const fechado = segundos <= 0;
  const apertado = segundos <= 60;
  const decorrido = Math.min(1, estado.minutosGastos / RELOGIO_DA_TELA.minutosTotais);

  return (
    <span className="grid gap-1">
      <span className="flex items-center justify-end gap-2">
        <span className="text-sm text-gpt-suave-60">
          {fechado
            ? estado.motivoDoFim === "professor"
              ? "Investigação encerrada"
              : "As equipes precisam sair"
            : "Para investigar"}
        </span>
        <span
          className={`font-mono text-lg font-bold tabular-nums ${
            fechado || apertado ? "text-gpt-erro" : "text-gpt-tinta"
          }`}
        >
          {cronometroDe(segundos)}
        </span>
      </span>
      <span className="h-1 w-full overflow-hidden rounded-gpt-full bg-gpt-superficie">
        <span
          className={`block h-full rounded-gpt-full transition-all ${
            fechado || apertado ? "bg-gpt-erro" : "bg-gpt-inverso"
          }`}
          style={{ width: `${decorrido * 100}%` }}
        />
      </span>
    </span>
  );
}
