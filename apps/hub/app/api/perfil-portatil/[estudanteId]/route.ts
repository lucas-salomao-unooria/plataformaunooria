import { NextResponse, type NextRequest } from "next/server";
import { apiDoServidor } from "@/lib/api-servidor";
import { auth } from "@/lib/auth";
import { assinarPerfilPortatil } from "@/lib/chave-token";
import { hashDoPerfil, nomeDoArquivo } from "@/lib/perfil-portatil";

/**
 * EMITE o perfil portátil: um arquivo assinado que a criança leva ao sair da
 * REDE (transferência entre escolas do mesmo contrato é outra coisa — lá basta a
 * lotação).
 *
 * Rota do HUB, e não do BFF, por dois motivos que se somam: a assinatura exige a
 * chave privada, que só existe aqui, e o resultado é um DOWNLOAD, não JSON de
 * tela. A api monta o documento; este arquivo só assina e embrulha.
 *
 * Sem `CONTRATO_ID` a rota não emite: um documento cujo emissor não se identifica
 * é pior que documento nenhum — o destino não teria como procurar o JWKS nem
 * dizer de quem ele veio.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ estudanteId: string }> },
) {
  const session = await auth();
  if (!session?.usuario) {
    return NextResponse.json({ mensagem: "sem sessão" }, { status: 401 });
  }
  if (session.usuario.papel !== "gestor_escola" && session.usuario.papel !== "gestor_contrato") {
    return NextResponse.json({ mensagem: "sem permissão" }, { status: 403 });
  }

  const contrato = process.env.CONTRATO_ID;
  if (!contrato) {
    return NextResponse.json(
      {
        mensagem:
          "esta instalação não tem CONTRATO_ID: sem identificar o emissor, o documento não vale nada na rede de destino",
      },
      { status: 503 },
    );
  }

  const { estudanteId } = await params;
  const montado = await apiDoServidor<Record<string, unknown>>(
    `/estudantes/${encodeURIComponent(estudanteId)}/perfil-portatil`,
  ).catch(async () => {
    // Fallback para api antiga caso ainda use /estudantes/
    return apiDoServidor<Record<string, unknown>>(
      `/estudantes/${encodeURIComponent(estudanteId)}/perfil-portatil`,
    );
  });
  if (!montado) {
    return NextResponse.json(
      { mensagem: "não foi possível emitir — o estudante precisa estar numa escola sua e ter CPF" },
      { status: 404 },
    );
  }

  const emitidoEm = new Date();
  const perfil: Record<string, unknown> = {
    ...montado,
    emitidoEm: emitidoEm.toISOString(),
    emissor: {
      contrato,
      hub: process.env.HUB_ORIGIN ?? "http://localhost:3000",
      nome: process.env.CONTRATO_NOME ?? null,
    },
  };

  const assinatura = await assinarPerfilPortatil(hashDoPerfil(perfil));
  const titular = (perfil.titular ?? {}) as { nome?: string };
  const arquivo = JSON.stringify({ perfil, assinatura }, null, 2);

  return new NextResponse(arquivo, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${nomeDoArquivo(titular.nome ?? "estudante", emitidoEm)}"`,
      "cache-control": "no-store",
    },
  });
}
