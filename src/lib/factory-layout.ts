export type FactoryStation = {
  kind: "shelf" | "bin" | "desk";
  type?: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

const SHELF_X = [25, 170, 315, 460];

export function buildFactoryLayout(types: number): FactoryStation[] {
  const shelves = SHELF_X.slice(0, types).map((x, type) => ({
    kind: "shelf" as const,
    type,
    x,
    y: 470,
    w: 120,
    h: 70,
  }));

  return [
    ...shelves,
    { kind: "bin", x: 650, y: 465, w: 90, h: 80 },
    { kind: "desk", x: 795, y: 470, w: 120, h: 70 },
  ];
}