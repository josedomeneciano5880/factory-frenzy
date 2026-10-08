// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { buyHelper, freshHelper, helperStats, helperUpgradeCost, HELPER_COST, selectHelperPickups, nextHelperMode, type HelperUpgrade } from "@/lib/helper";
import { buildFactoryLayout, isCorrectDeliveryStation, type FactoryStation } from "@/lib/factory-layout";
import gabrielAsset from "@/assets/gabriel.png.asset.json";
import andreAsset from "@/assets/andre.png.asset.json";

const W = 960;
const H = 600;
const BELT_Y = 70;
const BELT_H = 56;
const REACH = 95;

type Item = { id: number; x: number; type: number; defect: boolean };
type Station = FactoryStation;
type Phase = "menu" | "play" | "report" | "levelup" | "over" | "win";

const TYPE_COLORS = ["#3b82f6", "#eab308", "#22c55e", "#f97316"];
const TYPE_NAMES = ["Engrenagem", "Parafuso", "Placa", "Mola"];

const LEVELS = [
  { types: 2, speed: 40, spawn: 2.6, defect: 0.3, quota: 6 },
  { types: 3, speed: 55, spawn: 2.1, defect: 0.35, quota: 9 },
  { types: 3, speed: 70, spawn: 1.7, defect: 0.4, quota: 12 },
  { types: 4, speed: 88, spawn: 1.35, defect: 0.45, quota: 15 },
];

function shuffle<T>(a: T[]) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function FactoryGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("menu");
  const [level, setLevel] = useState(0);
  const [msg, setMsg] = useState("");
  const [report, setReport] = useState<{ q: string; options: number[]; answer: number } | null>(null);
  const [best, setBest] = useState(0);
  const [coins, setCoins] = useState(0);
  const [up, setUp] = useState({ speed: 0, cap: 0, range: 0 });
  const [helper, setHelper] = useState(freshHelper);
  const purchaseHelper = (upgrade?: HelperUpgrade) => {
    const s = g.current;
    const result = buyHelper(s.helper, s.coins, upgrade);
    s.helper = result.helper; s.coins = result.coins;
    setHelper(s.helper); setCoins(s.coins);
  };
  const buy = (k: "speed" | "cap" | "range") => {
    const s = g.current; const cost = 15 + s.up[k] * 15;
    if (s.coins < cost || s.up[k] >= 3) return;
    s.coins -= cost; s.up[k]++; setCoins(s.coins); setUp({ ...s.up });
  };

  const g = useRef({
    px: W / 2, py: 200, keys: {} as Record<string, boolean>,
    items: [] as Item[], carry: [] as Item[], stations: [] as Station[],
    spawnT: 0, lives: 3, done: 0, discarded: 0, organized: 0, missed: 0,
    nextId: 1, toast: "", toastT: 0, level: 0, phase: "menu" as Phase, mx: 0, my: 0,
    coins: 0, up: { speed: 0, cap: 0, range: 0 },
    helper: freshHelper(), hx: 750, hy: 190, helperCarry: [] as Item[], helperMode: "collect",
    playerImage: null as HTMLImageElement | null, facing: "down", moving: false, animT: 0,
    helperImage: null as HTMLImageElement | null, helperFacing: "down", helperMoving: false, helperAnimT: 0,
    palette: { foreground: "", primary: "", muted: "", background: "", accent: "" },
  });

  const startLevel = (lv: number, fresh: boolean) => {
    const s = g.current;
    s.level = lv;
    s.items = [];
    s.carry = [];
    s.stations = buildFactoryLayout(LEVELS[lv].types);
    s.spawnT = 1;
    s.done = 0; s.discarded = 0; s.organized = 0; s.missed = 0;
    if (fresh) { s.lives = 3; s.coins = 0; s.up = { speed: 0, cap: 0, range: 0 }; s.helper = freshHelper(); }
    s.hx = 750; s.hy = 190; s.helperCarry = []; s.helperMode = "collect"; s.helperWait = 0;
    s.helperFacing = "down"; s.helperMoving = false; s.helperAnimT = 0;
    setHelper(s.helper); setCoins(s.coins); setUp({ ...s.up });
    s.px = W / 2; s.py = 190;
    setLevel(lv);
    setPhase("play");
  };

  useEffect(() => { g.current.phase = phase; }, [phase]);

  const toast = (t: string) => { g.current.toast = t; g.current.toastT = 1.8; };

  const loseLife = (why: string) => {
    const s = g.current;
    s.lives--;
    toast("⚠ " + why);
    if (s.lives <= 0) {
      setBest((b) => Math.max(b, s.level + 1));
      setMsg(why);
      setPhase("over");
    }
  };

  const openReport = () => {
    const s = g.current;
    const qs = [
      { q: "Quantas peças defeituosas você DESCARTOU nesta fase?", a: s.discarded },
      { q: "Quantas peças boas você ORGANIZOU nas prateleiras?", a: s.organized },
    ];
    const pick = qs[Math.floor(Math.random() * qs.length)];
    const opts = new Set([pick.a]);
    while (opts.size < 4) opts.add(Math.max(0, pick.a + Math.floor(Math.random() * 7) - 3));
    setReport({ q: pick.q, options: shuffle([...opts]), answer: pick.a });
    setPhase("report");
  };

  const answer = (v: number) => {
    if (!report) return;
    if (v === report.answer) {
      if (g.current.level >= 3) { setBest(4); setPhase("win"); }
      else { g.current.coins += 20; setCoins(g.current.coins); setUp({ ...g.current.up }); setPhase("levelup"); }
    } else {
      setPhase("play");
      loseLife("Relatório com dados errados!");
      g.current.done = Math.max(0, g.current.done - 2);
    }
  };

  const interact = (tx?: number, ty?: number) => {
    const s = g.current;
    if (s.phase !== "play") return;
    const reach = REACH + s.up.range * 35;
    const cap = 1 + s.up.cap;
    const near = (x: number, y: number) => Math.hypot(x - s.px, y - s.py) < reach;
    const inside = (st: Station, x: number, y: number) => x >= st.x && x <= st.x + st.w && y >= st.y && y <= st.y + st.h;
    const center = (st: Station) => ({ x: st.x + st.w / 2, y: st.y + st.h / 2 });

    // Keyboard interaction automatically favors the correct destination for the first carried part.
    let target: Station | undefined;
    if (tx !== undefined && ty !== undefined) target = s.stations.find((st) => inside(st, tx, ty));
    else {
      const reachable = s.stations
        .filter((st) => { const c = center(st); return Math.hypot(c.x - s.px, c.y - s.py) < reach + 40; })
        .sort((a, b) => {
          const ac = center(a); const bc = center(b);
          return Math.hypot(ac.x - s.px, ac.y - s.py) - Math.hypot(bc.x - s.px, bc.y - s.py);
        });
      const carried = s.carry[0];
      target = carried ? reachable.find((st) => isCorrectDeliveryStation(st, carried)) : reachable.find((st) => st.kind === "desk");
    }

    if (target && Math.hypot(center(target).x - s.px, center(target).y - s.py) < reach + 50) {
      if (target.kind === "desk") {
        if (s.carry.length) return toast("Largue a peça antes de fazer o relatório");
        if (s.done < LEVELS[s.level].quota) return toast(`Meta: ${s.done}/${LEVELS[s.level].quota} peças tratadas`);
        return openReport();
      }
      if (!s.carry.length) return;
      const it = s.carry[0];
      if (!isCorrectDeliveryStation(target, it)) {
        return toast(it.defect ? "Leve esta peça ao DESCARTE" : `Leve para: ${TYPE_NAMES[it.type]}`);
      }
      s.carry.shift();
      if (target.kind === "bin") {
        if (it.defect) { s.discarded++; s.done++; s.coins += 5; toast("✔ Descarte correto +5"); }
        else loseLife("Descartou uma peça boa!");
      } else {
        if (it.defect) loseLife("Peça defeituosa na prateleira!");
        else if (target.type !== it.type) loseLife("Prateleira errada!");
        else { s.organized++; s.done++; s.coins += 5; toast("✔ Organizado +5"); }
      }
      return;
    }
    // pick from belt
    if (s.carry.length >= cap) return toast(`Mãos cheias (${cap})`);
    let cand = s.items.filter((it) => near(it.x, BELT_Y + BELT_H / 2));
    if (tx !== undefined && ty !== undefined) cand = cand.filter((it) => Math.hypot(it.x - tx, BELT_Y + BELT_H / 2 - ty) < 30);
    cand.sort((a, b) => Math.abs(a.x - s.px) - Math.abs(b.x - s.px));
    if (cand[0]) { s.carry.push(cand[0]); s.items = s.items.filter((i) => i !== cand[0]); }
    else if (tx === undefined) toast("Nada ao alcance");
  };

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      g.current.keys[k] = true;
      if (k === "e" || k === " ") { e.preventDefault(); interact(); }
    };
    const ku = (e: KeyboardEvent) => { g.current.keys[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  });

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const css = getComputedStyle(cv);
    g.current.palette = { foreground: css.getPropertyValue("--foreground"), primary: css.getPropertyValue("--primary"), muted: css.getPropertyValue("--muted-foreground"), background: css.getPropertyValue("--background"), accent: css.getPropertyValue("--chart-2") };
    const playerImage = new Image();
    playerImage.onload = () => { g.current.playerImage = playerImage; };
    playerImage.src = gabrielAsset.url;
    const helperImage = new Image();
    helperImage.onload = () => { g.current.helperImage = helperImage; };
    helperImage.src = andreAsset.url;
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = g.current;
      const L = LEVELS[s.level];
      if (s.phase === "play") {
        const sp = 230 * (1 + 0.25 * s.up.speed) * dt;
        const k = s.keys;
        const dx = (k["d"] || k["arrowright"] ? 1 : 0) - (k["a"] || k["arrowleft"] ? 1 : 0);
        const dy = (k["s"] || k["arrowdown"] ? 1 : 0) - (k["w"] || k["arrowup"] ? 1 : 0);
        if (dx) s.px += dx * sp;
        if (dy) s.py += dy * sp;
        s.moving = dx !== 0 || dy !== 0;
        if (s.moving) {
          s.animT += dt;
          if (Math.abs(dx) > Math.abs(dy)) s.facing = dx > 0 ? "right" : "left";
          else if (dy) s.facing = dy > 0 ? "down" : "up";
        } else s.animT = 0;
        s.px = Math.max(20, Math.min(W - 20, s.px));
        s.py = Math.max(BELT_Y + BELT_H + 22, Math.min(H - 20, s.py));
        s.spawnT -= dt;
        if (s.spawnT <= 0) {
          s.spawnT = L.spawn * (0.7 + Math.random() * 0.6);
          s.items.push({ id: s.nextId++, x: -20, type: Math.floor(Math.random() * L.types), defect: Math.random() < L.defect });
        }
        for (const it of s.items) it.x += L.speed * dt;
        updateHelper(s, dt);
        const gone = s.items.filter((i) => i.x > W + 20);
        s.items = s.items.filter((i) => i.x <= W + 20);
        for (const it of gone) if (it.defect) loseLife("Peça defeituosa passou para o cliente!");
        if (s.toastT > 0) s.toastT -= dt;
      }
      draw(ctx, s, now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    interact(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
  };
  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    g.current.mx = ((e.clientX - r.left) / r.width) * W;
    g.current.my = ((e.clientY - r.top) / r.height) * H;
  };

  return (
    <div className="relative mx-auto w-full max-w-[960px]">
      <canvas ref={canvasRef} width={W} height={H} onClick={onClick} onMouseMove={onMove}
        className="block w-full rounded-lg border-4 border-border bg-card shadow-2xl" />
      {phase !== "play" && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/85 p-2 sm:p-6 backdrop-blur-sm">
          <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-lg border-2 border-primary bg-card p-4 sm:p-6 text-center">
            {phase === "menu" && (<>
              <h2 className="font-display text-3xl text-primary">Turno de Qualidade</h2>
              <p className="mt-3 text-sm text-muted-foreground">Você é um estudante do SENAI na linha de produção. Descarte peças defeituosas (com X vermelho), organize as boas na prateleira da cor certa e entregue o relatório no computador. 4 fases. 3 vidas. Morreu? Volta do zero.</p>
              <p className="mt-3 text-xs text-muted-foreground">WASD/setas: mover · Clique ou E: pegar/soltar/usar</p>
              <Button onClick={() => startLevel(0, true)} className="mt-6 rounded-md bg-primary px-6 py-3 font-bold text-primary-foreground hover:opacity-90">Bater o ponto</Button>
            </>)}
            {phase === "report" && report && (<>
              <h2 className="font-display text-2xl text-primary">Relatório de Qualidade</h2>
              <p className="mt-4">{report.q}</p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {report.options.map((o) => (
                  <Button key={o} onClick={() => answer(o)} className="rounded-md border-2 border-border bg-secondary px-4 py-3 text-xl font-bold hover:border-primary">{o}</Button>
                ))}
              </div>
            </>)}
            {phase === "levelup" && (<>
              <h2 className="font-display text-lg sm:text-xl text-primary">Fase {level + 1} concluída!</h2>
              <p className="mt-3 text-sm text-muted-foreground">Bônus de relatório +20. Gaste suas moedas na loja:</p>
              <p className="mt-2 font-display text-lg text-primary">$ {coins}</p>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {([["speed", "Pizza", "🍕"], ["cap", "Churrasco", "🥩"], ["range", "Sushi", "🍣"]] as const).map(([k, n, ic]) => {
                  const cost = 15 + up[k] * 15; const max = up[k] >= 3;
                  return (
                    <Button key={k} onClick={() => buy(k)} disabled={max || coins < cost}
                      variant="secondary" className="h-auto min-w-0 flex-col whitespace-normal rounded-md border-2 border-border p-2 text-sm hover:border-primary disabled:opacity-40">
                      <div className="text-2xl">{ic}</div><div className="font-bold">{n}</div>
                      <div className="text-xs text-muted-foreground">Nv {up[k]}/3</div>
                      <div className="mt-1 text-primary">{max ? "MÁX" : `$ ${cost}`}</div>
                    </Button>);
                })}
              </div>
              <div className="mt-4 border-t border-border pt-3">
                <h3 className="font-bold">Ajudante {helper.owned ? "contratado" : ""}</h3>
                {!helper.owned ? (
                  <Button variant="secondary" onClick={() => purchaseHelper()} disabled={coins < HELPER_COST} className="mt-2 h-auto whitespace-normal border border-border px-4 py-3">
                    🤝 Contratar ajudante · $ {HELPER_COST}
                  </Button>
                ) : (
                  <div className="mt-2 grid grid-cols-3 gap-3">
                    {([["speed", "Creatina", "💪"], ["cap", "Suco", "🧃"], ["range", "Whey", "🥛"]] as const).map(([k, name, icon]) => {
                      const max = helper.up[k] >= 3;
                      const cost = helperUpgradeCost(helper.up[k]);
                      return <Button key={k} variant="secondary" onClick={() => purchaseHelper(k)} disabled={max || coins < cost}
                        aria-label={`Ajudante: ${name}`} className="h-auto min-w-0 flex-col whitespace-normal border-2 border-border p-2 hover:border-primary">
                        <span className="text-xl">{icon}</span><span className="text-xs font-bold">{name}</span>
                        <span className="text-xs text-muted-foreground">Nv {helper.up[k]}/3</span>
                        <span className="text-primary">{max ? "MÁX" : `Preço: $ ${cost}`}</span>
                      </Button>;
                    })}
                  </div>
                )}
              </div>
              <Button onClick={() => startLevel(level + 1, false)} className="mt-6 rounded-md bg-primary px-6 py-3 font-bold text-primary-foreground">Próxima fase</Button>
            </>)}
            {phase === "over" && (<>
              <h2 className="font-display text-3xl text-destructive">Demitido!</h2>
              <p className="mt-3">{msg}</p>
              <p className="mt-2 text-sm text-muted-foreground">Você chegou à fase {level + 1}. Recorde: fase {best}. Todo o progresso foi perdido.</p>
              <Button onClick={() => startLevel(0, true)} className="mt-6 rounded-md bg-primary px-6 py-3 font-bold text-primary-foreground">Recomeçar do zero</Button>
            </>)}
            {phase === "win" && (<>
              <h2 className="font-display text-3xl text-primary">Técnico aprovado! 🏆</h2>
              <p className="mt-3 text-sm text-muted-foreground">Você venceu as 4 fases da linha de produção.</p>
              <Button onClick={() => startLevel(0, true)} className="mt-6 rounded-md bg-primary px-6 py-3 font-bold text-primary-foreground">Jogar de novo</Button>
            </>)}
          </div>
        </div>
      )}
    </div>
  );
}

function drawPart(ctx: CanvasRenderingContext2D, x: number, y: number, type: number, defect: boolean) {
  ctx.fillStyle = TYPE_COLORS[type];
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (type === 0) ctx.arc(x, y, 14, 0, Math.PI * 2);
  else if (type === 1) ctx.rect(x - 6, y - 15, 12, 30);
  else if (type === 2) ctx.rect(x - 15, y - 11, 30, 22);
  else { ctx.moveTo(x, y - 15); ctx.lineTo(x + 15, y + 12); ctx.lineTo(x - 15, y + 12); ctx.closePath(); }
  ctx.fill(); ctx.stroke();
  if (defect) {
    ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x - 9, y - 9); ctx.lineTo(x + 9, y + 9); ctx.moveTo(x + 9, y - 9); ctx.lineTo(x - 9, y + 9); ctx.stroke();
  }
}

function draw(ctx: CanvasRenderingContext2D, s: any, now: number) {
  // floor
  ctx.fillStyle = "#2a2d33"; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#33373e"; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  drawBossFace(ctx, s);
  // safety stripe
  for (let x = 0; x < W; x += 30) { ctx.fillStyle = (x / 30) % 2 ? "#facc15" : "#111"; ctx.fillRect(x, BELT_Y + BELT_H + 4, 30, 6); }
  // belt
  ctx.fillStyle = "#15171a"; ctx.fillRect(0, BELT_Y, W, BELT_H);
  const L = LEVELS[s.level];
  const off = ((now / 1000) * L.speed) % 30;
  ctx.strokeStyle = "#3a3f47"; ctx.lineWidth = 3;
  for (let x = -30 + off; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, BELT_Y + 4); ctx.lineTo(x, BELT_Y + BELT_H - 4); ctx.stroke(); }
  for (const it of s.items) drawPart(ctx, it.x, BELT_Y + BELT_H / 2, it.type, it.defect);
  // stations
  for (const st of s.stations as Station[]) {
    if (st.kind === "shelf") {
      ctx.fillStyle = "#5b4630"; ctx.fillRect(st.x, st.y, st.w, st.h);
      ctx.fillStyle = TYPE_COLORS[st.type!]; ctx.fillRect(st.x, st.y, st.w, 12);
      drawPart(ctx, st.x + st.w / 2, st.y + 42, st.type!, false);
      ctx.fillStyle = "#eee"; ctx.font = "bold 12px monospace"; ctx.textAlign = "center";
      ctx.fillText(TYPE_NAMES[st.type!], st.x + st.w / 2, st.y + st.h + 16);
    } else if (st.kind === "bin") {
      ctx.fillStyle = "#b91c1c"; ctx.fillRect(st.x, st.y, st.w, st.h);
      ctx.fillStyle = "#7f1d1d"; ctx.fillRect(st.x - 4, st.y, st.w + 8, 12);
      ctx.fillStyle = "#fff"; ctx.font = "bold 12px monospace"; ctx.textAlign = "center";
      ctx.fillText("DESCARTE", st.x + st.w / 2, st.y + st.h / 2 + 8);
    } else {
      ctx.fillStyle = "#475569"; ctx.fillRect(st.x, st.y, st.w, st.h);
      ctx.fillStyle = "#0f172a"; ctx.fillRect(st.x + 30, st.y + 8, 60, 38);
      const ready = s.done >= L.quota;
      ctx.fillStyle = ready ? (Math.sin(now / 150) > 0 ? "#22c55e" : "#166534") : "#38bdf8";
      ctx.fillRect(st.x + 34, st.y + 12, 52, 30);
      ctx.fillStyle = "#eee"; ctx.font = "bold 12px monospace"; ctx.textAlign = "center";
      ctx.fillText("RELATÓRIO", st.x + st.w / 2, st.y + st.h + 16);
    }
  }
  // player (SENAI student sprite)
  const { px, py } = s;
  ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.beginPath(); ctx.arc(px, py, REACH + s.up.range * 35, 0, Math.PI * 2); ctx.fill();
  drawPlayerSprite(ctx, s, px, py);
  s.carry.forEach((c, i) => drawPart(ctx, px + 20 + i * 12, py - 22 - i * 8, c.type, c.defect));
  if (s.helper.owned) {
    drawPlayerSprite(ctx, { playerImage: s.helperImage, facing: s.helperFacing, moving: s.helperMoving, animT: s.helperAnimT }, s.hx, s.hy);
    ctx.fillStyle = s.palette.foreground;
    ctx.font = "bold 10px monospace"; ctx.textAlign = "center";
    ctx.fillText("AJUDANTE", s.hx, s.hy + 46);
    s.helperCarry.forEach((c, i) => drawPart(ctx, s.hx + 20 + i * 12, s.hy - 22 - i * 8, c.type, c.defect));
  }
  // HUD
  ctx.fillStyle = "rgba(0,0,0,0.75)"; ctx.fillRect(0, 0, W, 54);
  ctx.textAlign = "left"; ctx.font = "bold 18px monospace";
  ctx.fillStyle = "#facc15"; ctx.fillText(`FASE ${s.level + 1}/4`, 16, 34);
  ctx.fillStyle = "#ef4444"; ctx.fillText("♥".repeat(Math.max(0, s.lives)) + "♡".repeat(Math.max(0, 3 - s.lives)), 160, 34);
  ctx.fillStyle = "#e5e7eb"; ctx.fillText(`META ${s.done}/${L.quota}`, 270, 34);
  ctx.font = "13px monospace"; ctx.fillStyle = "#9ca3af";
  ctx.fillText(s.done >= L.quota ? "Meta batida! Vá ao RELATÓRIO." : s.helper.owned ? "Equipe em produção" : "Em produção", 430, 34);
  ctx.fillStyle = "#facc15"; ctx.font = "bold 18px monospace"; ctx.textAlign = "right"; ctx.fillText(`$ ${s.coins}`, W - 16, 34);
  if (s.toastT > 0) {
    ctx.globalAlpha = Math.min(1, s.toastT);
    ctx.fillStyle = "rgba(0,0,0,0.8)"; ctx.fillRect(W / 2 - 200, H - 60, 400, 36);
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.font = "bold 15px monospace";
    ctx.fillText(s.toast, W / 2, H - 37);
    ctx.globalAlpha = 1;
  }
}

function drawPlayerSprite(ctx: CanvasRenderingContext2D, s: any, x: number, y: number) {
  const image = s.playerImage as HTMLImageElement | null;
  if (!image) {
    ctx.fillStyle = "#dc2626"; ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.fill();
    return;
  }
  const walkingFrame = Math.floor(s.animT * 8) % 3;
  let col = 0;
  let row = 0;
  let mirror = false;
  if (s.facing === "up") { col = s.moving ? walkingFrame % 2 : 0; row = 2; }
  else if (s.facing === "right" || s.facing === "left") {
    col = s.moving ? walkingFrame : 2; row = s.moving ? 1 : 0; mirror = s.facing === "left";
  } else col = s.moving ? walkingFrame % 2 : 0;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(x, y);
  if (mirror) ctx.scale(-1, 1);
  ctx.drawImage(image, col * 110, row * 110, 110, 110, -43, -52, 86, 86);
  ctx.restore();
}

function drawBossFace(ctx: CanvasRenderingContext2D, s: any) {
  ctx.save(); ctx.globalAlpha = 0.45;
  const x = 875, y = 185;
  ctx.fillStyle = s.palette.muted; ctx.beginPath(); ctx.ellipse(x, y, 28, 31, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = s.palette.background; ctx.beginPath(); ctx.ellipse(x, y - 19, 27, 13, 0, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillRect(x - 15, y - 4, 8, 3); ctx.fillRect(x + 7, y - 4, 8, 3);
  ctx.strokeStyle = s.palette.background; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - 9, y + 13); ctx.lineTo(x + 9, y + 13); ctx.stroke();
  ctx.restore();
}

function updateHelper(s: any, dt: number) {
  if (!s.helper.owned) return;
  s.helperMoving = false;
  const stats = helperStats(s.helper);
  const move = (x: number, y: number) => {
    const dx = x - s.hx, dy = y - s.hy;
    const d = Math.hypot(dx, dy);
    if (d > 1) {
      s.helperMoving = true;
      s.helperAnimT += dt;
      s.helperFacing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
      const step = Math.min(d, stats.speed * dt);
      s.hx += (x - s.hx) / d * step; s.hy += (y - s.hy) / d * step;
    } else s.helperAnimT = 0;
    s.hx = Math.max(20, Math.min(W - 20, s.hx));
    s.hy = Math.max(BELT_Y + BELT_H + 22, Math.min(H - 20, s.hy));
  };
  // Fill a batch from the belt, then deliver each part to its correct destination.
  const beltEdge = BELT_Y + BELT_H + 22;
  const nearBelt = s.hy <= beltEdge + 30;
  if (s.helperMode !== "deliver" && s.helperCarry.length < stats.capacity && nearBelt) {
    const nearby = selectHelperPickups(s.items, s.hx, stats.capacity, s.helperCarry.length, stats.reach);
    for (const item of nearby) {
      s.helperCarry.push(item); s.items = s.items.filter((it: Item) => it.id !== item.id);
    }
  }
  const L = LEVELS[s.level];
  const onBelt = s.items.filter((it: Item) => it.x > 0 && it.x < W - 30);
  // Chase the belt part it can reach soonest, predicting belt movement.
  let target: Item | undefined; let best = Infinity;
  for (const it of onBelt) {
    const t = Math.abs(it.x - s.hx) / stats.speed;
    const fx = it.x + L.speed * t;
    if (fx > W - 30) continue;
    const cost = Math.abs(fx - s.hx);
    if (cost < best) { best = cost; target = it; }
  }
  s.helperWait = target || s.helperCarry.length === 0 ? 0 : (s.helperWait || 0) + dt;
  s.helperMode = nextHelperMode(s.helperMode, s.helperCarry.length, stats.capacity, !!target, s.helperWait);
  const item = s.helperCarry[0];
  if (s.helperMode === "deliver" && item) {
    const station = s.stations.find((st: Station) => item.defect ? st.kind === "bin" : st.kind === "shelf" && st.type === item.type);
    if (!station) { s.helperCarry.shift(); return; }
    const x = station.x + station.w / 2, y = station.y + station.h / 2;
    move(x, y);
    if (Math.hypot(x - s.hx, y - s.hy) <= stats.reach) {
      s.helperCarry.shift(); s.done++; s.coins += 5;
      if (item.defect) s.discarded++; else s.organized++;
      s.toast = "✔ Ajudante: peça tratada +5"; s.toastT = 1.8;
    }
  } else if (target) {
    const t = Math.abs(target.x - s.hx) / stats.speed;
    move(Math.min(W - 20, target.x + L.speed * t * 0.5), beltEdge);
  } else {
    // Wait at the start of the belt for the next part.
    move(120, beltEdge);
  }
}
