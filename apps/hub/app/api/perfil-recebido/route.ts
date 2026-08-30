import { NextResponse, type NextRequest } from "next/server";
import { apiDoServidorBruto } from "@/lib/api-servidor";
import { auth } from "@/lib/auth";

/**
 * RECEBE um perfil portátil emitido por outra instalação.
 *
 * Quem confere a assinatura é a API, não este arquivo — e é de propósito
 * (`portabilidade/verificacao.ts`): verificar é o passo que não pode confiar em
 * quem chama, e o hub é quem chama.
 *
 * A rota existe porque o BFF engole a falha em `null`, e aqui o MOTIVO da recusa
 * é a única coisa que o gestor precisa ler: "assinatura adulterada", "não há
 * estudante com este CPF nesta rede" e "documento de uma versão que não sei ler"
 * pedem três ações diferentes dele.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.usuario) {
    return NextResponse.json({ mensagem: "sem sessão" }, { status: 401 });
  }
  if (session.usuario.papel !== "gestor" && session.usuario.papel !== "admin-contrato") {
    return NextResponse.json({ mensagem: "sem permissão" }, { status: 403 });
  }

  const corpo = await request.json().catch(() => null);
  if (!corpo || typeof corpo !== "object") {
    return NextResponse.json({ mensagem: "arquivo ilegível" }, { status: 400 });
  }

  const { escolaId, arquivo } = corpo as { escolaId?: string; arquivo?: unknown };
  const caminho = escolaId
    ? `/perfis-recebidos?escolaId=${encodeURIComponent(escolaId)}`
    : "/perfis-recebidos";

  const resposta = await apiDoServidorBruto<Record<string, unknown>>(caminho, {
    method: "POST",
    body: arquivo,
  });
  if (!resposta.ok) {
    /* A api devolve `{ erro, detalhe }` dentro do 400. Repassar o detalhe é o
       ponto: "assinatura adulterada", "não há estudante com este CPF aqui" e
       "versão que não sei ler" pedem três ações diferentes do gestor. */
    const corpoDoErro = (resposta.dados ?? {}) as { message?: unknown };
    const dentro = (corpoDoErro.message ?? corpoDoErro) as { erro?: string; detalhe?: string };
    return NextResponse.json(
      {
        mensagem: dentro?.detalhe ?? "o documento foi recusado.",
        erro: dentro?.erro ?? "recusado",
      },
      { status: resposta.status || 400 },
    );
  }
  return NextResponse.json(resposta.dados);
}
