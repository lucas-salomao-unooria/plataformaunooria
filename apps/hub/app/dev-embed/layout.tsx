import { CascaPlataforma } from "@/components/casca-plataforma";

/** Mesma casca da missão real — a bancada de dev não divergir é o ponto dela. */
export default function DevEmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <CascaPlataforma className="flex flex-col" style={{ height: "100dvh" }}>
      {children}
    </CascaPlataforma>
  );
}
