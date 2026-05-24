import { Router, type Request, type Response } from "express";
import { getLog } from "../lib/activityLog";

const ADMIN_KEY = "eonmaster6767";

const router = Router();

router.get("/admin", (req: Request, res: Response) => {
  if (req.query["key"] !== ADMIN_KEY) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  res.json({ log: getLog() });
});

export default router;
