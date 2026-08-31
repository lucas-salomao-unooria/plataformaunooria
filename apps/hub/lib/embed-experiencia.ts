import "server-only";
import type { Session } from "next-auth";
import { assinarTokenExperiencia } from "./chave-token";
import { baseDevDaExperiencia } from "./experiencias-dev";

/**
 * Montagem do embed de uma experiência — o que `/exp/[expId]` fazia inline,
 * extraído porque agora há DUAS superfícies que embedam: a do estudante
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

export type PublicoDaExperiencia = "estudante" | "professor" | "estudante";

export interface ManifestoDeExperiencia {
  expId: string;
  nome: string;
  versaoAtiva: string;
  viewport?: { largura: number; altura: number } | null;
  /** Ausente em linhas antigas = estudante (default do schema da api). */
  publico?: PublicoDaExperiencia;
  /** Permissões de iframe (hoje só `pointer-lock`). Ausente = nenhuma. */
  permissoes?: readonly string[];
}

type Usuario = Session["usuario"];

export interface Embed {
  manifesto: ManifestoDeExperiencia | null;
  src: string;
  expOrigin: string;
  token: string;
  /** Usuário logado que carrega os dados no handshake do hub:init. */
  estudante: { id: string; nome: string; serie: string; turmaId: string; escolaId: string };
  apiUrl: string;
  viewport: { largura: number; altura: number } | null;
  /** Repassado ao `ExpFrame`: liga `allow-pointer-lock` no sandbox. */
  permissoes: readonly string[];
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

/**
 * A leitura do manifesto do bundle falhou — e este aviso existe porque o
 * silêncio já custou um diagnóstico inteiro.
 *
 * Sem manifesto na tabela E sem conseguir ler o `experiencia.json` do bundle, o
 * embed segue com `viewport: null` e `permissoes: []`. Os dois degradam de um
 * jeito que NÃO aponta para aqui: a experiência de aparelho aparece esticada na
 * janela, e a exp-70 (jogo 3D em primeira pessoa) abre sem
 * `allow-pointer-lock` — a criança entra na vila, a câmera não gira, o teclado
 * não anda, e não há erro em lugar nenhum. O `catch {}` que vivia aqui
 * transformava uma configuração errada num bug de jogo.
 *
 * MEDIDO em 2026-08-27, no compose local: dois dev servers da exp-70 disputando
 * a 5177 (um no host, um no container). O do host tinha subido antes de
 * `allowedHosts` existir no `vite.config.ts` e respondia
 * `403 Blocked request. This host ("host.docker.internal") is not allowed.`
 * ao hub — que engolia o 403 e servia o jogo sem o token do sandbox.
 */
function avisarManifestoIlegivel(expId: string, url: string, causa: string): void {
  console.warn(
    `[hub] ${expId}: sem linha na tabela \`experiencias\` e o \`experiencia.json\` do ` +
      `bundle não pôde ser lido (${url} → ${causa}). O embed segue SEM viewport e SEM ` +
      `permissões de iframe: experiência de aparelho aparece esticada, e a que precisa de ` +
      `\`pointer-lock\` (exp-70) abre com a câmera travada. Confira o dev server da ` +
      `experiência e o \`allowedHosts\` do vite.config.ts dela.`,
  );
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
  let permissoesDoBundle: readonly string[] = [];
  if (!manifesto) {
    const url = `${baseInterna}/experiencia.json`;
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (r.ok) {
        const meta = (await r.json()) as {
          viewport?: { largura: number; altura: number };
          permissoes?: readonly string[];
        };
        viewportDoBundle = meta.viewport ?? null;
        // Pelo MESMO motivo do viewport: sem a tabela `experiencias` populada
        // (compose local, ambiente novo antes do 1º publish do CI) a exp-70
        // abriria sem `allow-pointer-lock` — o jogo monta, a câmera não anda, e
        // nada no console diz por quê.
        permissoesDoBundle = meta.permissoes ?? [];
      } else {
        avisarManifestoIlegivel(expId, url, `HTTP ${r.status}`);
      }
    } catch (erro) {
      avisarManifestoIlegivel(expId, url, erro instanceof Error ? erro.message : String(erro));
    }
  }

  const hubOrigin = encodeURIComponent(process.env.HUB_ORIGIN ?? "http://localhost:3000");
  const src = manifesto
    ? `${cdn}/${manifesto.expId}/${manifesto.versaoAtiva}/index.html?hubOrigin=${hubOrigin}`
    : `${base}/?hubOrigin=${hubOrigin}`;

  const estudantePayload = {
    id: usuario.id,
    nome: usuario.nome,
    serie: usuario.serie ?? "",
    turmaId: usuario.turmaId ?? "",
    escolaId: usuario.escolaId,
  };

  return {
    manifesto,
    src,
    expOrigin: new URL(base).origin,
    token,
    estudante: estudantePayload,
    apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
    viewport: manifesto?.viewport ?? viewportDoBundle,
    permissoes: manifesto?.permissoes ?? permissoesDoBundle,
  };
}
