"use client";

import { useState } from "react";

import { Badge, Button, Icon, Tag, TextArea, TextField, Toggle, Tooltip } from "@edu/ui/ds";
import { arteFallback } from "@/lib/arte-fallback";
import { FICHAS, avatarProcedural, formatarContagem } from "@/lib/insta-tipos";

import type { PostRevisao } from "./tipos-revisao";

const ROTULO_LADO: Record<string, string> = {
  A: "Lado A",
  B: "Lado B",
  neutro: "Neutro",
};

/**
 * Preview do post na revisão do professor: mesma anatomia do card do estudante
 * (doc 03) mais os rótulos que só o professor pode ver — lado, intensidade,
 * categoria e gancho emocional.
 */
export function CartaoPost({
  post,
  aoMudar,
}: {
  post: PostRevisao;
  aoMudar: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [caption, setCaption] = useState(post.caption);
  const [comentarios, setComentarios] = useState(post.comments);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const avatar = avatarProcedural(post.author.handle);
  const arte = arteFallback(post.id, post.categoria);

  async function chamar(rota: string, init: RequestInit, tarefa: string) {
    setOcupado(tarefa);
    try {
      const resposta = await fetch(rota, init);
      if (resposta.ok) aoMudar();
    } finally {
      setOcupado(null);
    }
  }

  const salvar = () =>
    chamar(
      `/api/plataforma/posts/${post.id}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caption,
          comentarios: comentarios.map((comentario) => ({
            id: comentario.id,
            texto: comentario.texto,
          })),
        }),
      },
      "salvar",
    ).then(() => setEditando(false));

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-unooria-neutral-200 bg-unooria-neutral-50">
      <header className="flex items-center gap-2 px-3 py-2">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
          style={{ background: avatar.gradiente }}
          aria-hidden
        >
          {avatar.iniciais}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-unooria-neutral-950">
            {post.author.handle}
            {post.author.verificado ? (
              <span className="ml-1 text-action">✔</span>
            ) : null}
          </p>
          <p className="truncate text-[11px] text-unooria-neutral-500">
            {post.author.displayName}
          </p>
        </div>
        <Badge
          variant={
            post.lado === "A"
              ? "info"
              : post.lado === "B"
                ? "warning"
                : "neutral"
          }
          size="sm"
        >
          {ROTULO_LADO[post.lado]}
        </Badge>
      </header>

      <div className="relative aspect-post w-full">
        {post.imageStatus === "ok" && post.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.imageUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-2"
            style={{ background: arte.corFundo }}
          >
            <span className="text-[40px]">{arte.emojis}</span>
            <span className="px-6 text-center text-[11px] text-black/70">
              {post.imageStatus === "pendente"
                ? "imagem na fila"
                : "arte procedural (fallback)"}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 px-3 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag variant="neutral" size="sm">
            int. {post.intensidade}
          </Tag>
          {/* Perfil de linguagem: é o que o professor precisa ver para julgar
              se o texto está de fato falando com aquele valor (doc 10 §3). */}
          <Tag variant="info" size="sm">
            {FICHAS[post.perfil]?.rotulo ?? post.perfil}
          </Tag>
          <Tag variant="neutral" size="sm">
            {post.categoria}
          </Tag>
          {post.emotionalHook ? (
            <Tag variant="neutral" size="sm">
              {post.emotionalHook}
            </Tag>
          ) : null}
        </div>

        <p className="text-[12px] text-unooria-neutral-500">
          ♥ {formatarContagem(post.likesCount)} · {post.timestampLabel} ·{" "}
          {post.comments.length} comentários
        </p>

        {editando ? (
          <div className="flex flex-col gap-2">
            <TextArea
              label="Legenda"
              rows={5}
              value={caption}
              onChange={(evento) => setCaption(evento.target.value)}
            />
            {comentarios.map((comentario, indice) => (
              <TextField
                key={comentario.id}
                label={`Comentário ${indice + 1}`}
                value={comentario.texto}
                onChange={(evento) =>
                  setComentarios((atual) =>
                    atual.map((item) =>
                      item.id === comentario.id
                        ? { ...item, texto: evento.target.value }
                        : item,
                    ),
                  )
                }
              />
            ))}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="primary"
                isLoading={ocupado === "salvar"}
                onClick={() => void salvar()}
              >
                Salvar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setCaption(post.caption);
                  setComentarios(post.comments);
                  setEditando(false);
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-[13px] leading-snug text-unooria-neutral-950">
              {post.caption}
            </p>
            <p className="text-[12px] text-link">{post.hashtags.join(" ")}</p>
            {post.comments.slice(0, 2).map((comentario) => (
              <p
                key={comentario.id}
                className="text-[12px] text-unooria-neutral-700"
              >
                <span className="font-semibold">{comentario.handle}</span>{" "}
                {comentario.texto}
              </p>
            ))}
          </>
        )}
      </div>

      {/*
        Rodapé em duas zonas. Antes eram cinco botões de texto em `flex-wrap`
        dentro de um card de ~300px: "Regerar imagem" e "Tirar do feed" quebravam
        em linhas irregulares e a ação destrutiva ficava do lado da mais usada.

        Agora a DECISÃO (o post entra no feed?) é um Toggle à esquerda — ela é
        contínua, não um comando — e as quatro AÇÕES viram ícones à direita, com
        tooltip e rótulo acessível. Altura fixa, nada quebra, e "Excluir" fica
        separado por um divisor para não ser clicado por reflexo.
      */}
      <footer className="flex items-center gap-2 border-t border-unooria-neutral-200 px-3 py-2">
        <Toggle
          size="xs"
          checked={post.aprovado}
          /* Rótulo estável: um interruptor descreve o que ele controla, não o
             estado atual — o próprio botão já mostra ligado/desligado. Texto
             que muda de largura fazia o rodapé inteiro se mexer a cada clique. */
          label={<span className="whitespace-nowrap">No feed</span>}
          disabled={ocupado === "aprovar"}
          onChange={() =>
            void chamar(
              `/api/plataforma/posts/${post.id}`,
              {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ aprovado: !post.aprovado }),
              },
              "aprovar",
            )
          }
        />

        <div className="ml-auto flex items-center gap-0.5">
          <Tooltip content={editando ? "Fechar edição" : "Editar texto"}>
            <Button
              size="sm"
              variant="ghost"
              aria-label={editando ? "Fechar edição" : "Editar texto"}
              aria-pressed={editando}
              leftIcon={<Icon name={editando ? "close" : "edit"} size={18} />}
              onClick={() => setEditando((atual) => !atual)}
            />
          </Tooltip>

          <Tooltip content="Regerar texto">
            <Button
              size="sm"
              variant="ghost"
              aria-label="Regerar texto"
              isLoading={ocupado === "texto"}
              leftIcon={<Icon name="autorenew" size={18} />}
              onClick={() =>
                void chamar(
                  `/api/plataforma/posts/${post.id}/regenerar`,
                  {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ alvo: "texto" }),
                  },
                  "texto",
                )
              }
            />
          </Tooltip>

          <Tooltip content="Regerar imagem">
            <Button
              size="sm"
              variant="ghost"
              aria-label="Regerar imagem"
              isLoading={ocupado === "imagem"}
              leftIcon={<Icon name="image" size={18} />}
              onClick={() =>
                void chamar(
                  `/api/plataforma/posts/${post.id}/regenerar`,
                  {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ alvo: "imagem" }),
                  },
                  "imagem",
                )
              }
            />
          </Tooltip>

          <span
            aria-hidden
            className="mx-1 h-5 w-px bg-unooria-neutral-200"
          />

          <Tooltip content="Excluir publicação">
            <Button
              size="sm"
              variant="ghost"
              aria-label="Excluir publicação"
              isLoading={ocupado === "excluir"}
              leftIcon={<Icon name="delete" size={18} />}
              className="cartao-post__excluir"
              onClick={() =>
                void chamar(
                  `/api/plataforma/posts/${post.id}`,
                  { method: "DELETE" },
                  "excluir",
                )
              }
            />
          </Tooltip>
        </div>
      </footer>
    </article>
  );
}
