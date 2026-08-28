import express from "express";
import { ObjectId } from "mongodb";
import { connectDB } from "../db.js";
import {
  cancelOrder,
  createOrder,
  getOrderStatus
} from "../tools.js";

const router = express.Router();

router.get("/:id", async (req, res) => {
  try {
    const statusResult = await getOrderStatus(req.params.id);

    if (!statusResult.found) {
      return res.status(404).json({ error: statusResult.message });
    }

    res.json(statusResult);
  } catch (error) {
    console.error("Get order error:", error);
    res.status(500).json({ error: "Could not get order." });
  }
});

router.post("/manual", async (req, res) => {
  try {
    const { items, fulfillmentType, requestedTime, specialInstructions, couponCode } = req.body;

    const orderResult = await createOrder({
      source: "manual-ui",
      items,
      fulfillmentType: fulfillmentType || "pickup",
      requestedTime: requestedTime || null,
      specialInstructions: specialInstructions || "",
      couponCode: couponCode || null,
      customerName: "Guest Demo User"
    });

    if (!orderResult.success) {
      return res.status(400).json({ error: orderResult.message });
    }

    res.status(201).json(orderResult);
  } catch (error) {
    console.error("Manual order error:", error);
    res.status(500).json({ error: "Could not place manual order." });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const db = await connectDB();
    const { id } = req.params;
    const { status } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid order ID." });
    }

    await db.collection("orders").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status,
          updatedAt: new Date()
        },
        $push: {
          statusHistory: {
            status,
            time: new Date()
          }
        }
      }
    );

    res.json({
      success: true,
      message: "Order status updated."
    });
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({ error: "Could not update status." });
  }
});

router.patch("/:id/cancel", async (req, res) => {
  try {
    const result = await cancelOrder(req.params.id);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json(result);
  } catch (error) {
    console.error("Cancel order error:", error);
    res.status(500).json({ error: "Could not cancel order." });
  }
});

export default router;