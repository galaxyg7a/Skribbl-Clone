import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";
import { logActivity } from "./lib/activityLog";

function getClientIp(req: Request): string {
  // cf-connecting-ip is set by Cloudflare (used by Replit's proxy)
  const cf = req.headers["cf-connecting-ip"];
  if (cf) return String(cf).trim();
  // x-forwarded-for: first IP in the chain is the real client
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return String(fwd).split(",")[0].trim();
  // x-real-ip: set by nginx and some other proxies
  const real = req.headers["x-real-ip"];
  if (real) return String(real).trim();
  // Express req.ip respects trust proxy setting
  if (req.ip && req.ip !== "::1" && req.ip !== "127.0.0.1") return req.ip;
  return req.socket?.remoteAddress ?? "unknown";
}

function ipDebugDetail(req: Request): string {
  const parts: string[] = [];
  const ua = req.headers["user-agent"] ?? "";
  parts.push(`ua=${ua}`);
  const cf = req.headers["cf-connecting-ip"];
  if (cf) parts.push(`cf=${cf}`);
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) parts.push(`xff=${fwd}`);
  const real = req.headers["x-real-ip"];
  if (real) parts.push(`xri=${real}`);
  parts.push(`sock=${req.socket?.remoteAddress ?? "?"}`);
  return parts.join(" | ");
}

const app: Express = express();
app.set("trust proxy", true);

app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.method === "GET" && (req.path === "/" || req.path === "/index.html")) {
    void logActivity(getClientIp(req), "visitor", "page_visit", ipDebugDetail(req));
  }
  next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const publicDir = path.resolve(globalThis.__dirname ?? import.meta.dirname ?? ".", "public");
app.use(express.static(publicDir));

app.use("/api", router);

export default app;
