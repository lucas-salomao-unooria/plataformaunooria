/**
 * Skeleton de carregamento do feed (doc 03 §4): blocos pulsando, com a forma do
 * `PostCard` do Unoovista (cartão `radius-l`, mídia `radius-m` em 4:5). O DS não
 * publica esqueleto; isto é só medida e superfície nos tokens dele.
 */
export function SkeletonFeed({ cards = 2 }: { cards?: number }) {
  return (
    <div className="flex flex-col gap-[var(--unv-spacing-m)]" aria-hidden>
      {Array.from({ length: cards }, (_, indice) => (
        <div key={indice} className="animar-skeleton flex flex-col gap-3 rounded-cartao bg-surface p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-canvasAlt" />
            <div className="flex flex-col gap-1.5">
              <div className="h-2.5 w-24 rounded-full bg-canvasAlt" />
              <div className="h-2 w-16 rounded-full bg-canvasAlt" />
            </div>
          </div>
          <div className="aspect-post w-full rounded-midia bg-canvasAlt" />
          <div className="flex flex-col gap-2">
            <div className="h-2.5 w-32 rounded-full bg-canvasAlt" />
            <div className="h-2.5 w-56 rounded-full bg-canvasAlt" />
          </div>
        </div>
      ))}
    </div>
  );
}
