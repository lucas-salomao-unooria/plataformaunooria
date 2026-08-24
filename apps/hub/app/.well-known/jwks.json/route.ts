import { NextResponse } from "next/server";
import { jwksPublico } from "@/lib/chave-token";

/** JWKS do emissor de tokens de experiência (o hub). A api valida contra
 *  esta URL (`OIDC_JWKS_URI`); trocar para WSO2 = trocar a env na api. */
export async function GET() {
  return NextResponse.json(await jwksPublico(), {
    headers: { "cache-control": "public, max-age=300" },
  });
}
