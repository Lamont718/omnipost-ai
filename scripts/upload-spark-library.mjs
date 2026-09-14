/**
 * Put the SPARK Builders artwork into the brand's Blob library.
 *
 * `library/<slug>/` is where `libraryFor` looks, and a brand with a library
 * uses it in preference to a share image. SPARK Builders had none, which is
 * why every post was falling through to the generated card — the one that
 * prints the caption's own first sentence back at the reader.
 *
 * Writes a manifest next to the cards so the seeder can pin each picture to
 * its post by name rather than by hoping the hash lands right.
 *
 *   node scripts/upload-spark-library.mjs <cardsDir>
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { put } from "@vercel/blob";

const DIR = process.argv[2];
if (!DIR) {
  console.error("usage: node scripts/upload-spark-library.mjs <cardsDir>");
  process.exit(1);
}
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("BLOB_READ_WRITE_TOKEN is not set");
  process.exit(1);
}

const files = readdirSync(DIR).filter((f) => f.endsWith(".png")).sort();
const manifest = {};

for (const file of files) {
  const body = readFileSync(`${DIR}/${file}`);
  // A blank card weighs almost nothing, and one uploaded is one that goes out.
  if (body.length < 20 * 1024) {
    console.error(`refusing ${file}: ${Math.round(body.length / 1024)}KB — that is a blank card`);
    process.exit(1);
  }
  const { url } = await put(`library/spark-builders/${file}`, body, {
    access: "public",
    contentType: "image/png",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  const name = file.replace(/\.png$/, "");
  manifest[name] = url;
  console.log(`${name.padEnd(26)} ${String(Math.round(body.length / 1024)).padStart(4)}KB  ${url}`);
}

writeFileSync(`${DIR}/manifest.json`, JSON.stringify(manifest, null, 2));
console.log(`\n${files.length} uploaded, manifest written`);
