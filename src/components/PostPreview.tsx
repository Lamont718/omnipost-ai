"use client";

import { useEffect, useState } from "react";
import { Platform } from "@/lib/types";

/**
 * What a written post will actually look like on the platform it's going to.
 *
 * The calendar used to show captions as plain text in a dashed box, which tells
 * you nothing about whether a post reads well as a tweet versus an Instagram
 * caption. These render each platform's real chrome — avatar, handle, action
 * row, link card — so a post can be judged the way someone scrolling will see it.
 *
 * Deliberately honest about what isn't real: no invented like counts, no fake
 * comments, and the image slot says plainly that no artwork is attached. The
 * only thing being previewed is the copy, because the copy is the only thing
 * this app produces.
 */

export interface PreviewBrand {
  slug: string;
  name: string;
  colorHex: string;
  /** @handle for the mock. Falls back to the slug — set the real one in brands.ts. */
  handle?: string;
}

export interface PreviewTopic {
  title: string;
  url?: string;
}

export const PLATFORM_NAME: Record<Platform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  x: "X",
};

/** Hard caption limits, so an over-length post is obvious before it's posted. */
export const PLATFORM_LIMIT: Record<Platform, number> = {
  instagram: 2200,
  facebook: 63206,
  linkedin: 3000,
  x: 280,
};

const BLUE = "#1d9bf0";
const LI_BLUE = "#0a66c2";

function initials(name: string): string {
  const words = name.replace(/[^A-Za-z ]/g, "").trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();
}

function handleFor(brand: PreviewBrand): string {
  return brand.handle ?? `@${brand.slug.replace(/-/g, "")}`;
}

function domainOf(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Colour hashtags (and only hashtags) the way each platform does. */
function RichText({ text, linkColor }: { text: string; linkColor: string }) {
  const parts = text.split(/(#[A-Za-z0-9_]+)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("#") ? (
          <span key={i} style={{ color: linkColor }}>
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function Avatar({
  brand,
  size,
  square = false,
  ring = false,
}: {
  brand: PreviewBrand;
  size: number;
  square?: boolean;
  ring?: boolean;
}) {
  const inner = (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: square ? size * 0.12 : "50%",
        background: brand.colorHex,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: size * 0.38,
        letterSpacing: 0.2,
        flexShrink: 0,
      }}
    >
      {initials(brand.name)}
    </div>
  );
  if (!ring) return inner;
  return (
    <div
      style={{
        padding: 2,
        borderRadius: "50%",
        background: "linear-gradient(45deg,#f09433,#dc2743,#bc1888)",
        display: "inline-flex",
        flexShrink: 0,
      }}
    >
      <div style={{ padding: 2, borderRadius: "50%", background: "#fff", display: "flex" }}>
        {inner}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ icons */

const ico = (d: string, key?: string) => (
  <svg
    key={key}
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={d} />
  </svg>
);

const HEART = "M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 000-7.8z";
const BUBBLE = "M21 11.5a8.4 8.4 0 01-9 8.4 8.9 8.9 0 01-4-.9L3 21l2-4.5A8.4 8.4 0 013 11.5a8.4 8.4 0 019-8.4 8.4 8.4 0 019 8.4z";
const SEND = "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z";
const BOOKMARK = "M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z";
const RETWEET = "M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3";
const REPLY = "M21 11.5a8.4 8.4 0 01-9 8.4 8.9 8.9 0 01-4-.9L3 21l2-4.5A8.4 8.4 0 013 11.5a8.4 8.4 0 019-8.4 8.4 8.4 0 019 8.4z";
const CHART = "M3 3v18h18M7 15v3M12 9v9M17 5v13";
const THUMB = "M7 22V11l5-9a2.5 2.5 0 012.5 2.5V9h5a2 2 0 012 2.3l-1.4 8A2 2 0 0118 21H7zM7 22H4a1 1 0 01-1-1v-9a1 1 0 011-1h3";
const GLOBE = "M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3a14 14 0 010 18 14 14 0 010-18z";

/* --------------------------------------------------------------- shells */

function Card({ children, maxWidth = 400 }: { children: React.ReactNode; maxWidth?: number }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e4e6eb",
        borderRadius: 12,
        maxWidth,
        width: "100%",
        overflow: "hidden",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      {children}
    </div>
  );
}

/**
 * The share image the topic's own page publishes, or null while loading / if
 * the page has none. This is the real artwork a follower would see — no image
 * is generated here.
 */
function useTopicImage(url?: string): string | null {
  const [image, setImage] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setImage(null);
      return;
    }
    let live = true;
    fetch(`/api/og-image?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((d) => {
        if (live) setImage(d.image ?? null);
      })
      .catch(() => {
        if (live) setImage(null);
      });
    return () => {
      live = false;
    };
  }, [url]);

  return image;
}

/** The post's artwork — the page's real share image, or a labelled stand-in. */
function MediaSlot({ brand, topic }: { brand: PreviewBrand; topic: PreviewTopic }) {
  const image = useTopicImage(topic.url);

  if (image) {
    return (
      <div style={{ aspectRatio: "1 / 1", background: "#000" }}>
        {/* Plain <img>: these are arbitrary brand-site hosts, and next/image
            would need every one of them declared in next.config. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={topic.title}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        aspectRatio: "1 / 1",
        background: `linear-gradient(140deg, ${brand.colorHex}, ${brand.colorHex}99)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center",
        color: "#fff",
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.35, textWrap: "balance" }}>
        {topic.title}
      </div>
      <div
        style={{
          marginTop: 14,
          fontSize: 10,
          letterSpacing: 1,
          textTransform: "uppercase",
          opacity: 0.75,
          border: "1px solid rgba(255,255,255,.5)",
          borderRadius: 999,
          padding: "3px 10px",
        }}
      >
        {topic.url ? "No share image on this page" : "No image attached"}
      </div>
    </div>
  );
}

function LinkCard({ topic, tall = false }: { topic: PreviewTopic; tall?: boolean }) {
  const domain = domainOf(topic.url);
  const image = useTopicImage(tall ? topic.url : undefined);
  if (!domain) return null;
  return (
    <div style={{ border: "1px solid #dadde1", borderTop: "none", background: "#f7f8fa" }}>
      {tall &&
        (image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{ height: 96, background: "#e4e6eb" }} />
        ))}
      <div style={{ padding: "10px 12px" }}>
        <div style={{ fontSize: 11, color: "#65676b", textTransform: "uppercase", letterSpacing: 0.3 }}>
          {domain}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#050505", marginTop: 2, lineHeight: 1.3 }}>
          {topic.title}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ platforms */

interface ShellProps {
  brand: PreviewBrand;
  topic: PreviewTopic;
  caption: string;
  when: string;
}

function InstagramPost({ brand, topic, caption, when }: ShellProps) {
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
        <Avatar brand={brand} size={32} ring />
        <div style={{ fontSize: 13, fontWeight: 600, color: "#000", flex: 1 }}>
          {handleFor(brand).replace("@", "")}
        </div>
        <div style={{ color: "#262626", letterSpacing: 2, fontSize: 14 }}>•••</div>
      </div>

      <MediaSlot brand={brand} topic={topic} />

      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 12px 6px", color: "#262626" }}>
        {ico(HEART)}
        {ico(BUBBLE)}
        {ico(SEND)}
        <div style={{ marginLeft: "auto", color: "#262626" }}>{ico(BOOKMARK)}</div>
      </div>

      <div style={{ padding: "0 12px 14px", fontSize: 13.5, lineHeight: 1.5, color: "#000" }}>
        <span style={{ fontWeight: 600, marginRight: 5 }}>
          {handleFor(brand).replace("@", "")}
        </span>
        <span style={{ whiteSpace: "pre-wrap" }}>
          <RichText text={caption} linkColor="#00376b" />
        </span>
        <div style={{ marginTop: 8, fontSize: 10, color: "#8e8e8e", textTransform: "uppercase", letterSpacing: 0.3 }}>
          {when}
        </div>
      </div>
    </Card>
  );
}

function XPost({ brand, topic, caption, when }: ShellProps) {
  const over = caption.length > PLATFORM_LIMIT.x;
  return (
    <Card>
      <div style={{ display: "flex", gap: 12, padding: 14 }}>
        <Avatar brand={brand} size={40} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", gap: 5, alignItems: "baseline", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 14.5, color: "#0f1419" }}>{brand.name}</span>
            <span style={{ color: "#536471", fontSize: 14 }}>{handleFor(brand)}</span>
            <span style={{ color: "#536471", fontSize: 14 }}>· {when}</span>
          </div>

          <div
            style={{
              fontSize: 15,
              lineHeight: 1.4,
              color: "#0f1419",
              whiteSpace: "pre-wrap",
              marginTop: 2,
              wordBreak: "break-word",
            }}
          >
            <RichText text={caption} linkColor={BLUE} />
          </div>

          {over && (
            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                color: "#b91c1c",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                padding: "6px 9px",
              }}
            >
              {caption.length} characters — {caption.length - PLATFORM_LIMIT.x} over the {PLATFORM_LIMIT.x} limit.
              This would need trimming or a thread.
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              maxWidth: 300,
              marginTop: 12,
              color: "#536471",
            }}
          >
            {ico(REPLY)}
            {ico(RETWEET)}
            {ico(HEART)}
            {ico(CHART)}
          </div>
        </div>
      </div>
      {/* X renders a large summary card, image included, when the page has one. */}
      {topic.url && <LinkCard topic={topic} tall />}
    </Card>
  );
}

function FacebookPost({ brand, topic, caption, when }: ShellProps) {
  return (
    <Card maxWidth={420}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 12 }}>
        <Avatar brand={brand} size={40} />
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: "#050505" }}>{brand.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#65676b", fontSize: 12.5 }}>
            {when} ·
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d={GLOBE} />
            </svg>
          </div>
        </div>
        <div style={{ marginLeft: "auto", color: "#65676b", letterSpacing: 2 }}>•••</div>
      </div>

      <div
        style={{
          padding: "0 12px 12px",
          fontSize: 14.5,
          lineHeight: 1.45,
          color: "#050505",
          whiteSpace: "pre-wrap",
        }}
      >
        <RichText text={caption} linkColor={LI_BLUE} />
      </div>

      <LinkCard topic={topic} tall />

      <div
        style={{
          display: "flex",
          justifyContent: "space-around",
          borderTop: "1px solid #e4e6eb",
          padding: "6px 0",
          color: "#65676b",
          fontSize: 13.5,
          fontWeight: 600,
        }}
      >
        {["Like", "Comment", "Share"].map((label) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px" }}>
            {ico(label === "Like" ? THUMB : label === "Comment" ? BUBBLE : SEND, label)}
            {label}
          </div>
        ))}
      </div>
    </Card>
  );
}

function LinkedInPost({ brand, topic, caption, when }: ShellProps) {
  return (
    <Card maxWidth={440}>
      <div style={{ display: "flex", gap: 10, padding: 12 }}>
        <Avatar brand={brand} size={48} square />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#000000e6" }}>{brand.name}</div>
          <div style={{ fontSize: 12, color: "#00000099", marginTop: 1 }}>
            {handleFor(brand)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#00000099", fontSize: 12 }}>
            {when} ·
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d={GLOBE} />
            </svg>
          </div>
        </div>
        <div style={{ marginLeft: "auto", color: "#00000099", letterSpacing: 2 }}>•••</div>
      </div>

      <div
        style={{
          padding: "0 12px 12px",
          fontSize: 14,
          lineHeight: 1.5,
          color: "#000000e6",
          whiteSpace: "pre-wrap",
        }}
      >
        <RichText text={caption} linkColor={LI_BLUE} />
      </div>

      <LinkCard topic={topic} tall />

      <div
        style={{
          display: "flex",
          justifyContent: "space-around",
          borderTop: "1px solid #e4e6eb",
          padding: "4px 0",
          color: "#00000099",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        {["Like", "Comment", "Repost", "Send"].map((label) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 8px" }}>
            {ico(
              label === "Like" ? THUMB : label === "Comment" ? BUBBLE : label === "Repost" ? RETWEET : SEND,
              label,
            )}
            {label}
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ api */

export function PostPreview({
  platform,
  brand,
  topic,
  caption,
  when = "now",
}: {
  platform: Platform;
  brand: PreviewBrand;
  topic: PreviewTopic;
  caption: string;
  when?: string;
}) {
  const props = { brand, topic, caption, when };
  switch (platform) {
    case "instagram":
      return <InstagramPost {...props} />;
    case "x":
      return <XPost {...props} />;
    case "facebook":
      return <FacebookPost {...props} />;
    case "linkedin":
      return <LinkedInPost {...props} />;
  }
}

/** Empty state — the slot's design, before anything has been written into it. */
export function EmptyPreview({ platform, brand }: { platform: Platform; brand: PreviewBrand }) {
  return (
    <div
      style={{
        border: "1px dashed #d1d5db",
        borderRadius: 12,
        padding: "32px 20px",
        textAlign: "center",
        background: "#fafafa",
        maxWidth: 400,
      }}
    >
      <Avatar brand={brand} size={40} />
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "#374151", marginTop: 10 }}>
        Nothing written for {PLATFORM_NAME[platform]} yet
      </div>
      <div style={{ fontSize: 12.5, color: "#9ca3af", marginTop: 4 }}>
        Write the post and it will appear here as {brand.name} will see it.
      </div>
    </div>
  );
}
