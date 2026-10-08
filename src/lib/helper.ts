export type HelperUpgrade = "speed" | "cap" | "range";
export type Helper = { owned: boolean; up: Record<HelperUpgrade, number> };
export const HELPER_COST = 40;
export const helperUpgradeCost = (level: number) => 25 + level * 25;
export const freshHelper = (): Helper => ({ owned: false, up: { speed: 0, cap: 0, range: 0 } });
export const helperStats = (helper: Helper) => ({
  speed: 180 * (1 + helper.up.speed * 0.25),
  capacity: 1 + helper.up.cap,
  reach: 65 + helper.up.range * 35,
});
export function selectHelperPickups<T extends { id: number; x: number }>(
  items: T[],
  helperX: number,
  capacity: number,
  carried: number,
  reach: number,
) {
  const freeSlots = Math.max(0, capacity - carried);
  return items
    .filter((item) => item.x > 0 && Math.abs(item.x - helperX) <= reach)
    .sort((a, b) => Math.abs(a.x - helperX) - Math.abs(b.x - helperX))
    .slice(0, freeSlots);
}
export function buyHelper(helper: Helper, coins: number, upgrade?: HelperUpgrade) {
  const cost = upgrade ? helperUpgradeCost(helper.up[upgrade]) : HELPER_COST;
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
export type HelperMode = "collect" | "deliver";
/** Once the helper starts delivering it finishes the whole batch before collecting again. */
export function nextHelperMode(mode: HelperMode, carried: number, capacity: number, hasTarget: boolean): HelperMode {
  if (carried === 0) return "collect";
  if (mode === "deliver" || carried >= capacity || !hasTarget) return "deliver";
  return "collect";
}
