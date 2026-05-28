import express from "express";
import { connectDB } from "../db.js";
import { runRestaurantAgent } from "../agent.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { message, userId, state } = req.body;

    if (!message) {
      return res.status(400).json({
        error: "Message is required."
      });
    }

    const db = await connectDB();

    await db.collection("chatMessages").insertOne({
      userId: userId || "guest",
      role: "user",
      message,
      createdAt: new Date()
    });

    const result = await runRestaurantAgent(message, state || {});

    await db.collection("chatMessages").insertOne({
      userId: userId || "guest",
      role: "assistant",
      message: result.reply,
      createdAt: new Date()
    });

    res.json(result);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Something went wrong."
    });
  }
});

export default router;