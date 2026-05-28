import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";
import { logActivity } from "./lib/activityLog";

function getClientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return String(fwd).split(",")[0].trim();
  return req.socket?.remoteAddress ?? "unknown";
}

const app: Express = express();

app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.method === "GET" && (req.path === "/" || req.path === "/index.html")) {
    void logActivity(getClientIp(req), "visitor", "page_visit", req.headers["user-agent"] ?? "");
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
