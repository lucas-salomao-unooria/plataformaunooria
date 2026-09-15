"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { AlertBox, Button, Card, Logo, PasswordInput } from "@edu/ui/ds";
import { LogoutButton } from "@/components/logout-button";

/**
 * A senha que a escola entregou vale uma vez. Aqui a pessoa escolhe a dela.
 *
 * Ao terminar, a sessão é REFEITA com a senha nova, em silêncio. O cookie antigo
 * ainda diz "precisa trocar", e sem refazê-lo o middleware traria a pessoa de
 * volta para esta mesma tela — agora com a senha anterior já inválida, que é o
 * beco sem saída mais fácil de criar neste fluxo. Refazer o login também é mais
 * honesto que remendar o cookie: quem responde se ainda falta trocar é a api.
 */
export function FormularioDeTrocaDeSenha({ nome, usuario }: { nome: string; usuario: string }) {
  const router = useRouter();
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviando) return;
    if (senhaNova !== confirmacao) {
      setErro("As duas senhas novas precisam ser iguais.");
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      const resposta = await fetch("/api/trocar-senha", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ senhaAtual, senhaNova }),
      });
      const dados = (await resposta.json().catch(() => null)) as { mensagem?: string } | null;
      if (!resposta.ok) {
        setErro(dados?.mensagem ?? "Não foi possível trocar a senha.");
        setEnviando(false);
        return;
      }
      const reentrada = await signIn("credentials", {
        username: usuario,
        password: senhaNova,
        redirect: false,
      });
      if (!reentrada || reentrada.error) {
        // A senha FOI trocada; só a sessão não se refez. Mandar para o login é
        // melhor que deixar a pessoa numa tela que não vai mais funcionar.
        router.replace("/login");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setErro("Sem conexão agora. Tente de novo.");
      setEnviando(false);
    }
  }

  return (
    <Card variant="elevated" className="w-full max-w-[420px]">
      <form className="flex flex-col gap-6 p-1" onSubmit={onSubmit}>
        <header className="flex flex-col gap-3">
          <Logo size="md" color="navy" aria-label="Plataforma Unooria" />
          <div className="flex flex-col gap-1">
            <h1 className="text-[22px] font-bold text-unooria-neutral-950">Crie sua senha</h1>
            <p className="text-[14px] text-unooria-neutral-500">
              {nome} ({usuario}) — a senha que a escola entregou vale só para este primeiro
              acesso.
            </p>
          </div>
        </header>

        {erro ? <AlertBox theme="light" variant="error" device="auto" description={erro} /> : null}

        <PasswordInput
          id="senha-atual"
          label="Senha atual"
          value={senhaAtual}
          onChange={(e) => setSenhaAtual(e.target.value)}
          autoComplete="current-password"
          required
        />
        <PasswordInput
          id="senha-nova"
          label="Nova senha"
          helperText="Pelo menos 8 caracteres."
          value={senhaNova}
          onChange={(e) => setSenhaNova(e.target.value)}
          autoComplete="new-password"
          required
        />
        <PasswordInput
          id="senha-confirmacao"
          label="Repita a nova senha"
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
          autoComplete="new-password"
          required
        />

        <Button type="submit" variant="primary" size="lg" isLoading={enviando}>
          Salvar e continuar
        </Button>
      </form>

      {/*
       * A ÚNICA porta de saída desta tela. Ela é a única rota com sessão e sem
       * `HeaderPlataforma` — e a ausência do header é deliberada: o link da
       * marca iria para a home do papel, que o middleware devolveria para cá,
       * um link morto. Sem este botão, quem entrou com a conta errada (a escola
       * entregou a senha de outra pessoa, ou a pessoa digitou o usuário do
       * colega) fica presa: o middleware não deixa navegar para fora enquanto a
       * senha do lote não for trocada, e trocá-la exige saber a senha atual.
       */}
      <div className="flex flex-col items-center gap-1 border-t border-unooria-neutral-200 px-1 pb-1 pt-5">
        <p className="text-[13px] text-unooria-neutral-500">
          Não é você, {nome.split(" ")[0]}?
        </p>
        <LogoutButton />
      </div>
    </Card>
  );
}
