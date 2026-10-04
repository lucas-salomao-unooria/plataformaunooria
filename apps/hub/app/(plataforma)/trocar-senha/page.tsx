import { auth } from "@/lib/auth";
import { homeDoPapel } from "@/lib/papeis";
import { FormularioDeTrocaDeSenha } from "./formulario";

export const metadata = { title: "Trocar senha — Plataforma Unooria" };

/**
 * DUAS portas para a mesma tela, e as duas FORA das áreas de papel:
 *
 * - **Primeiro acesso** — o middleware não deixa sair enquanto a senha do lote
 *   não for trocada;
 * - **Troca voluntária** (H01.4.1) — pelo "Trocar senha" do menu do avatar, a
 *   qualquer momento, com a saída de volta à área da pessoa.
 *
 * As regras são as mesmas (a senha atual, 8 caracteres, diferente da atual): a
 * rota da api é uma só.
 */
export default async function TrocarSenhaPage() {
  const session = await auth();
  const usuario = session!.usuario; // middleware garante a sessão
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-10 unooria-surface">
      <FormularioDeTrocaDeSenha
        nome={usuario.nome}
        usuario={usuario.usuario}
        primeiroAcesso={Boolean(usuario.precisaTrocarSenha)}
        home={homeDoPapel(usuario.papel)}
      />
    </main>
  );
}
