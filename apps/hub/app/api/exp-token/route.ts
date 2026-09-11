import { NextResponse } from "next/server";
import { auth, unstable_update } from "@/lib/auth";
import { assinarTokenExperiencia } from "@/lib/chave-token";
import { log } from "@/lib/log";

/**
 * Reemite o token de experiência a partir da SESSÃO (cookie httpOnly).
 * É o outro lado do `exp:token-expirando`: o ExpFrame chama aqui e responde
 * `hub:token` ao iframe. O token nunca fica em storage — só em memória.
 *
 * E ELA CONTA COMO ATIVIDADE (ADR-96). A sessão do hub é uma janela de
 * INATIVIDADE que desliza a cada leitura — mas só o middleware devolve o
 * `Set-Cookie`, e esta rota está fora do `matcher` dele. Sem a renovação
 * explícita abaixo, quem fica dentro de uma missão não navega mais no hub e vê
 * a sessão envelhecer como se estivesse parado: ela morre com a criança
 * trabalhando, e a partir do 401 nada do que ela fizer é gravado.
 */
export async function GET() {
  const session = await auth();
  if (!session?.usuario) {
    return NextResponse.json({ mensagem: "sem sessão" }, { status: 401 });
  }
  const u = session.usuario;
  // A experiência não abre com senha de primeiro acesso: o middleware prende as
  // PÁGINAS, e sem esta linha o token continuaria saindo por aqui.
  if (u.precisaTrocarSenha) {
    return NextResponse.json({ mensagem: "troque a senha antes de continuar" }, { status: 403 });
  }
  const token = await assinarTokenExperiencia({
    sub: u.id,
    escola_id: u.escolaId,
    turma_id: u.turmaId,
    perfil: u.papel,
  });
  /*
   * A renovação vem DEPOIS de assinar, e engole o próprio erro, porque a
   * prioridade é o passe: falhar em deslizar a sessão custa, no pior caso, um
   * logoff mais cedo; falhar em emitir o token para a missão em andamento
   * custa a aula. `unstable_update` escreve o cookie via `cookies().set()`, o
   * que `auth()` não faz — e `{}` é de propósito: o callback `jwt` só mescla
   * quando recebe `session.usuario`, então um objeto vazio renova o prazo sem
   * tocar no conteúdo da sessão.
   */
  try {
    await unstable_update({});
  } catch {
    log.warn({ codigo: "sessao-nao-renovada" }, "o pedido de passe não conseguiu deslizar a sessão");
  }
  return NextResponse.json({ token });
}
