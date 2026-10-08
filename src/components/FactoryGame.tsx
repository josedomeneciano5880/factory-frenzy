// @ts-nocheck
import { useEffect, useRef, useState } from "react";

const W = 960;
const H = 600;
const BELT_Y = 70;
const BELT_H = 56;
const REACH = 95;

type Item = { id: number; x: number; type: number; defect: boolean };
type Station = { kind: "shelf" | "bin" | "desk"; type?: number; x: number; y: number; w: number; h: number };
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

function buildLayout(types: number): Station[] {
  const slots: { x: number; y: number }[] = [];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) slots.push({ x: 70 + c * 225, y: 240 + r * 180 });
  shuffle(slots);
  const st: Station[] = [];
  for (let t = 0; t < types; t++) st.push({ kind: "shelf", type: t, ...slots.pop()!, w: 120, h: 70 });
  st.push({ kind: "bin", ...slots.pop()!, w: 90, h: 80 });
  st.push({ kind: "desk", ...slots.pop()!, w: 120, h: 70 });
  return st;
}

export default function FactoryGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("menu");
  const [level, setLevel] = useState(0);
  const [msg, setMsg] = useState("");
  const [report, setReport] = useState<{ q: string; options: number[]; answer: number } | null>(null);
  const [best, setBest] = useState(0);

  const g = useRef({
    px: W / 2, py: 200, keys: {} as Record<string, boolean>,
    items: [] as Item[], carry: null as Item | null, stations: [] as Station[],
    spawnT: 0, lives: 3, done: 0, discarded: 0, organized: 0, missed: 0,
    nextId: 1, toast: "", toastT: 0, level: 0, phase: "menu" as Phase, mx: 0, my: 0,
  });

  const startLevel = (lv: number, fresh: boolean) => {
    const s = g.current;
    s.level = lv;
    s.items = [];
    s.carry = null;
    s.stations = buildLayout(LEVELS[lv].types);
    s.spawnT = 1;
    s.done = 0; s.discarded = 0; s.organized = 0; s.missed = 0;
    if (fresh) s.lives = 3;
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
      else setPhase("levelup");
    } else {
      setPhase("play");
      loseLife("Relatório com dados errados!");
      g.current.done = Math.max(0, g.current.done - 2);
    }
  };

  const interact = (tx?: number, ty?: number) => {
    const s = g.current;
    if (s.phase !== "play") return;
    const near = (x: number, y: number) => Math.hypot(x - s.px, y - s.py) < REACH;
    const inside = (st: Station, x: number, y: number) => x >= st.x && x <= st.x + st.w && y >= st.y && y <= st.y + st.h;
    const center = (st: Station) => ({ x: st.x + st.w / 2, y: st.y + st.h / 2 });

    // choose target station
    let target: Station | undefined;
    if (tx !== undefined && ty !== undefined) target = s.stations.find((st) => inside(st, tx, ty));
    else target = s.stations.filter((st) => { const c = center(st); return Math.hypot(c.x - s.px, c.y - s.py) < REACH + 40; })[0];

    if (target && Math.hypot(center(target).x - s.px, center(target).y - s.py) < REACH + 50) {
      if (target.kind === "desk") {
        if (s.carry) return toast("Largue a peça antes de fazer o relatório");
        if (s.done < LEVELS[s.level].quota) return toast(`Meta: ${s.done}/${LEVELS[s.level].quota} peças tratadas`);
        return openReport();
      }
      if (!s.carry) return;
      const it = s.carry;
      if (target.kind === "bin") {
        if (it.defect) { s.discarded++; s.done++; toast("✔ Descarte correto"); }
        else loseLife("Descartou uma peça boa!");
      } else {
        if (it.defect) loseLife("Peça defeituosa na prateleira!");
        else if (target.type !== it.type) loseLife("Prateleira errada!");
        else { s.organized++; s.done++; toast("✔ Organizado"); }
      }
      s.carry = null;
      return;
    }
    // pick from belt
    if (s.carry) return;
    let cand = s.items.filter((it) => near(it.x, BELT_Y + BELT_H / 2));
    if (tx !== undefined && ty !== undefined) cand = cand.filter((it) => Math.hypot(it.x - tx, BELT_Y + BELT_H / 2 - ty) < 30);
    cand.sort((a, b) => Math.abs(a.x - s.px) - Math.abs(b.x - s.px));
    if (cand[0]) { s.carry = cand[0]; s.items = s.items.filter((i) => i !== cand[0]); }
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
    const cv = canvasRef.current!;
    const ctx = cv.getContext("2d")!;
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = g.current;
      const L = LEVELS[s.level];
      if (s.phase === "play") {
        const sp = 230 * dt;
        const k = s.keys;
        if (k["w"] || k["arrowup"]) s.py -= sp;
        if (k["s"] || k["arrowdown"]) s.py += sp;
        if (k["a"] || k["arrowleft"]) s.px -= sp;
        if (k["d"] || k["arrowright"]) s.px += sp;
        s.px = Math.max(20, Math.min(W - 20, s.px));
        s.py = Math.max(BELT_Y + BELT_H + 22, Math.min(H - 20, s.py));
        s.spawnT -= dt;
        if (s.spawnT <= 0) {
          s.spawnT = L.spawn * (0.7 + Math.random() * 0.6);
          s.items.push({ id: s.nextId++, x: -20, type: Math.floor(Math.random() * L.types), defect: Math.random() < L.defect });
        }
        for (const it of s.items) it.x += L.speed * dt;
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
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/85 p-6 backdrop-blur-sm">
          <div className="max-w-lg rounded-lg border-2 border-primary bg-card p-8 text-center">
            {phase === "menu" && (<>
              <h2 className="font-display text-3xl text-primary">Turno de Qualidade</h2>
              <p className="mt-3 text-sm text-muted-foreground">Você é um estudante do SENAI na linha de produção. Descarte peças defeituosas (com X vermelho), organize as boas na prateleira da cor certa e entregue o relatório no computador. 4 fases. 3 vidas. Morreu? Volta do zero.</p>
              <p className="mt-3 text-xs text-muted-foreground">WASD/setas: mover · Clique ou E: pegar/soltar/usar</p>
              <button onClick={() => startLevel(0, true)} className="mt-6 rounded-md bg-primary px-6 py-3 font-bold text-primary-foreground hover:opacity-90">Bater o ponto</button>
            </>)}
            {phase === "report" && report && (<>
              <h2 className="font-display text-2xl text-primary">Relatório de Qualidade</h2>
              <p className="mt-4">{report.q}</p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {report.options.map((o) => (
                  <button key={o} onClick={() => answer(o)} className="rounded-md border-2 border-border bg-secondary px-4 py-3 text-xl font-bold hover:border-primary">{o}</button>
                ))}
              </div>
            </>)}
            {phase === "levelup" && (<>
              <h2 className="font-display text-3xl text-primary">Fase {level + 1} concluída!</h2>
              <p className="mt-3 text-sm text-muted-foreground">A esteira vai acelerar e novas peças chegam. O layout da fábrica muda.</p>
              <button onClick={() => startLevel(level + 1, false)} className="mt-6 rounded-md bg-primary px-6 py-3 font-bold text-primary-foreground">Próxima fase</button>
            </>)}
            {phase === "over" && (<>
              <h2 className="font-display text-3xl text-destructive">Demitido!</h2>
              <p className="mt-3">{msg}</p>
              <p className="mt-2 text-sm text-muted-foreground">Você chegou à fase {level + 1}. Recorde: fase {best}. Todo o progresso foi perdido.</p>
              <button onClick={() => startLevel(0, true)} className="mt-6 rounded-md bg-primary px-6 py-3 font-bold text-primary-foreground">Recomeçar do zero</button>
            </>)}
            {phase === "win" && (<>
              <h2 className="font-display text-3xl text-primary">Técnico aprovado! 🏆</h2>
              <p className="mt-3 text-sm text-muted-foreground">Você venceu as 4 fases da linha de produção.</p>
              <button onClick={() => startLevel(0, true)} className="mt-6 rounded-md bg-primary px-6 py-3 font-bold text-primary-foreground">Jogar de novo</button>
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
  // player (SENAI student)
  const { px, py } = s;
  ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.beginPath(); ctx.arc(px, py, REACH, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#1d4ed8"; ctx.beginPath(); ctx.arc(px, py, 17, 0, Math.PI * 2); ctx.fill(); // uniform
  ctx.fillStyle = "#f5c99b"; ctx.beginPath(); ctx.arc(px, py - 2, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.arc(px, py - 5, 11, Math.PI, 0); ctx.fill(); // helmet
  ctx.fillStyle = "#fff"; ctx.font = "bold 8px monospace"; ctx.textAlign = "center"; ctx.fillText("SENAI", px, py + 14);
  if (s.carry) drawPart(ctx, px + 20, py - 22, s.carry.type, s.carry.defect);
  // HUD
  ctx.fillStyle = "rgba(0,0,0,0.75)"; ctx.fillRect(0, 0, W, 54);
  ctx.textAlign = "left"; ctx.font = "bold 18px monospace";
  ctx.fillStyle = "#facc15"; ctx.fillText(`FASE ${s.level + 1}/4`, 16, 34);
  ctx.fillStyle = "#ef4444"; ctx.fillText("♥".repeat(Math.max(0, s.lives)) + "♡".repeat(Math.max(0, 3 - s.lives)), 160, 34);
  ctx.fillStyle = "#e5e7eb"; ctx.fillText(`META ${s.done}/${L.quota}`, 270, 34);
  ctx.font = "13px monospace"; ctx.fillStyle = "#9ca3af";
  ctx.fillText(s.done >= L.quota ? "Meta batida! Vá ao RELATÓRIO." : "Descarte ✗ · Organize por cor", 430, 34);
  if (s.toastT > 0) {
    ctx.globalAlpha = Math.min(1, s.toastT);
    ctx.fillStyle = "rgba(0,0,0,0.8)"; ctx.fillRect(W / 2 - 200, H - 60, 400, 36);
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.font = "bold 15px monospace";
    ctx.fillText(s.toast, W / 2, H - 37);
    ctx.globalAlpha = 1;
  }
}
