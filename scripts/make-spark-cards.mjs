/**
 * Build the SPARK Builders post artwork — 1080x1350, one per scheduled post.
 *
 * Two kinds, and the split is the whole point:
 *
 *   build — a real screenshot of the tool the kid actually made, shot at a real
 *           390px phone viewport through CDP (see scripts/shoot.mjs for why
 *           `--window-size` cannot do this). Nothing here is illustrated or
 *           implied; it is the thing itself.
 *
 *   quote — a line lifted word for word off sparkbuilders.org, for the posts
 *           that are about the method rather than one build.
 *
 * ★ Every quote is DELIBERATELY a different sentence from the one its caption
 * opens with. The generated fallback card prints the caption's own first line,
 * so the reader met the same words twice and the post said one thing — the
 * defect `artworkSays` exists for on YODM. A card that repeats the caption is
 * worse than no card.
 *
 * Renders through one Chrome session rather than one per card: launching it
 * fourteen times left seventy-one orphaned processes and the machine crawling.
 *
 *   node scripts/make-spark-cards.mjs <shotsDir> <outDir>
 */
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve as resolvePath } from "node:path";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const [SHOTS, OUT] = process.argv.slice(2);
if (!SHOTS || !OUT) {
  console.error("usage: node scripts/make-spark-cards.mjs <shotsDir> <outDir>");
  process.exit(1);
}

const NAVY = "#0c1226";
const AMBER = "#ffb300";
const CREAM = "#fffdf7";

/** name → the card. `shot` is a file in <shotsDir>; `quote` is site copy. */
const CARDS = [
  { name: "build-star-math", kind: "build", shot: "star-math.png",
    eyebrow: "Yourself · SPARK", title: "Star Math",
    sub: "Built by a seven-year-old. Her whole class uses it." },
  { name: "quote-the-sheet", kind: "quote",
    eyebrow: "The SPARK Discovery sheet",
    quote: "Find the one thing your kid lights up about.",
    sub: "Fifteen minutes at the kitchen table." },
  { name: "build-cleaning-list", kind: "build", shot: "cleaning-list.png",
    eyebrow: "Your Home · Emeka, 7", title: "Our Cleaning List",
    sub: "The chore tool her family actually uses." },
  { name: "build-ways-out", kind: "build", shot: "ways-out.png",
    eyebrow: "Your Community · Elija, 14", title: "Ways Out",
    sub: "Free, 24/7 help — built for kids on his block." },
  { name: "quote-the-notebook", kind: "quote",
    eyebrow: "Every builder gets a journal",
    quote: "A drawing they made is theirs in a way a screen never is.",
    sub: "Before anything is built, it is drawn by hand." },
  { name: "pillars-four-places", kind: "pillars",
    eyebrow: "Where a builder looks", title: "Closest to widest",
    items: ["Yourself", "Your Home", "Your School", "Your Community"],
    sub: "Four places. One problem worth building for." },
  { name: "quote-stuck", kind: "quote",
    eyebrow: "When the build breaks",
    quote: "Stuck stops being a wall and becomes the next small move.",
    sub: "The richest moment in the session." },
  { name: "quote-i-dont-know", kind: "quote",
    eyebrow: "What we keep seeing",
    quote: "Kids who freeze at the first “I don't know.”",
    sub: "That is the muscle SPARK trains." },
  { name: "build-story-detective", kind: "build", shot: "story-detective.png",
    eyebrow: "Yourself · Iye, 7", title: "Story Detective",
    sub: "Reading, turned into solving cases." },
  { name: "quote-their-name", kind: "quote",
    eyebrow: "The rule under everything",
    quote: "If the kid stops supplying the heart of it, you've built a generic thing wearing their name.",
    sub: "So we build exactly what they drew." },
  { name: "quote-star-lights", kind: "quote",
    eyebrow: "How a star lights",
    quote: "Give it to someone real — and the star lights up.",
    sub: "Finished is a project. Used is a star." },
  { name: "build-together", kind: "build", shot: "together.png",
    eyebrow: "Your Home · Kourtney, 14", title: "Together",
    sub: "A two-minute daily ritual her family uses." },
  { name: "quote-not-less-screen", kind: "quote",
    eyebrow: "The question we always get",
    quote: "The answer isn't less screen — it's fluency.",
    sub: "A kid holding the wheel. Author, not spectator." },
  { name: "quote-real-quotes", kind: "quote",
    eyebrow: "Session two: the interview",
    quote: "Real quotes, not guesses.",
    sub: "You can't fix a problem you only imagined." },
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/*
 * The screenshot is referenced as a file:// URL, NOT inlined as a data URI.
 *
 * Inlining looked tidier and silently produced blank cards: a 1.7MB PNG is a
 * ~2.3MB base64 string, the whole card was then navigated to as one
 * `data:text/html,...` URL, and Chrome quietly refuses to navigate past its
 * data-URL size limit. Three of the five build cards came out white and the
 * only visible symptom was a 7KB file where a 700KB one belonged — which is
 * why the size of every card is printed below.
 */
const fileUrl = (file) =>
  "file:///" + resolvePath(SHOTS, file).split("\\").join("/");

function html(card) {
  const footer = `
    <div class="footer">
      <div class="mark">SPARK<br><span>Builders</span></div>
      <div class="site">sparkbuilders.org</div>
    </div>`;

  let body;
  if (card.kind === "build") {
    body = `
      <div class="eyebrow">${esc(card.eyebrow)}</div>
      <div class="phone"><img src="${fileUrl(card.shot)}"></div>
      <div class="cap">
        <div class="title">${esc(card.title)}</div>
        <div class="sub">${esc(card.sub)}</div>
      </div>`;
  } else if (card.kind === "pillars") {
    body = `
      <div class="eyebrow">${esc(card.eyebrow)}</div>
      <div class="middle">
        <div class="title big">${esc(card.title)}</div>
        <ol class="pillars">${card.items
          .map((t, i) => `<li><b>${i + 1}</b>${esc(t)}</li>`)
          .join("")}</ol>
      </div>
      <div class="sub wide">${esc(card.sub)}</div>`;
  } else {
    body = `
      <div class="eyebrow">${esc(card.eyebrow)}</div>
      <div class="middle">
        <div class="quote">${esc(card.quote)}</div>
      </div>
      <div class="sub wide">${esc(card.sub)}</div>`;
  }

  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1080px;height:1350px;background:${NAVY};color:${CREAM};
       font-family:"Bricolage Grotesque",system-ui,sans-serif;overflow:hidden;
       display:flex;flex-direction:column;padding:64px 64px 0}
  .eyebrow{font-size:30px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;
           color:${AMBER};margin-bottom:34px}
  .middle{flex:1;display:flex;flex-direction:column;justify-content:center}
  .quote{font-size:82px;line-height:1.1;font-weight:800;letter-spacing:-.02em}
  .title{font-size:70px;font-weight:800;letter-spacing:-.02em;line-height:1.05}
  .title.big{font-size:92px;margin-bottom:46px}
  .pillars{list-style:none}
  .pillars li{display:flex;align-items:center;gap:30px;font-size:60px;font-weight:600;
              padding:20px 0;border-bottom:2px solid rgba(255,253,247,.14)}
  .pillars li:last-child{border-bottom:0}
  .pillars b{color:${NAVY};background:${AMBER};width:64px;height:64px;border-radius:50%;
             display:flex;align-items:center;justify-content:center;font-size:34px;flex:0 0 64px}
  .sub{font-size:34px;font-weight:400;color:rgba(255,253,247,.72);line-height:1.3}
  .sub.wide{margin-bottom:30px}
  /* The screenshot is the hero: a real phone viewport, cropped at the fold. */
  .phone{flex:1;border-radius:34px;overflow:hidden;background:#fff;
         box-shadow:0 0 0 3px rgba(255,179,0,.5), 0 30px 70px rgba(0,0,0,.5);
         margin-bottom:26px}
  .phone img{width:100%;display:block}
  .cap{margin-bottom:26px}
  .cap .sub{margin-top:10px}
  .footer{display:flex;align-items:flex-end;justify-content:space-between;
          border-top:3px solid ${AMBER};padding:26px 0 46px}
  .mark{font-size:36px;font-weight:800;line-height:1.05;letter-spacing:.02em}
  .mark span{font-weight:400;color:rgba(255,253,247,.75)}
  .site{font-size:30px;color:${AMBER};font-weight:600}
</style></head><body>${body}${footer}</body></html>`;
}

// ---------------------------------------------------------------- CDP driver
const PORT = 9800 + Math.floor(Math.random() * 300);
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${PORT}`, "--disable-gpu",
  "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
  `--user-data-dir=${process.env.TEMP}/cards-${PORT}`, "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function endpoint() {
  for (let i = 0; i < 80; i++) {
    try {
      const j = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error("chrome never came up");
}

const ws = new WebSocket(await endpoint());
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(m.error.message)) : resolve(m.result);
  }
};
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId);
await send("Emulation.setDeviceMetricsOverride",
  { width: 1080, height: 1350, deviceScaleFactor: 1, mobile: false }, sessionId);

mkdirSync(OUT, { recursive: true });
/** Wait for the real thing rather than guessing at a sleep. */
async function ready() {
  for (let i = 0; i < 60; i++) {
    const { result } = await send("Runtime.evaluate", {
      expression: `document.fonts.status === "loaded" &&
        [...document.images].every(i => i.complete && i.naturalWidth > 0)`,
      returnByValue: true,
    }, sessionId);
    if (result.value === true) return true;
    await sleep(250);
  }
  return false;
}

let failed = 0;
for (const card of CARDS) {
  const page = `${OUT}/_${card.name}.html`;
  writeFileSync(page, html(card), "utf8");
  await send("Page.navigate", { url: "file:///" + resolvePath(page).split("\\").join("/") }, sessionId);
  const ok = await ready();
  const shot = await send("Page.captureScreenshot", { format: "png" }, sessionId);
  const bytes = Buffer.from(shot.data, "base64");
  writeFileSync(`${OUT}/${card.name}.png`, bytes);
  const kb = Math.round(bytes.length / 1024);
  // A card that renders blank weighs almost nothing. Say so rather than
  // leaving it to be spotted in a thumbnail.
  const suspect = kb < 20;
  if (!ok || suspect) failed++;
  console.log(`${card.name.padEnd(26)} ${card.kind.padEnd(8)} ${String(kb).padStart(4)}KB` +
    `${ok ? "" : "  ASSETS NEVER LOADED"}${suspect ? "  SUSPICIOUSLY SMALL — probably blank" : ""}`);
}
if (failed) {
  console.error(`
${failed} card(s) look wrong`);
}

ws.close();
spawn("taskkill", ["/PID", String(chrome.pid), "/T", "/F"], { stdio: "ignore" });
process.exit(0);
