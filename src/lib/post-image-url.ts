/**
 * How a post's generated artwork is addressed.
 *
 * Pure string-building, kept out of PostPreview.tsx because that file is a
 * client component and the Metricool export needs these on the server. Both
 * callers have to agree on the URL exactly, or the picture in the preview is
 * not the picture that gets posted.
 */

/**
 * The opening line of a caption, for artwork that has to carry the post on its
 * own. Hashtags and trailing URLs are stripped — they belong in the caption, not
 * burned into a picture.
 */
export function hookLine(caption: string): string {
  const body = caption
    .replace(/https?:\/\/\S+/g, "")
    .replace(/#[A-Za-z0-9_]+/g, "")
    .trim();
  const firstPara = body.split(/\n{2,}/)[0] ?? body;
  const sentences = firstPara.match(/[^.!?]+[.!?]?/g) ?? [firstPara];
  let out = "";
  for (const s of sentences) {
    if (out && (out + s).trim().length > 170) break;
    out += s;
    if (out.trim().length >= 60) break;
  }
  return out.trim().replace(/\s+/g, " ");
}

/**
 * Where a post's artwork comes from, in order of preference.
 *
 * The topic's own page publishes a share image, and that is always the better
 * picture: it is the real thing a follower sees, already designed. But brands
 * with no website have no page and no share image ever — and those posts were
 * going out with nothing attached.
 *
 * So the generated card is the floor, not the goal. Every post ends up with
 * something you can actually publish.
 */
export function generatedImageUrl(
  brandSlug: string,
  caption: string,
  shape: "square" | "wide" = "square",
): string {
  const params = new URLSearchParams({
    brand: brandSlug,
    text: hookLine(caption),
    shape,
  });
  return `/api/post-image?${params.toString()}`;
}
