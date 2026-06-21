import "jsr:@supabase/functions-js/edge-runtime.d.ts";

interface SharedMedia {
  id?: string;
  media_type: "image" | "video";
  public_url: string;
  sort_order: number;
}

interface SharedNote {
  title: string;
  content: string;
  cover_url: string | null;
  updated_at: string;
  note_media: SharedMedia[];
}

const UUID =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const TOKEN_RE = new RegExp(`^(${UUID})_(${UUID})$`, "i");
const IMG_MARKER_RE = /\{\{img:([a-zA-Z0-9-]+)\}\}/g;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function stripImageMarkers(content: string): string {
  return content.replace(IMG_MARKER_RE, " ").replace(/\s+/g, " ").trim();
}

function summarize(content: string, maxLength = 120): string {
  const trimmed = stripImageMarkers(content);
  if (!trimmed) return "来自 XS Note 的分享";
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}…` : trimmed;
}

function renderContentHtml(note: SharedNote): string {
  const mediaById = new Map(
    (note.note_media ?? [])
      .filter((item) => item.id)
      .map((item) => [item.id!, item]),
  );

  const parts = (note.content || "").split(IMG_MARKER_RE);
  const html: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      if (parts[i]) {
        html.push(`<span class="content-text">${escapeHtml(parts[i])}</span>`);
      }
      continue;
    }

    const item = mediaById.get(parts[i]);
    if (item?.media_type === "image") {
      html.push(
        `<figure class="inline-image"><img src="${escapeHtml(item.public_url)}" alt="" /></figure>`,
      );
    }
  }

  if (html.length === 0) {
    return `<span class="content-text">${escapeHtml(note.content?.trim() || "暂无正文")}</span>`;
  }

  return html.join("");
}

function renderVideoGrid(note: SharedNote): string {
  const videos = [...(note.note_media ?? [])]
    .filter((item) => item.media_type === "video")
    .sort((a, b) => a.sort_order - b.sort_order);

  if (videos.length === 0) return "";

  const items = videos.map((item) =>
    `<div class="media-item"><video src="${escapeHtml(item.public_url)}" controls preload="metadata"></video></div>`
  ).join("");

  return `<div class="media-grid">${items}</div>`;
}

function pickCover(note: SharedNote, fallback: string): string {
  if (note.cover_url) return note.cover_url;
  const image = note.note_media?.find((item) => item.media_type === "image");
  return image?.public_url || fallback;
}

function parseToken(raw: string): { userId: string; noteId: string } | null {
  const match = raw.match(TOKEN_RE);
  if (!match) return null;
  return { userId: match[1], noteId: match[2] };
}

function renderPage(
  note: SharedNote,
  shareUrl: string,
  appShareUrl: string,
  fallbackCover: string,
): string {
  const title = note.title?.trim() || "无标题";
  const description = summarize(note.content);
  const image = pickCover(note, fallbackCover);
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeContent = renderContentHtml(note);
  const safeImage = escapeHtml(image);
  const safeShareUrl = escapeHtml(shareUrl);
  const safeAppShareUrl = escapeHtml(appShareUrl);
  const videoGrid = renderVideoGrid(note);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDescription}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="XS Note" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDescription}" />
  <meta property="og:image" content="${safeImage}" />
  <meta property="og:url" content="${safeShareUrl}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDescription}" />
  <meta name="twitter:image" content="${safeImage}" />
  <meta itemprop="name" content="${safeTitle}" />
  <meta itemprop="description" content="${safeDescription}" />
  <meta itemprop="image" content="${safeImage}" />
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f1f3f2; color: #1e2d2c; font-size: 16px; line-height: 1.6; }
    .wrap { max-width: 720px; margin: 0 auto; padding: 24px 16px 40px; }
    .card { background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 24px rgba(30,45,44,.08); }
    .body { padding: 20px; }
    .brand { font-size: 12px; letter-spacing: .08em; color: #18924d; margin-bottom: 8px; }
    h1 { margin: 0 0 16px; font-size: clamp(1.375rem, 1.25rem + 0.6vw, 1.625rem); font-weight: 600; line-height: 1.3; }
    .content { line-height: 1.7; word-break: break-word; margin: 0; }
    .content-text { white-space: pre-wrap; }
    .inline-image { margin: 12px 0; border-radius: 12px; overflow: hidden; background: #e8efec; }
    .inline-image img { width: 100%; display: block; }
    .media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; margin-top: 24px; }
    .media-item { position: relative; border-radius: 8px; overflow: hidden; background: #e8efec; aspect-ratio: 1; }
    .media-item video { width: 100%; height: 100%; object-fit: contain; display: block; background: #000; }
    .link { display: inline-block; margin-top: 24px; color: #18924d; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="wrap">
    <article class="card">
      <div class="body">
        <div class="brand">XS NOTE · 公开分享</div>
        <h1>${safeTitle}</h1>
        <div class="content">${safeContent}</div>
        ${videoGrid}
        <a class="link" href="${safeAppShareUrl}">在 XS Note 中打开</a>
      </div>
    </article>
  </div>
</body>
</html>`;
}

async function fetchSharedNote(
  supabaseUrl: string,
  userId: string,
  noteId: string,
): Promise<SharedNote | null> {
  const jsonUrl =
    `${supabaseUrl}/storage/v1/object/public/note-media/${userId}/shares/${noteId}.json`;
  const response = await fetch(jsonUrl, { headers: { "Cache-Control": "no-cache" } });
  if (!response.ok) return null;
  return response.json() as Promise<SharedNote>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const rawToken = decodeURIComponent(parts[parts.length - 1] ?? "");

  const parsed = parseToken(rawToken);
  if (!parsed) {
    return new Response("Share not found", { status: 404 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const appOrigin = Deno.env.get("APP_ORIGIN") ?? "https://orange-186.github.io";
  const appBase = Deno.env.get("APP_BASE_PATH") ?? "/XS-Note";

  if (!supabaseUrl) {
    return new Response("Server misconfigured", { status: 500 });
  }

  const note = await fetchSharedNote(supabaseUrl, parsed.userId, parsed.noteId);
  if (!note) {
    return new Response("Share not found", { status: 404 });
  }

  const token = `${parsed.userId}_${parsed.noteId}`;
  const shareUrl = `${supabaseUrl}/functions/v1/note-share/${token}`;
  const appShareUrl = `${appOrigin}${appBase}/share/${token}`;
  const fallbackCover = `${appOrigin}${appBase}/og-default.png`;

  return new Response(renderPage(note, shareUrl, appShareUrl, fallbackCover), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
