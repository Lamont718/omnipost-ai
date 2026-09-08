// Replace a clip the calendar serves.
//
// ⚠️ REBUILDING A CLIP ON DISK CHANGES NOTHING ABOUT WHAT POSTS. The calendar
// reads from Blob, so a clip fixed in the Desktop folder and not pushed here is
// a fix nobody will ever see — which is how three old-format clips stayed in the
// rotation for two days after the card frame existed.
//
//     node scripts/blob-put-video.mjs <name> <file>
//
// Nothing is posted by this. It swaps the asset the preview and the calendar
// read; his thumb is still on every post.
import { readFileSync } from "node:fs";
import { put, list } from "@vercel/blob";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
}

const [name, file] = process.argv.slice(2);
if (!name || !file) {
  console.error("usage: node scripts/blob-put-video.mjs <name> <file>");
  process.exit(1);
}

const key = `library/yodm/video/${name}.mp4`;
const before = (await list({ prefix: key })).blobs[0];
const body = readFileSync(file);

console.log(`${name}`);
console.log(`  was:  ${before ? (before.size / 1e6).toFixed(1) + " MB  " + String(before.uploadedAt).slice(0, 24) : "(not there)"}`);
console.log(`  now:  ${(body.length / 1e6).toFixed(1)} MB  <- ${file}`);

// ★ addRandomSuffix:false and allowOverwrite so the NAME stays stable — the
// calendar addresses clips by name, and a suffixed upload would quietly become
// a second clip beside the one it was meant to replace.
const res = await put(key, body, {
  access: "public",
  contentType: "video/mp4",
  addRandomSuffix: false,
  allowOverwrite: true,
});
console.log(`  ok:   ${res.url}`);
