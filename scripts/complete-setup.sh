#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT_REF="${SUPABASE_PROJECT_REF:-yxtufscthzalvcbpxwvn}"
APP_ORIGIN="${APP_ORIGIN:-https://xs-note.vercel.app}"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

require() {
  if [[ -z "${!1:-}" ]]; then
    echo "缺少环境变量: $1" >&2
    exit 1
  fi
}

echo "==> 1/3 配置 Supabase Auth URL"
if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  curl -fsS -X PATCH "https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$(node -e "
      console.log(JSON.stringify({
        site_url: '${APP_ORIGIN}',
        uri_allow_list: '${APP_ORIGIN}/**,http://localhost:5173/**'
      }))
    ")" >/dev/null
  echo "    Auth Site URL / Redirect URLs 已更新"
else
  echo "    跳过（未设置 SUPABASE_ACCESS_TOKEN）"
  echo "    手动打开: https://supabase.com/dashboard/project/${PROJECT_REF}/auth/url-configuration"
fi

echo "==> 2/3 部署 note-share Edge Function"
if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  require SUPABASE_ACCESS_TOKEN
  supabase secrets set APP_ORIGIN="${APP_ORIGIN}" APP_BASE_PATH="" --project-ref "${PROJECT_REF}"
  supabase functions deploy note-share --no-verify-jwt --project-ref "${PROJECT_REF}"
  echo "    Edge Function 已部署"
else
  echo "    跳过（未设置 SUPABASE_ACCESS_TOKEN）"
fi

echo "==> 3/3 部署到 Vercel"
if [[ -n "${VERCEL_TOKEN:-}" ]]; then
  npx vercel deploy --prod --yes --token "${VERCEL_TOKEN}" \
    --env "VITE_SUPABASE_URL=${VITE_SUPABASE_URL}" \
    --env "VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}"
  echo "    Vercel 部署完成"
else
  echo "    跳过（未设置 VERCEL_TOKEN）"
  echo "    或访问 https://vercel.com/new 导入 GitHub 仓库 Orange-186/XS-Note"
fi

echo
echo "完成。线上地址: ${APP_ORIGIN}/"
