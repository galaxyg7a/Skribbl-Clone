import { Router, type IRouter, type Request, type Response } from "express";
import healthRouter from "./health";

const router: IRouter = Router();

router.use(healthRouter);

router.post("/debug", (req: Request, res: Response) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    console.log("JS_DEBUG:", body);
    res.sendStatus(200);
  });
});

router.post("/play", (req: Request, res: Response) => {
  // Use X-Forwarded-Proto to detect actual protocol (works behind Replit/Railway proxies)
  const proto = (req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0].trim();
  const host = req.get("x-forwarded-host") || req.get("host") || "localhost";
  const origin = proto + "://" + host;
  res.type("text/plain").send(origin);
});

export default router;
