import { Hono } from "hono";
import { serve } from "@hono/node-server";

// ── ルーティング ────────────────────────────────
const app = new Hono();

app.get("/", (c) => c.text("Hello from Hono + Lambda Web Adapter 🎉"));
app.get("/time", (c) => c.text(new Date().toISOString()));
// 大きなレスポンステスト用
app.get("/test/large", (c) => {
  const largeText = "A".repeat(1024 * 1024); // 1MB のテキスト
  return c.text(largeText);
});

// ── Lambda Web Adapter がプロキシするローカル HTTP サーバ起動 ──
serve({
  fetch: app.fetch,
  port: Number(process.env.AWS_LWA_PORT || 8080),
});

// 「ハンドラー」は中身なしで OK（Zip/package 型の場合）
export const handler = async (): Promise<void> => {};
