import "server-only";
import type { Session } from "next-auth";
import { assinarTokenExperiencia } from "./chave-token";
import { baseDevDaExperiencia } from "./experiencias-dev";

/**
 * Montagem do embed de uma experiência — o que `/exp/[expId]` fazia inline,
 * extraído porque agora há DUAS superfícies que embedam: a do aluno
 * (`/exp/[expId]`) e a do professor (`/professor/plano-de-aula`, exp-90).
 *
 * Regras que valem para as duas:
 *  - token assinado pelo hub com os claims do usuário LOGADO (sem tela de
 *    login na experiência; WSO2 troca só o emissor);
 *  - com manifesto: URL versionada do bucket/CDN (rollback = `versaoAtiva`);
 *  - sem manifesto (dev): dev server do Vite da experiência
 *    (`lib/experiencias-dev.ts`) ou o `srcDev` explícito (`/dev-embed?src=`);
 *  - `expOrigin` do postMessage sai da MESMA URL do iframe, senão o ExpFrame
 *    descarta o `exp:ready` por origin e o handshake expira.
 */

export type PublicoDaExperiencia = "aluno" | "professor";

export interface ManifestoDeExperiencia {
  expId: string;
  nome: string;
  versaoAtiva: string;
  viewport?: { largura: number; altura: number } | null;
  /** Ausente em linhas antigas = aluno (default do schema da api). */
  publico?: PublicoDaExperiencia;
}

type Usuario = Session["usuario"];

export interface Embed {
  manifesto: ManifestoDeExperiencia | null;
  src: string;
  expOrigin: string;
  token: string;
  /** Nome herdado do protocolo v1: carrega o usuário logado, seja aluno ou professor. */
  aluno: { id: string; nome: string; serie: string; turmaId: string; escolaId: string };
  apiUrl: string;
  viewport: { largura: number; altura: number } | null;
}

/**
 * De onde o SERVIDOR lê o `experiencia.json` do bundle, quando o endereço do
 * iframe (`base`) não serve — típico do hub em container, onde `localhost:5173`
 * é o próprio container.
 *
 *  - `EXP_INTERNAL_URL`: endereço fixo, usado como está. Só serve quando há UMA
 *    origem de bundles (o CDN, em produção).
 *  - `EXP_INTERNAL_HOST`: troca só o host e PRESERVA a porta. É o que serve em
 *    dev, onde cada experiência tem um dev server numa porta diferente: um
 *    `EXP_INTERNAL_URL` fixo faria as três lerem o manifesto de uma só (e o
 *    UnooTube, que não tem `viewport`, apareceria dentro do aparelho da
 *    Instanooria).
 *
 * Ausentes = o mesmo `base` do iframe.
 */
function urlInternaDoBundle(base: string): string {
  const explicito = process.env.EXP_INTERNAL_URL;
  if (explicito) return explicito.replace(/\/$/, "");

  const host = process.env.EXP_INTERNAL_HOST;
  if (!host) return base;

  const url = new URL(base);
  // Com porta ("cdn.interno:8080") troca host+porta; sem porta, preserva a do `base`.
  if (host.includes(":")) url.host = host;
  else url.hostname = host;
  return url.toString().replace(/\/$/, "");
}

/** Consulta o manifesto de versões na api (tabela `experiencias`). */
export async function buscarManifesto(expId: string, token: string): Promise<ManifestoDeExperiencia | null> {
  try {
    const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:3001";
    const r = await fetch(`${apiUrl}/experiencias/${encodeURIComponent(expId)}`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!r.ok) return null;
    const { experiencia } = (await r.json()) as { experiencia: ManifestoDeExperiencia | null };
    return experiencia;
  } catch {
    return null;
  }
}

export async function montarEmbed(
  expId: string,
  usuario: Usuario,
  opts: { srcDev?: string } = {},
): Promise<Embed> {
  const token = await assinarTokenExperiencia({
    sub: usuario.id,
    escola_id: usuario.escolaId,
    turma_id: usuario.turmaId,
    perfil: usuario.papel,
  });

  const emProducao = process.env.NODE_ENV === "production";
  // `srcDev` (bancada /dev-embed) dispensa o manifesto; fora de produção e sem
  // manifesto, cai no dev server registrado da experiência.
  const manifesto = opts.srcDev && !emProducao ? null : await buscarManifesto(expId, token);

  const cdn = process.env.NEXT_PUBLIC_CDN_EXP_URL ?? "http://localhost:5173";
  const emDev = !manifesto && !emProducao;
  const base = (emDev ? (opts.srcDev ?? baseDevDaExperiencia(expId, cdn)) : cdn).replace(/\/$/, "");

  // SEM MANIFESTO o bundle é servido na raiz de `base` — e o `experiencia.json`
  // dele está do lado do index (por isso o arquivo vive em `public/`). É de lá
  // que vem o `viewport`, ou seja: a decisão de embedar a experiência dentro do
  // `DispositivoFrame`. A leitura NÃO é só de dev: antes era, e uma stack sem a
  // tabela `experiencias` populada (compose local, ambiente novo antes do
  // primeiro publish do CI) servia o Instanooria esticado na janela inteira em
  // vez do aparelho de 375×812.
  //
  // `EXP_INTERNAL_URL`/`EXP_INTERNAL_HOST` existem pelo mesmo motivo que
  // `API_INTERNAL_URL`: esta leitura é server-side, e `NEXT_PUBLIC_CDN_EXP_URL`
  // é o endereço que o BROWSER usa — de dentro de um container,
  // `localhost:5173` é o próprio container.
  const baseInterna = urlInternaDoBundle(base);
  let viewportDoBundle: { largura: number; altura: number } | null = null;
  if (!manifesto) {
    try {
      const r = await fetch(`${baseInterna}/experiencia.json`, { cache: "no-store" });
      if (r.ok) {
        const meta = (await r.json()) as { viewport?: { largura: number; altura: number } };
        viewportDoBundle = meta.viewport ?? null;
      }
    } catch {
      // bundle/dev server fora do ar — segue sem viewport
    }
  }

  const hubOrigin = encodeURIComponent(process.env.HUB_ORIGIN ?? "http://localhost:3000");
  const src = manifesto
    ? `${cdn}/${manifesto.expId}/${manifesto.versaoAtiva}/index.html?hubOrigin=${hubOrigin}`
    : `${base}/?hubOrigin=${hubOrigin}`;

  return {
    manifesto,
    src,
    expOrigin: new URL(base).origin,
    token,
    aluno: {
      id: usuario.id,
      nome: usuario.nome,
      serie: usuario.serie ?? "",
      turmaId: usuario.turmaId ?? "",
      escolaId: usuario.escolaId,
    },
    apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
    viewport: manifesto?.viewport ?? viewportDoBundle,
  };
}
