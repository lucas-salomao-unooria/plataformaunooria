/** Skeleton de carregamento do feed (doc 03 §4): blocos cinza pulsando. */
export function SkeletonFeed({ cards = 2 }: { cards?: number }) {
  return (
    <div className="flex flex-col">
      {Array.from({ length: cards }, (_, indice) => (
        <div key={indice} className="animar-skeleton border-b border-hairline pb-3">
          <div className="flex items-center gap-2 px-3 py-3">
            <div className="h-8 w-8 rounded-full bg-hairline/70" />
            <div className="flex flex-col gap-1">
              <div className="h-2.5 w-24 rounded bg-hairline/70" />
              <div className="h-2 w-16 rounded bg-hairline/50" />
            </div>
          </div>
          <div className="aspect-post w-full bg-hairline/60" />
          <div className="flex flex-col gap-2 px-3 pt-3">
            <div className="h-2.5 w-32 rounded bg-hairline/70" />
            <div className="h-2.5 w-56 rounded bg-hairline/50" />
          </div>
        </div>
      ))}
    </div>
  );
}
