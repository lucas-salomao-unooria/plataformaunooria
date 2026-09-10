import { z } from "zod";
import { ViewportSchema } from "../experiencias/contrato-de-rotas";

/**
 * O manifesto GUARDADO em `experiencias_versoes.manifesto`, como ele volta.
 *
 * Existe porque aquele JSONB tem DUAS formas em circulação, e ignorar isso
 * quebraria o rollback justamente nas linhas mais antigas:
 *
 *  - as do `PUT /experiencias/:expId` (o CI) trazem o corpo do upsert, onde a
 *    versão se chama `versaoAtiva`;
 *  - as do backfill da migration e as do seed trazem o `experiencia.json` cru,
 *    onde ela se chama `versao`.
 *
 * A diferença é SÓ no nome da versão — e este schema não a lê: quem ativa já
 * sabe qual versão está ativando (é o parâmetro da rota). O que se lê aqui são
 * os campos que precisam VOLTAR com o rollback, e esses têm o mesmo nome nas
 * duas formas.
 *
 * Tudo com default ou `nullish` de propósito: manifesto de época anterior a um
 * campo é dado real, e recusar o rollback por causa dele seria travar a
 * operação de incidente que este schema existe para servir.
 */
export const ManifestoGuardadoSchema = z.object({
  nome: z.string(),
  series: z.array(z.string()).default([]),
  unidade: z.number().int().nullish(),
  produto: z.string().nullish(),
  capabilities: z.array(z.string()).default([]),
  viewport: ViewportSchema.nullish(),
  publico: z.string().default("estudante"),
  permissoes: z.array(z.string()).default([]),
});
