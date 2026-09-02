import { NextResponse } from "next/server";

/**
 * Sonda de vida do hub: só prova que o processo do Next responde. Sem
 * dependência nenhuma, de propósito — o que separa "o hub caiu" de "a api
 * caiu" no alerta é justamente esta rota não tocar na api (cap. 17).
 *
 * Fora do `matcher` do middleware de autenticação (que não cobre `/api/*`) e
 * `force-dynamic` para o Next não a servir de cache.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true });
}
