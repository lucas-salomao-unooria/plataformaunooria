import { Card, Tag } from "@edu/ui/ds";
import { MANCHETES, ROTULO_DA_MANCHETE, ROTULO_DO_NO, ROTULO_DO_TIPO, type Material } from "@/lib/efeito-amplificador-tipos";

/**
 * O material de O Efeito Amplificador, VIVO (de `GET /efeito-amplificador/professor/material`):
 * o pacote padrão COM o gabarito (a pauta do grêmio, os três nós, os
 * comentários e a categoria de cada um) e os dois indicadores do Explicar, para ler antes;
 * as réguas das quatro habilidades, para o depois. Sem a api, o cartão diz que
 * não carregou — o resto do guia continua servindo.
 */
function NaoCarregou() {
  return (
    <Card variant="outlined">
      <p className="text-[13px] text-unooria-neutral-600">O material da missão não carregou agora. Recarregue a página em instantes.</p>
    </Card>
  );
}

export function GabaritoDoEfeito({ dados }: { dados: Material | null }) {
  if (!dados) return <NaoCarregou />;
  const c = dados.padrao.conteudo;
  return (
    <Card variant="outlined" title={`O pacote padrão — “${dados.padrao.nome}”, com o gabarito`}>
      <div className="flex flex-col gap-4 text-[13px] leading-relaxed text-unooria-neutral-800">
        <div className="flex flex-col gap-1">
          <strong className="text-unooria-neutral-950">{`A pauta do grêmio: ${c.pauta.titulo}`}</strong>
          <p>{c.pauta.descricao}</p>
          <ul className="list-disc pl-5">
            {c.pauta.orientacoes.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          {c.rascunho.map((p) => (
            <div key={p.id} className="flex flex-col gap-1">
              {p.no ? (
                <Tag variant="warning" size="sm" pill>
                  {ROTULO_DO_NO[p.no]}
                </Tag>
              ) : null}
              <p>{p.texto}</p>
              {p.corrigido ? <p className="text-unooria-neutral-600">{`Quando o estudante pede: ${p.corrigido}`}</p> : null}
            </div>
          ))}
          <p className="text-unooria-neutral-600">{`A frase que o algoritmo destaca no feed (sobrevive às correções): “${c.recorte}”`}</p>
        </div>
        <ul className="flex flex-col gap-1">
          {MANCHETES.map((m) => (
            <li key={m}>
              <strong>{ROTULO_DA_MANCHETE[m]}:</strong> {c.manchetes[m]}
            </li>
          ))}
        </ul>
        <ul className="flex flex-col gap-2">
          {c.comentarios.map((com) => (
            <li key={com.id}>
              <Tag variant="neutral" size="sm" pill>
                {ROTULO_DO_TIPO[com.tipo]}
              </Tag>{" "}
              <strong>{`${com.autor} · ${com.horario}`}</strong> {com.texto}
            </li>
          ))}
        </ul>
        <div>
          <strong>Os indicadores do Explicar (os dois revelam o critério de entrega do algoritmo):</strong>
          <ul className="list-disc pl-5">
            {dados.indicadores.map((i) => (
              <li key={i.id}>{`${i.rotulo}: ${i.texto}`}</li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}

export function ReguasDoEfeito({ dados }: { dados: Material | null }) {
  if (!dados) return <NaoCarregou />;
  return (
    <Card variant="outlined" title="O critério de cada nível (registrado pelo que o estudante faz)">
      <div className="flex flex-col gap-3 text-[13px] leading-relaxed text-unooria-neutral-800">
        {dados.habilidades.map((h) => (
          <div key={h.codigo} className="flex flex-col gap-1">
            <strong className="text-unooria-neutral-950">{`${h.codigo} — ${h.rotulo}`}</strong>
            <span>{`Atingiu: ${h.criterios.atingiu}`}</span>
            <span>{`Em processo: ${h.criterios.em_processo}`}</span>
            <span>{`Não atingiu: ${h.criterios.nao_atingiu}`}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
