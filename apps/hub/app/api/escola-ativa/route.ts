import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiDoServidor } from "@/lib/api-servidor";
import { auth, unstable_update } from "@/lib/auth";

const CorpoSchema = z.object({ escolaId: z.string().min(1).max(64) });

/**
 * Troca a ESCOLA ATIVA de quem está lotado em mais de uma.
 *
 * O token de dados carrega UMA escola — é o que mantém a RLS e as 31 tabelas com
 * `escola_id` funcionando sem mudança nenhuma. Trocar de escola, portanto, é
 * trocar a sessão.
 *
 * A validação é feita CONTRA A API (`GET /escolas/minhas`), nunca contra a lista
 * que o cookie carrega: cookie é dado do cliente, e aceitar a escola que ele
 * pedir seria deixar qualquer professor ler qualquer unidade da rede.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.usuario) {
    return NextResponse.json({ mensagem: "sem sessão" }, { status: 401 });
  }

  const corpo = CorpoSchema.safeParse(await request.json().catch(() => null));
  if (!corpo.success) {
    return NextResponse.json({ mensagem: "escola inválida" }, { status: 400 });
  }

  const minhas = await apiDoServidor<Array<{ id: string; nome: string; papel: string }>>(
    "/escolas/minhas",
  );
  const escolha = minhas?.find((e) => e.id === corpo.data.escolaId);
  if (!escolha) {
    return NextResponse.json({ mensagem: "você não está lotado nesta escola" }, { status: 403 });
  }

  await unstable_update({
    usuario: {
      ...session.usuario,
      escolaId: escolha.id,
      // A turma de referência é da OUTRA escola: mantê-la faria o claim
      // `turma_id` apontar para uma turma que não existe aqui.
      turmaId: undefined,
      escolas: minhas ?? session.usuario.escolas,
    },
  });

  return NextResponse.json({ ok: true, escola: escolha });
}
