/**
 * Screenshot a page through the Chrome DevTools Protocol.
 *
 * NOT `chrome --headless --screenshot --window-size=390,...`. That path has a
 * ~500px floor: ask for a 390px window and you get a 500px viewport with the
 * page's own mobile layout never triggered, which is how a phone screenshot
 * lies. `Emulation.setDeviceMetricsOverride` has no floor and sets the real
 * viewport, so the page's media queries and viewport meta actually fire.
 *
 *   node scripts/shoot.mjs <out.png> <url> [--w 390] [--h 844] [--dsf 3]
 *                          [--mobile] [--full] [--wait 2500]
 *
 * --full captures the whole scrollable page instead of one viewport.
 */
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}
const flag = (name) => process.argv.includes(`--${name}`);

const [out, url] = process.argv.slice(2);
if (!out || !url) {
  console.error("usage: node scripts/shoot.mjs <out.png> <url> [...]");
  process.exit(1);
}
const W = Number(arg("w", 390));
const H = Number(arg("h", 844));
const DSF = Number(arg("dsf", 3));
const MOBILE = flag("mobile");
const FULL = flag("full");
const WAIT = Number(arg("wait", 2500));
const PORT = 9333 + Math.floor(Math.random() * 400);

const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  "--disable-gpu",
  "--hide-scrollbars",
  "--no-first-run",
  "--no-default-browser-check",
  `--user-data-dir=${process.env.TEMP}/cdp-${PORT}`,
  "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Chrome needs a moment before /json/version answers. */
async function endpoint() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const j = await r.json();
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
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  }
};
function send(method, params = {}, sessionId) {
  const msgId = ++id;
  return new Promise((resolve, reject) => {
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });

await send("Page.enable", {}, sessionId);
// The whole reason this script exists — a real viewport, no floor.
await send("Emulation.setDeviceMetricsOverride", {
  width: W, height: H, deviceScaleFactor: DSF, mobile: MOBILE,
}, sessionId);

await send("Page.navigate", { url }, sessionId);
await sleep(WAIT);

/*
 * Stop every animation before capturing.
 *
 * `Page.captureScreenshot` waits for the compositor to hand it a frame, and on
 * a page that never stops animating under --disable-gpu that wait can simply
 * not end. elija-ways-out.vercel.app hung twice for minutes on end while the
 * four other builds shot in seconds; the page itself answers in 0.13s, so it
 * was never the network. Freezing also makes a shot reproducible, which a
 * moving page is not.
 */
await send("Runtime.evaluate", {
  expression: `(() => {
    const s = document.createElement('style');
    s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}';
    document.head.appendChild(s);
    document.querySelectorAll('video,audio').forEach(m => { try { m.pause(); } catch {} });
  })()`,
}, sessionId);
await sleep(400);

/*
 * No `clip`.
 *
 * A viewport capture already comes back at the emulated device scale factor,
 * so the clip was only ever restating it — and asking for one with `scale: 3`
 * on a 6,223px-tall page (elija-ways-out) made `Page.captureScreenshot` never
 * return at all, three times in a row, for minutes each. The four shorter
 * builds shot fine with the identical call. Dropping the clip fixed it
 * instantly; the frozen animations above turned out not to be the cause.
 */
const capture = () => send("Page.captureScreenshot", {
  format: "png",
  ...(FULL ? { captureBeyondViewport: true } : {}),
}, sessionId);

// Belt and braces: if the compositor still will not produce a frame, take the
// picture from the renderer instead of the surface. Slightly lower fidelity,
// infinitely better than hanging.
const shot = await Promise.race([
  capture(),
  sleep(20000).then(() =>
    send("Page.captureScreenshot", {
      format: "png",
      fromSurface: false,
      ...(FULL ? { captureBeyondViewport: true } : { clip: { x: 0, y: 0, width: W, height: H, scale: DSF } }),
    }, sessionId),
  ),
]);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, Buffer.from(shot.data, "base64"));

// Measured, so a horizontal-scroll bug can never hide behind a picture.
const { result } = await send("Runtime.evaluate", {
  expression: "JSON.stringify({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,sh:document.documentElement.scrollHeight})",
  returnByValue: true,
}, sessionId);
const m = JSON.parse(result.value);
console.log(`${out}  viewport=${W}x${H}@${DSF}x  scrollWidth=${m.sw}  clientWidth=${m.cw}  overflowsX=${m.sw > m.cw}  pageHeight=${m.sh}`);

ws.close();
// `chrome.kill()` kills only the launcher — headless Chrome spawns a tree of
// renderer and GPU children that survive it. Seventy-one of them were left
// running the first time this script was used in a loop, and the machine
// slowed until the next shot hung. /T kills the tree.
try {
  spawn("taskkill", ["/PID", String(chrome.pid), "/T", "/F"], { stdio: "ignore" });
} catch {
  chrome.kill();
}
process.exit(0);
