import express from "express";
import { ObjectId } from "mongodb";
import { connectDB } from "../db.js";

const router = express.Router();

router.get("/:id", async (req, res) => {
  try {
    const db = await connectDB();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        error: "Invalid order ID."
      });
    }

    const order = await db.collection("orders").findOne({
      _id: new ObjectId(id)
    });

    if (!order) {
      return res.status(404).json({
        error: "Order not found."
      });
    }

    res.json(order);
  } catch {
    res.status(500).json({
      error: "Could not get order."
    });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const db = await connectDB();
    const { id } = req.params;
    const { status } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        error: "Invalid order ID."
      });
    }

    await db.collection("orders").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status,
          updatedAt: new Date()
        }
      }
    );

    res.json({
      success: true,
      message: "Order status updated."
    });
  } catch {
    res.status(500).json({
      error: "Could not update status."
    });
  }
});

export default router;