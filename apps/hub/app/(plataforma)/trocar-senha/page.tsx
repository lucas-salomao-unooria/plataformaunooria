import { auth } from "@/lib/auth";
import { FormularioDeTrocaDeSenha } from "./formulario";

export const metadata = { title: "Trocar senha — Plataforma Unooria" };

/**
 * Primeiro acesso. Fica FORA das áreas de papel: estudante, professor e gestor
 * chegam todos aqui, e o middleware não deixa sair enquanto a senha do lote não
 * for trocada.
 */
export default async function TrocarSenhaPage() {
  const session = await auth();
  const usuario = session!.usuario; // middleware garante a sessão
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-10 unooria-surface">
      <FormularioDeTrocaDeSenha nome={usuario.nome} usuario={usuario.usuario} />
    </main>
  );
}
