/**
 * Locuções da missão — arquivos MP3 do bundle (`public/audio/<id>.mp3`).
 *
 * TOLERANTE À AUSÊNCIA por desenho: as gravações profissionais (Nina, Leo,
 * Sofia — brief de assets, fase 3) ainda não foram produzidas, e o código já
 * referencia os nomes CANÔNICOS do brief. Arquivo que não existe (404) ou
 * autoplay bloqueado pelo navegador NUNCA quebra a missão: a redundância
 * tripla texto+ícone+áudio degrada para texto+ícone, que continua legível.
 *
 * Um só <audio> vivo por vez: duas locuções ao mesmo tempo é cacofonia, não
 * acessibilidade.
 */

let tocando: HTMLAudioElement | null = null;

/** Ids canônicos do brief (`aud_<etapa>_<chave>`). */
export const AUDIO = {
  e1Saudacao: "aud_e1_instrucao_saudacao",
  e1Marca: "aud_e1_instrucao_escolha_marca",
  e1Pronta: "aud_e1_feedback_marca_pronta",
  e2DegenScroll: "aud_e2_instrucao_degen_scroll",
  e3SelFoto: "aud_e3_instrucao_selecionar_foto",
  e3SelLegenda: "aud_e3_instrucao_selecionar_legenda",
  e3Leg1: "aud_e3_rotulo_legenda_1",
  e3Leg2: "aud_e3_rotulo_legenda_2",
  e3DegenInacao: "aud_e3_instrucao_degen_inaction",
  e5Roda: "aud_e5_instrucao_roda_conversa",
  e5Espera: "aud_e5_instrucao_espera_docente",
  e6Sintese: "aud_e6_pergunta_sintese",
  e6OptLupa: "aud_e6_rotulo_opcao_lupa",
  e6OptGlobo: "aud_e6_rotulo_opcao_globo",
  e6RetryGlobo: "aud_e6_feedback_retry_globo",
  errConexao: "aud_err_feedback_conexao",
  errSessao: "aud_err_feedback_sessao",
} as const;

/** SFX curtos (obturador, curtida, crachá, fanfarra). */
export const SFX = {
  shutter: "sfx_shutter",
  like: "sfx_like",
  badge: "sfx_badge",
  fanfare: "sfx_fanfare",
} as const;

/**
 * Toca uma locução ou SFX pelo id canônico. Silencioso em TODO erro
 * (404, NotAllowedError de autoplay, decode) — o texto e o pictograma já
 * estão na tela.
 */
export function tocar(id: string): void {
  try {
    if (tocando) {
      tocando.pause();
      tocando = null;
    }
    const el = new Audio(`audio/${id}.mp3`);
    tocando = el;
    void el.play().catch(() => {
      /* autoplay bloqueado ou arquivo ausente: a tela continua legível. */
    });
  } catch {
    /* Audio() indisponível (teste/jsdom): nada a fazer. */
  }
}

export function pararAudio(): void {
  try {
    tocando?.pause();
  } catch {
    /* nada */
  }
  tocando = null;
}
