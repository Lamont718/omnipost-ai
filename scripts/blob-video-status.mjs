// What video clips is the calendar actually serving, and how big are they?
//
// ⚠️ The clips a family sees on the calendar come from Blob, not from the
// Desktop folder. Rebuilding a clip on disk changes nothing about what posts
// until the blob is replaced — so before and after any rebuild, look HERE.
import { readFileSync } from "node:fs";
import { list } from "@vercel/blob";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
}

const { blobs } = await list({ prefix: "library/yodm/video" });
const vids = blobs.filter((b) => /\.(mp4|mov|webm)$/i.test(b.pathname));
console.log(`${vids.length} clips on the calendar\n`);
for (const b of vids.sort((a, c) => a.pathname.localeCompare(c.pathname))) {
  const name = b.pathname.split("/").pop();
  console.log(
    `  ${name.padEnd(34)} ${(b.size / 1e6).toFixed(1).padStart(6)} MB   uploaded ${String(b.uploadedAt).slice(0, 19)}`,
  );
}
