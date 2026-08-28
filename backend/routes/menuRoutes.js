import express from "express";
import { getMenu } from "../tools.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const menu = await getMenu();
    res.json(menu);
  } catch (error) {
    console.error("Menu route error:", error);
    res.status(500).json({ error: "Could not load menu." });
  }
});

export default router;