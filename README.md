# ShadowNote

移动端优先的个人笔记 Web 应用，支持云端同步、媒体附件、导出分享图。

## 技术栈

- React + Vite + TypeScript
- Supabase（邮箱密码登录、PostgreSQL、Storage）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 Supabase

1. 在 [Supabase](https://supabase.com) 创建项目
2. 打开 **Project Settings → API**，复制：
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`
3. 在 **SQL Editor** 中执行 `supabase/schema.sql`
4. 在 **Authentication → Providers** 中启用 **Email**
5. （推荐 MVP）在 **Authentication → Providers → Email** 中关闭 **Confirm email**，注册后可直接登录
6. 复制 `.env.example` 为 `.env`，填入真实值：

```env
VITE_SUPABASE_URL=https://你的项目ID.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

7. **保存 `.env` 后必须重启**开发服务器（`Ctrl+C` 后重新 `npm run dev`）

> 若登录按钮显示「请先配置 Supabase」，说明 `.env` 未创建、未填完整，或 dev 服务器未重启。

### 3. 启动开发服务器

```bash
npm run dev
```

浏览器访问 `http://localhost:5173`

## 功能（MVP）

- 邮箱 + 密码注册/登录
- 笔记列表（标题、摘要、时间、封面）
- 创建 / 编辑 / 自动保存
- 图片 ≤10 张、视频 ≤5 个
- 左滑删除、全部删除（二次确认）
- 导出笔记为 PNG 图片
- 白天 / 夜间模式
- 移动端优先，适配平板与桌面

## 构建

```bash
npm run build
npm run preview
```
