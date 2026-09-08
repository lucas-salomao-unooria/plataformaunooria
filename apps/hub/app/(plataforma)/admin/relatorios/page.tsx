import { redirect } from "next/navigation";
import { apiDoServidor } from "@/lib/api-servidor";
import { auth } from "@/lib/auth";
import { ehDoContrato, GESTORES_DO_CONTRATO, type Papel } from "@/lib/papeis";
import { RelatorioDaRegional } from "./relatorio-da-regional";

export const metadata = { title: "Relatório da diretoria — Plataforma Unooria" };

/**
 * `/admin/relatorios` — o supervisor da regional e os perfis de contrato.
 *
 * Professor e gestor de UMA escola não chegam aqui: o relatório é da diretoria,
 * e para quem tem uma escola ele seria a própria escola com um título errado.
 */
export default async function RelatoriosPage() {
  const session = await auth();
  const papel = session!.usuario.papel as Papel;
  const permitido = papel === "gestor_regional" || GESTORES_DO_CONTRATO.includes(papel);
  if (!permitido) redirect("/admin/usuarios");

  /* O seletor de regional só existe para os perfis de contrato — o
     `gestor_regional` lê a própria, e a api ignora o parâmetro dele. Buscar a
     lista no servidor evita a tela abrir vazia e preencher depois. */
  const regionais = ehDoContrato(papel)
    ? ((await apiDoServidor<Array<{ id: string; nome: string }>>(
        "/escolas?tipo=regional",
      )) ?? [])
    : [];

  return <RelatorioDaRegional papel={papel} regionais={regionais} />;
}
