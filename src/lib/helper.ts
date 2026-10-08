export type HelperUpgrade = "speed" | "cap" | "range";
export type Helper = { owned: boolean; up: Record<HelperUpgrade, number> };
export const HELPER_COST = 40;
export const freshHelper = (): Helper => ({ owned: false, up: { speed: 0, cap: 0, range: 0 } });
export const helperStats = (helper: Helper) => ({
  speed: 180 * (1 + helper.up.speed * 0.25),
  capacity: 1 + helper.up.cap,
  reach: 65 + helper.up.range * 35,
});
export function buyHelper(helper: Helper, coins: number, upgrade?: HelperUpgrade) {
  const cost = upgrade ? 15 + helper.up[upgrade] * 15 : HELPER_COST;
  if (coins < cost || (upgrade ? !helper.owned || helper.up[upgrade] >= 3 : helper.owned)) {
    return { helper, coins };
  }
  return {
    coins: coins - cost,
    helper: upgrade
      ? { ...helper, up: { ...helper.up, [upgrade]: helper.up[upgrade] + 1 } }
      : { ...helper, owned: true },
  };
}