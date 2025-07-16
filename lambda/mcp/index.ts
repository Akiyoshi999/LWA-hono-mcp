import { Hono } from "hono";
import { handle } from "hono/aws-lambda";
import { createTool } from "@mastra/core/tools";
import { MCPServer } from "@mastra/mcp";
import { z } from "zod";

// シンプルな天気ツール（1つのツールのみ）
const weatherTool = createTool({
  id: "getWeather",
  description: "指定された都市の現在の天気情報を取得します",
  inputSchema: z.object({
    city: z.string().describe("都市名（例：Tokyo, Osaka, New York）"),
  }),
  execute: async ({ context }) => {
    // モックデータ（実際の実装では外部APIを使用）
    const mockWeatherData = {
      city: context.city,
      temperature: Math.floor(Math.random() * 30 + 10),
      condition: ["晴れ", "曇り", "雨", "雪"][Math.floor(Math.random() * 4)],
      humidity: Math.floor(Math.random() * 50 + 30),
      windSpeed: Math.floor(Math.random() * 20 + 5),
      timestamp: new Date().toISOString(),
    };

    return `🌤️ ${context.city}の天気情報
気温: ${mockWeatherData.temperature}°C
天候: ${mockWeatherData.condition}
湿度: ${mockWeatherData.humidity}%
風速: ${mockWeatherData.windSpeed} km/h
更新時刻: ${new Date(mockWeatherData.timestamp).toLocaleString("ja-JP")}`;
  },
});

// MCPサーバーの作成（シンプルな構成）
const mcpServer = new MCPServer({
  name: "Lambda Weather MCP Server",
  version: "1.0.0",
  description: "Lambda上で動作するシンプルな天気情報MCPサーバー",
  tools: {
    weatherTool,
  },
});

// Honoアプリケーションの作成
const app = new Hono();

// CORS設定（Lambda環境用）
app.use("*", async (c, next) => {
  await next();
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
});

// OPTIONSリクエストの処理
app.options("*", (c) => {
  return c.text("", 200);
});

// ルートエンドポイント
app.get("/", (c) => {
  return c.json({
    message: "Lambda Weather MCP Server",
    version: "1.0.0",
    endpoints: {
      mcp: "/mcp",
      weather: "/weather",
      health: "/health",
      tools: "/tools",
    },
    server: mcpServer.getServerInfo(),
  });
});

// ヘルスチェック
app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: process.env.AWS_LAMBDA_FUNCTION_NAME ? "lambda" : "local",
  });
});

// ツール情報
app.get("/tools", (c) => {
  const toolList = mcpServer.getToolListInfo();
  return c.json({
    tools: toolList,
    count: Object.keys(toolList).length,
  });
});

// MCPプロトコルエンドポイント
app.post("/mcp", async (c) => {
  try {
    const body = await c.req.json();
    console.log("MCP Request:", JSON.stringify(body, null, 2));

    const { method, params, id } = body;
    let response;

    switch (method) {
      case "initialize":
        response = {
          jsonrpc: "2.0",
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: "Lambda Weather MCP Server",
              version: "1.0.0",
            },
          },
          id,
        };
        break;

      case "initialized":
        response = {
          jsonrpc: "2.0",
          result: {},
          id,
        };
        break;

      case "tools/list":
        response = {
          jsonrpc: "2.0",
          result: {
            tools: [
              {
                name: "getWeather",
                description: "指定された都市の現在の天気情報を取得します",
                inputSchema: {
                  type: "object",
                  properties: {
                    city: {
                      type: "string",
                      description: "都市名（例：Tokyo, Osaka, New York）",
                    },
                  },
                  required: ["city"],
                },
              },
            ],
          },
          id,
        };
        break;

      case "tools/call":
        const { name, arguments: args } = params;
        if (name === "getWeather") {
          const result = await weatherTool.execute({ context: args });
          response = {
            jsonrpc: "2.0",
            result: {
              content: [
                {
                  type: "text",
                  text: result,
                },
              ],
            },
            id,
          };
        } else {
          response = {
            jsonrpc: "2.0",
            error: {
              code: -32601,
              message: `Unknown tool: ${name}`,
            },
            id,
          };
        }
        break;

      default:
        response = {
          jsonrpc: "2.0",
          error: {
            code: -32601,
            message: `Method not found: ${method}`,
          },
          id,
        };
    }

    console.log("MCP Response:", JSON.stringify(response, null, 2));
    return c.json(response);
  } catch (error) {
    console.error("MCP Protocol error:", error);
    return c.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal error",
          data: error instanceof Error ? error.message : "Unknown error",
        },
        id: null,
      },
      500
    );
  }
});

// MCPプロトコル用のGETエンドポイント（初期化用）
app.get("/mcp", (c) => {
  return c.json({
    jsonrpc: "2.0",
    result: {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {},
      },
      serverInfo: {
        name: "Lambda Weather MCP Server",
        version: "1.0.0",
      },
    },
  });
});

// 天気ツールの直接実行エンドポイント
app.post("/weather", async (c) => {
  try {
    const body = await c.req.json();
    const { city } = body;

    if (!city) {
      return c.json({ error: "City parameter is required" }, 400);
    }

    // 天気データを直接生成（ツールを使わずに）
    const mockWeatherData = {
      city: city,
      temperature: Math.floor(Math.random() * 30 + 10),
      condition: ["晴れ", "曇り", "雨", "雪"][Math.floor(Math.random() * 4)],
      humidity: Math.floor(Math.random() * 50 + 30),
      windSpeed: Math.floor(Math.random() * 20 + 5),
      timestamp: new Date().toISOString(),
    };

    const result = `🌤️ ${city}の天気情報
気温: ${mockWeatherData.temperature}°C
天候: ${mockWeatherData.condition}
湿度: ${mockWeatherData.humidity}%
風速: ${mockWeatherData.windSpeed} km/h
更新時刻: ${new Date(mockWeatherData.timestamp).toLocaleString("ja-JP")}`;

    return c.json({
      tool: "getWeather",
      input: { city },
      result: result,
      data: mockWeatherData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Weather tool error:", error);
    return c.json(
      {
        error: "Failed to get weather information",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

// エラーハンドリング
app.onError((err, c) => {
  console.error("Server error:", err);
  return c.json(
    {
      error: "Internal Server Error",
      message: err.message,
    },
    500
  );
});

// 404ハンドリング
app.notFound((c) => {
  return c.json(
    {
      error: "Not Found",
      message: "The requested endpoint was not found",
      availableEndpoints: ["/", "/health", "/tools", "/weather", "/mcp"],
    },
    404
  );
});

// Lambda Web Adapter用のHTTPサーバー起動
import { serve } from "@hono/node-server";

// Lambda Web Adapter がプロキシするローカル HTTP サーバ起動
const port = Number(process.env.AWS_LWA_PORT || 8080);
console.log(`Starting HTTP server on port ${port}`);
console.log(
  `Environment: ${process.env.AWS_LAMBDA_FUNCTION_NAME ? "lambda" : "local"}`
);
console.log(`AWS_LWA_ENABLE: ${process.env.AWS_LWA_ENABLE}`);

serve({
  fetch: app.fetch,
  port: port,
});

// ローカル開発用のエクスポート
export { app, mcpServer };
