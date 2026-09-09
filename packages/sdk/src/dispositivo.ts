/**
 * O que o navegador sabe do aparelho (ADR-84), para ir junto do erro e do vital.
 *
 * A pergunta de campo é sempre a mesma: "trava no Chromebook?", "está lento no
 * 4G?". Sem isto, a resposta dependia de alguém estar na escola no momento.
 *
 * Três das cinco medidas NÃO são padrão — `connection`, `deviceMemory` e, em
 * parte, `hardwareConcurrency` só existem em Chromium. Safari e Firefox devolvem
 * `undefined`, e isso é dado: metade da rede pública roda Chromium em
 * Chromebook, e a ausência já separa as populações. Nada aqui lança, nada aqui
 * bloqueia — um erro coletando contexto de erro seria o pior laço possível.
 *
 * Nenhum campo identifica pessoa. A COMBINAÇÃO deles, porém, aproxima-se de
 * impressão digital de aparelho: por isso a lista é fechada, não cresce sem
 * ADR, e o que vira rótulo de métrica é só a classificação grossa que a api
 * deriva do user-agent.
 */
export interface DispositivoDoNavegador {
  largura: number;
  altura: number;
  dpr?: number;
  conexao?: "slow-2g" | "2g" | "3g" | "4g";
  memoriaGb?: number;
  nucleos?: number;
}

const CONEXOES = ["slow-2g", "2g", "3g", "4g"] as const;

/** `navigator.connection.effectiveType` sem `any`: o campo não está no lib.dom. */
function conexaoDe(nav: Navigator): DispositivoDoNavegador["conexao"] {
  const bruto: unknown = (nav as unknown as Record<string, unknown>).connection;
  if (typeof bruto !== "object" || bruto === null) return undefined;
  const tipo: unknown = (bruto as Record<string, unknown>).effectiveType;
  return CONEXOES.find((c) => c === tipo);
}

function numeroFinito(valor: unknown): number | undefined {
  return typeof valor === "number" && Number.isFinite(valor) && valor >= 0 ? valor : undefined;
}

export function lerDispositivo(alvo?: Window): DispositivoDoNavegador | undefined {
  const janela = alvo ?? (typeof window === "undefined" ? undefined : window);
  if (!janela) return undefined;
  try {
    const nav = janela.navigator as Navigator & Record<string, unknown>;
    return {
      // `innerWidth`, não `screen.width`: o que importa é a área onde a tela
      // foi desenhada — num iframe de experiência as duas divergem.
      largura: Math.round(janela.innerWidth),
      altura: Math.round(janela.innerHeight),
      dpr: numeroFinito(janela.devicePixelRatio),
      conexao: conexaoDe(nav),
      memoriaGb: numeroFinito(nav.deviceMemory),
      nucleos: numeroFinito(nav.hardwareConcurrency),
    };
  } catch {
    // Navegador endurecido (privacidade, extensão) pode lançar no acesso.
    return undefined;
  }
}
