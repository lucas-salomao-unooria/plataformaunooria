import { Button, ChannelHeader, Icon, ShortsShelf, TopMenuBar } from "@edu/ui/ds-unootube";

import type { Aparencia } from "../../lib/tema";
import type { VideoPublico } from "../../lib/tipos";
import { PreviaVideo } from "./PreviaVideo";

interface Props {
  nome: string;
  avatar: string;
  inscritos: number;
  fontesConfiaveis: number | null;
  salvos: VideoPublico[];
  limite: number;
  aparencia: Aparencia;
  aoTrocarAparencia: (aparencia: Aparencia) => void;
  aoAssistir: (id: string) => void;
  aoRemoverSalvo: (id: string) => void;
  aoVoltar: () => void;
  aoPedirReinicio: () => void;
}

/** "@handle" derivado do nome real do estudante (no origem era a persona fixa "Lia"). */
export function handleDoNome(nome: string): string {
  const base = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `@${base || "estudante"}`;
}

/**
 * Canal do estudante, montado com o `ChannelHeader` do DS — capa, retrato de 80px,
 * nome, arroba e contagem de inscritos são os campos que ele já publica.
 *
 * É aqui que mora a troca de aparência. O lugar é o mesmo em que um app de
 * vídeo real a guarda (dentro da conta, não solta na barra), e o controle é a
 * faixa de pílulas do DS: o estado selecionado é visível sem depender de um
 * glifo de sol e lua, que a seção não publica.
 */
export function Perfil(props: Props) {
  const { salvos, limite } = props;
  return (
    <section className="content-view profile-view">
      <ChannelHeader
        className="unootube-canal"
        avatarInitials={props.avatar}
        channelName={props.nome}
        channelHandle={handleDoNome(props.nome)}
        subscriberCount={`${props.inscritos.toLocaleString("pt-BR")} inscritos`}
        secondaryLine={
          props.fontesConfiaveis !== null
            ? `Fontes confiáveis: ${props.fontesConfiaveis}/${limite}`
            : undefined
        }
        showSearch={false}
        /*
         * O canal é o do PRÓPRIO estudante: inscrever-se em si mesmo não existe, e
         * um botão morto no clímax da tela confundiria a métrica que a missão
         * ensina a ler. Prop da 0.1.17 — antes isto era um `display: none` no
         * `globals.css`.
         */
        showSubscribe={false}
      />

      <div className="profile-appearance">
        <span className="eyebrow">APARÊNCIA</span>
        <TopMenuBar
          className="unootube-abas"
          label="Aparência do UnooTube"
          showOverflow={false}
          activeId={props.aparencia}
          onSelect={(id) => props.aoTrocarAparencia(id as Aparencia)}
          options={[
            { id: "claro", label: "Claro" },
            { id: "escuro", label: "Escuro" },
          ]}
        />
      </div>

      <div className="profile-saved-heading">
        <div>
          <h2>Meus {limite} salvos</h2>
          <p>As fontes que você escolheu para esta missão.</p>
        </div>
        <span>
          {salvos.length}/{limite}
        </span>
      </div>

      <ShortsShelf layout="grid" columnWidth={200} showLogo={false} label={null}>
        {Array.from({ length: limite }, (_, i) => {
          const video = salvos[i];
          return video ? (
            <article className="profile-video" key={video.id}>
              <PreviaVideo className="profile-video-preview" video={video} aoAssistir={props.aoAssistir} />
              <div>
                <b>{video.titulo}</b>
                <small>{video.handle}</small>
              </div>
              <Button className="acao-remover" onClick={() => props.aoRemoverSalvo(video.id)}>
                Remover
              </Button>
            </article>
          ) : (
            <div className="empty-slot" key={`vazio-${i}`}>
              <Icon name="save" size="lg" />
              <span>Espaço {i + 1}</span>
            </div>
          );
        })}
      </ShortsShelf>

      <div className="profile-actions">
        <Button className="back-to-feed" icon="arrowLeft" onClick={props.aoVoltar}>
          Voltar aos Shorts
        </Button>
        <Button className="reset-mission" onClick={props.aoPedirReinicio}>
          Reiniciar missão
        </Button>
      </div>
    </section>
  );
}
