import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { EXP_ID_RE } from "@edu/sdk";
import { logDaRequisicao } from "@/lib/log";

/**
 * Resultado do handshake da ponte (cap. 17): o `ExpFrame` manda um beacon
 * quando o `exp:ready` é aceito ou recusado por protocolo. Vira UMA linha
 * `INFO` com `codigo=ponte.handshake` — a métrica "handshakes por resultado" é
 * uma métrica de LOG (Terraform), não um contador em processo: o hub não tem
 * leitor de métricas, e uma linha por abertura de experiência (~400 mil/mês
 * num contrato em regime, ~0,2 GiB) cabe folgado na franquia.
 *
 * Sem `auth()`: `sendBeacon` no descarregar não garante cookie, e o dado é
 * inofensivo (dois enums e um número). Zod fechado e 204 sempre.
 */
const Schema = z
  .object({
    resultado: z.enum(["ok", "protocolo-incompativel"]),
    protocolo: z.number().int().min(0).max(99),
    expId: z.union([z.literal(""), z.string().regex(EXP_ID_RE)]),
  })
  .strict();

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const corpo = Schema.safeParse(await request.json().catch(() => null));
  if (corpo.success) {
    logDaRequisicao(request.headers).info(
      { codigo: "ponte.handshake", resultado: corpo.data.resultado, protocolo: corpo.data.protocolo, expId: corpo.data.expId || undefined },
      "handshake da ponte",
    );
  }
  return new NextResponse(null, { status: 204 });
}
