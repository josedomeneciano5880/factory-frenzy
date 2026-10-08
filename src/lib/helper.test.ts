import { describe, expect, it } from "vitest";
import { buyHelper, freshHelper, helperStats, helperUpgradeCost } from "./helper";

describe("ajudante", () => {
  it("desbloqueia melhorias apenas depois de contratar", () => {
    expect(buyHelper(freshHelper(), 100, "speed")).toEqual({ helper: freshHelper(), coins: 100 });
    const hired = buyHelper(freshHelper(), 100);
    expect(hired.helper.owned).toBe(true);
    expect(hired.coins).toBe(60);
    expect(buyHelper(hired.helper, hired.coins, "speed").helper.up.speed).toBe(1);
    expect(buyHelper(hired.helper, 24, "speed").helper.up.speed).toBe(0);
  });
  it("não contrata duas vezes ou sem moedas", () => {
    expect(buyHelper(freshHelper(), 39).helper.owned).toBe(false);
    const hired = buyHelper(freshHelper(), 100);
    expect(buyHelper(hired.helper, hired.coins).coins).toBe(60);
  });
  it("cobra 25, 50 e 75 moedas pelas melhorias", () => {
    expect([0, 1, 2].map(helperUpgradeCost)).toEqual([25, 50, 75]);
  });
  it("melhora creatina e suco até nível 3", () => {
    let helper = buyHelper(freshHelper(), 100).helper;
    for (const upgrade of ["speed", "cap"] as const) {
      for (let i = 0; i < 3; i++) helper = buyHelper(helper, 1000, upgrade).helper;
      expect(buyHelper(helper, 1000, upgrade).coins).toBe(1000);
    }
    expect(helperStats(helper)).toEqual({ speed: 315, capacity: 4, reach: 65 });
  });
  it("creatina aumenta só a velocidade", () => {
    const hired = buyHelper(freshHelper(), 100).helper;
    const upgraded = buyHelper(hired, 100, "speed").helper;
    expect(helperStats(upgraded)).toEqual({ speed: 225, capacity: 1, reach: 65 });
  });
  it("suco aumenta só a quantidade de itens carregados", () => {
    const hired = buyHelper(freshHelper(), 100).helper;
    const upgraded = buyHelper(hired, 100, "cap").helper;
    expect(helperStats(upgraded)).toEqual({ speed: 180, capacity: 2, reach: 65 });
  });
  it("reinicia sem ajudante e sem melhorias", () => {
    expect(freshHelper()).toEqual({ owned: false, up: { speed: 0, cap: 0 } });
  });
});