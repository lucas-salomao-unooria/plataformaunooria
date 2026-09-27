import { act } from "react";
import { vi } from "vitest";

/**
 * Utilitários mínimos para os testes que RENDERIZAM a missão no `jsdom` — sem
 * `@testing-library` (não é dependência do repo, e a regra é não acrescentar
 * dependência sem gargalo): procurar pelo texto que a criança lê e tocar.
 *
 * Tudo roda com relógio FALSO (`vi.useFakeTimers`): o polling de 5 s e o foco
 * inicial do `Modal` (50 ms) andam quando o teste manda, e as promessas da api
 * falsa se resolvem dentro do `act`.
 */

/** Deixa o React e as promessas andarem `ms` milissegundos do relógio falso. */
export async function passar(ms = 60): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function textoDe(el: Element): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** O texto visível da página inteira (o portal da gaveta e do modal inclusos). */
export function textoDaTela(): string {
  return textoDe(document.body);
}

/** O botão cujo texto CONTÉM `nome` (ou cujo `aria-label` é `nome`). Falha alto se não houver. */
export function botao(nome: string, dentro: ParentNode = document.body): HTMLButtonElement {
  const todos = Array.from(dentro.querySelectorAll("button"));
  const achado = todos.find((b) => b.getAttribute("aria-label") === nome) ?? todos.find((b) => textoDe(b).includes(nome));
  if (!achado) throw new Error(`botão "${nome}" não está na tela. Tela: ${textoDaTela().slice(0, 600)}`);
  return achado;
}

export function temBotao(nome: string, dentro: ParentNode = document.body): boolean {
  return Array.from(dentro.querySelectorAll("button")).some((b) => b.getAttribute("aria-label") === nome || textoDe(b).includes(nome));
}

/** O `<input type="radio">` cujo rótulo contém `texto`. */
export function radio(texto: string): HTMLInputElement {
  const rotulo = Array.from(document.querySelectorAll("label")).find((l) => textoDe(l).includes(texto));
  const input = rotulo?.querySelector<HTMLInputElement>('input[type="radio"]');
  if (!input) throw new Error(`alternativa "${texto}" não está na tela`);
  return input;
}

/** O diálogo aberto (a gaveta ou o modal). */
export function dialogo(): HTMLElement {
  const d = document.querySelector<HTMLElement>('[role="dialog"], [role="alertdialog"]');
  if (!d) throw new Error("nenhum diálogo aberto");
  return d;
}

export async function tocar(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
  });
  await passar();
}

/** Espera até `condicao` valer, andando o relógio — falha com a tela, não com um timeout mudo. */
export async function ate(condicao: () => boolean, descricao: string, passos = 40): Promise<void> {
  for (let i = 0; i < passos; i += 1) {
    if (condicao()) return;
    await passar(100);
  }
  throw new Error(`nunca chegou: ${descricao}. Tela: ${textoDaTela().slice(0, 800)}`);
}
