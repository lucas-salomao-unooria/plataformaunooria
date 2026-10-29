import { Card, CardContent, CardHeader, Icon, ScrollBar, Tag } from "@edu/ui/ds";
import { TEXTOS } from "../lib/textos";
import type { SessaoPreparada } from "../lib/tipos";

/**
 * E6-ALU-03 — a conclusão, na voz da ESCOLA (`@edu/ui/ds`): o selo "Missão
 * Oficial Concluída — Protocolo Homologado", o texto e o modo somente
 * leitura. Sem podcast (decisão 1: ele é do professor, como na exp02em1b) e
 * sem resumo interpretativo do que o estudante fez — a régua é do professor.
 */
export function Conclusao({ sessao }: { sessao: SessaoPreparada }) {
  const t = sessao.textos.conclusao;
  return (
    <ScrollBar className="escola" height="100%" autoHide theme="light">
      <div className="escola__pilha escola__pilha--centrada" data-tela="conclusao">
        <Card variant="outlined">
          <CardHeader icon={<Icon name="verified" />} tag={<Tag variant="success" size="sm">{t.somenteLeitura}</Tag>} title={t.selo} />
          <CardContent>
            <h2 className="escola__titulo">{TEXTOS.conclusao.titulo}</h2>
            <p className="escola__fala">{TEXTOS.conclusao.texto}</p>
          </CardContent>
        </Card>
      </div>
    </ScrollBar>
  );
}
