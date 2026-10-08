import { createFileRoute } from "@tanstack/react-router";
import FactoryGame from "@/components/FactoryGame";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Turno de Qualidade — Roguelike na Fábrica" },
      { name: "description", content: "Jogo roguelike 2D: um estudante do SENAI resolve problemas de qualidade na linha de produção." },
      { property: "og:title", content: "Turno de Qualidade — Roguelike na Fábrica" },
      { property: "og:description", content: "Descarte, organize e faça relatórios em 4 fases cada vez mais difíceis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <h1 className="mb-1 text-center font-display text-4xl text-primary">Turno de Qualidade</h1>
      <p className="mb-6 text-center text-sm text-muted-foreground">Roguelike da linha de produção · SENAI</p>
      <FactoryGame />
    </main>
  );
}
