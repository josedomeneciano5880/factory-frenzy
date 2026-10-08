import { describe, expect, it } from "vitest";
import { buildFactoryLayout } from "./factory-layout";

describe("organização da fábrica", () => {
  it("mantém os pontos de entrega embaixo e na mesma ordem em todas as fases", () => {
    const layouts = [2, 3, 3, 4].map(buildFactoryLayout);

    for (const layout of layouts) {
      expect(layout.every((station) => station.y >= 465)).toBe(true);
      expect(layout.map((station) => station.kind)).toEqual([
        ...Array(layout.length - 2).fill("shelf"),
        "bin",
        "desk",
      ]);
      expect(layout.map((station) => station.x)).toEqual([...layout.map((station) => station.x)].sort((a, b) => a - b));
    }

    const phase1 = layouts[0];
    const phase2 = layouts[1];
    const phase4 = layouts[3];
    if (!phase1 || !phase2 || !phase4) throw new Error("As quatro fases precisam ter um layout");
    expect(phase1.slice(0, 2)).toEqual(phase4.slice(0, 2));
    expect(phase2.slice(0, 3)).toEqual(phase4.slice(0, 3));
  });
});