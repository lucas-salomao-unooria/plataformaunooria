import { notFound } from "next/navigation";
import { SmokeDoDs } from "./smoke";

/**
 * Sanidade do Design System (dev only): se o Button/Logo renderizam e o ícone
 * aparece como GLIFO (e não como o nome "school" em texto), o pipeline
 * DS npm → ponte @edu/ui → transpilePackages → CSS por rota → fontes por
 * <link> está inteiro. Fica no repo porque é o primeiro lugar onde olhar
 * quando "o DS quebrou".
 */
export default function DsSmokePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <SmokeDoDs />;
}
