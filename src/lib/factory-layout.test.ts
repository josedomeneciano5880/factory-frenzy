import { describe, expect, it } from "vitest";
import { buildFactoryLayout, isCorrectDeliveryStation } from "./factory-layout";

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

  it("identifica somente o destino correto de cada peça", () => {
    const layout = buildFactoryLayout(4);
    const gearShelf = layout.find((station) => station.kind === "shelf" && station.type === 0);
    const screwShelf = layout.find((station) => station.kind === "shelf" && station.type === 1);
    const bin = layout.find((station) => station.kind === "bin");
    if (!gearShelf || !screwShelf || !bin) throw new Error("Layout incompleto");

    expect(isCorrectDeliveryStation(gearShelf, { type: 0, defect: false })).toBe(true);
    expect(isCorrectDeliveryStation(screwShelf, { type: 0, defect: false })).toBe(false);
    expect(isCorrectDeliveryStation(bin, { type: 0, defect: false })).toBe(false);
    expect(isCorrectDeliveryStation(bin, { type: 0, defect: true })).toBe(true);
  });
});