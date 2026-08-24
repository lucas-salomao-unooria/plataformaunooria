import Link from "next/link";
// Catálogo mínimo. Em produção: lê manifesto de experiências do bucket/banco.
const EXPERIENCIAS = [{ id: "exp-template", nome: "Experiência de exemplo (template)" }];

export default function Home() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Hub — catálogo</h1>
      <ul>
        {EXPERIENCIAS.map((e) => (
          <li key={e.id}><Link href={`/exp/${e.id}`}>{e.nome}</Link></li>
        ))}
      </ul>
    </main>
  );
}
