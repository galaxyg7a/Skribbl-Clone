import { Router, type Request, type Response } from "express";
import { getLog } from "../lib/activityLog";

const ADMIN_KEY = "eonmaster6767";

const router = Router();

router.get("/admin", async (req: Request, res: Response) => {
  if (req.query["key"] !== ADMIN_KEY) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const log = await getLog();
  res.json({ log });
});

export default router;
