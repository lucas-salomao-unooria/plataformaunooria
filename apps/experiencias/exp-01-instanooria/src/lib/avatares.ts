/**
 * O catálogo de avatares que o aluno escolhe no onboarding.
 *
 * Personagens-símbolo, não pessoas: sem rosto humano realista e sem ninguém
 * identificável. Um aluno de 13 anos escolhe uma identidade para usar dentro do
 * app, e um bicho ou objeto faz isso melhor que um retrato — além de evitar a
 * pergunta "por que esse avatar não parece comigo?".
 *
 * As imagens são geradas uma vez (`npm run avatares`) e vivem em
 * `public/avatares/{id}.webp`. Quando o arquivo não existe, a interface cai no
 * avatar procedural de iniciais — a tela nunca quebra por falta de imagem.
 */
export interface Avatar {
  id: string;
  /** Rótulo acessível: é o que o leitor de tela anuncia na grade de escolha. */
  rotulo: string;
  /** O que pedir ao Gemini. Uma frase, concreta, sem estilo (o estilo é global). */
  prompt: string;
}

export const AVATARES: Avatar[] = [
  { id: 'capivara', rotulo: 'Capivara', prompt: 'uma capivara tranquila de perfil' },
  { id: 'tucano', rotulo: 'Tucano', prompt: 'um tucano colorido pousado num galho' },
  { id: 'onca', rotulo: 'Onça', prompt: 'uma onça-pintada sentada, expressão calma' },
  { id: 'tatu', rotulo: 'Tatu', prompt: 'um tatu-bola enrolado' },
  { id: 'arara', rotulo: 'Arara', prompt: 'uma arara azul de asas abertas' },
  { id: 'preguica', rotulo: 'Preguiça', prompt: 'uma preguiça pendurada num galho' },
  { id: 'boto', rotulo: 'Boto', prompt: 'um boto-cor-de-rosa saltando' },
  { id: 'lobo-guara', rotulo: 'Lobo-guará', prompt: 'um lobo-guará de pé, orelhas grandes' },
  { id: 'foguete', rotulo: 'Foguete', prompt: 'um foguete de papel decolando' },
  { id: 'bussola', rotulo: 'Bússola', prompt: 'uma bússola antiga de latão' },
  { id: 'caravela', rotulo: 'Caravela', prompt: 'uma caravela de brinquedo em papel' },
  { id: 'telescopio', rotulo: 'Telescópio', prompt: 'um telescópio apontado para cima' },
  { id: 'violao', rotulo: 'Violão', prompt: 'um violão apoiado numa parede' },
  { id: 'skate', rotulo: 'Skate', prompt: 'um skate visto de cima, com shapes coloridos' },
  { id: 'planta', rotulo: 'Planta', prompt: 'um vaso com uma planta de folhas largas' },
  { id: 'pipa', rotulo: 'Pipa', prompt: 'uma pipa colorida no céu' },
];

export const IDS_DE_AVATAR = AVATARES.map((avatar) => avatar.id);

/** URL pública da imagem. Pode não existir — quem renderiza trata o fallback.
 *  BASE_URL (não "/"): o bundle é servido de um path do bucket
 *  (`{expId}/{versao}/`), e URL absoluta apontaria para a raiz da CDN. */
export function urlDoAvatar(id: string): string {
  return `${import.meta.env.BASE_URL}avatares/${id}.webp`;
}
