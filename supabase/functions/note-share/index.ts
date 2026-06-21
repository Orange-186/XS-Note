import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface SharedMedia {
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function summarize(content: string, maxLength = 120): string {
  const trimmed = content.replace(/\s+/g, " ").trim();
  if (!trimmed) return "来自 XS Note 的分享";
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}…` : trimmed;
}

function pickCover(note: SharedNote, fallback: string): string {
  if (note.cover_url) return note.cover_url;
  const image = note.note_media?.find((item) => item.media_type === "image");
  return image?.public_url || fallback;
}

function renderPage(note: SharedNote, shareUrl: string, appShareUrl: string, fallbackCover: string): string {
  const title = note.title?.trim() || "无标题";
  const description = summarize(note.content);
  const image = pickCover(note, fallbackCover);
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeContent = escapeHtml(note.content || "暂无正文").replace(/\n/g, "<br />");
  const safeImage = escapeHtml(image);
  const safeShareUrl = escapeHtml(shareUrl);
  const safeAppShareUrl = escapeHtml(appShareUrl);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle} · XS Note</title>
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
    :root { color-scheme: light; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f1f3f2;
      color: #1e2d2c;
    }
    .wrap {
      max-width: 720px;
      margin: 0 auto;
      padding: 24px 16px 40px;
    }
    .card {
      background: #fff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(30, 45, 44, 0.08);
    }
    .cover {
      width: 100%;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      display: block;
      background: #e8efec;
    }
    .body { padding: 20px; }
    .brand {
      font-size: 12px;
      letter-spacing: 0.08em;
      color: #18924d;
      margin-bottom: 8px;
    }
    h1 {
      margin: 0 0 12px;
      font-size: 24px;
      line-height: 1.35;
    }
    .summary {
      margin: 0 0 16px;
      color: rgba(30, 45, 44, 0.65);
      line-height: 1.7;
      font-size: 15px;
    }
    .content {
      white-space: pre-wrap;
      line-height: 1.8;
      font-size: 16px;
    }
    .footer {
      margin-top: 16px;
      font-size: 13px;
      color: rgba(30, 45, 44, 0.45);
    }
    .link {
      display: inline-block;
      margin-top: 20px;
      color: #18924d;
      text-decoration: none;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <article class="card">
      <img class="cover" src="${safeImage}" alt="${safeTitle}" />
      <div class="body">
        <div class="brand">XS NOTE</div>
        <h1>${safeTitle}</h1>
        <p class="summary">${safeDescription}</p>
        <div class="content">${safeContent}</div>
        <p class="footer">公开分享 · 可在微信中转发到朋友圈</p>
        <a class="link" href="${safeAppShareUrl}">在 XS Note 中打开</a>
      </div>
    </article>
  </div>
</body>
</html>`;
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
  const token = parts[parts.length - 1];

  if (!token || token === "note-share") {
    return new Response("Not found", { status: 404 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const appOrigin = Deno.env.get("APP_ORIGIN") ?? "https://orange-186.github.io";
  const appBase = Deno.env.get("APP_BASE_PATH") ?? "/XS-Note";

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response("Server misconfigured", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await supabase.rpc("get_shared_note", { p_token: token });

  if (error || !data) {
    return new Response("Share not found", { status: 404 });
  }

  const note = data as SharedNote;
  const shareUrl = url.toString();
  const appShareUrl = `${appOrigin}${appBase}/share/${token}`;
  const fallbackCover = `${appOrigin}${appBase}/og-default.svg`;

  return new Response(renderPage(note, shareUrl, appShareUrl, fallbackCover), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
