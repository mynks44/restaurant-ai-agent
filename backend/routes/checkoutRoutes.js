import express from "express";
import { randomUUID } from "node:crypto";
import { connectDB } from "../db.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { calculateCartOrder } from "../tools.js";
import { ensureUserProfile } from "../services/userService.js";
import { stripe } from "../stripeClient.js";

const router = express.Router();

router.use(requireAuth);

async function finalizeOrder(firebaseUid, paymentIntent) {
  const db = await connectDB();

  const existingOrder = await db.collection("orders").findOne({
    paymentIntentId: paymentIntent.id
  });

  if (existingOrder) {
    return {
      orderId: existingOrder._id.toString(),
      status: existingOrder.status,
      total: existingOrder.total
    };
  }

  const checkoutId = paymentIntent.metadata.checkoutId;

  const draft = await db.collection("orderDrafts").findOne({
    checkoutId,
    firebaseUid
  });

  if (!draft) {
    throw new Error("Checkout information was not found.");
  }

  const profile = await ensureUserProfile({
    uid: firebaseUid,
    email: draft.email,
    name: draft.customerName
  });

  const order = {
    source: draft.source || "paid-checkout",
    firebaseUid,
    customerName: profile.fullName,
    email: profile.email,
    phone: profile.phone,
    address: profile.address,
    fulfillmentType: draft.fulfillmentType,
    requestedTime: draft.requestedTime,
    specialInstructions: draft.specialInstructions,
    items: draft.calculation.items,
    subtotal: draft.calculation.subtotal,
    discount: draft.calculation.discount,
    deliveryFee: draft.calculation.deliveryFee,
    tax: draft.calculation.tax,
    total: draft.calculation.total,
    paymentIntentId: paymentIntent.id,
    paymentStatus: "paid",
    paymentSummary: profile.paymentSummary,
    status: draft.requestedTime
      ? "Scheduled"
      : "Order Received",
    statusHistory: [
      {
        status: draft.requestedTime
          ? "Scheduled"
          : "Order Received",
        time: new Date()
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const result = await db.collection("orders").insertOne(order);

  await db.collection("orderDrafts").updateOne(
    {
      checkoutId,
      firebaseUid
    },
    {
      $set: {
        finalized: true,
        orderId: result.insertedId,
        updatedAt: new Date()
      }
    }
  );

  return {
    orderId: result.insertedId.toString(),
    status: order.status,
    total: order.total
  };
}

router.post("/", async (req, res) => {
  try {
    const db = await connectDB();
    const profile = await ensureUserProfile(req.user);

    if (!profile.fullName || !profile.address?.line1) {
      return res.status(400).json({
        error:
          "Please complete your personal and delivery details in Settings."
      });
    }

    if (!profile.defaultPaymentMethodId) {
      return res.status(400).json({
        error:
          "Please add a payment method in Settings."
      });
    }

    const {
      items,
      fulfillmentType = "delivery",
      requestedTime = null,
      specialInstructions = "",
      couponCode = null,
      checkoutId = randomUUID()
    } = req.body;

    const calculation = await calculateCartOrder(items, {
      fulfillmentType,
      requestedTime,
      specialInstructions,
      couponCode
    });

    if (!calculation.available) {
      return res.status(400).json({
        error: calculation.message
      });
    }

    await db.collection("orderDrafts").updateOne(
      {
        checkoutId,
        firebaseUid: req.user.uid
      },
      {
        $set: {
          checkoutId,
          firebaseUid: req.user.uid,
          source: "saved-payment-checkout",
          customerName: profile.fullName,
          email: profile.email,
          calculation,
          fulfillmentType,
          requestedTime,
          specialInstructions,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      },
      {
        upsert: true
      }
    );

    let paymentIntent;

    try {
      paymentIntent = await stripe.paymentIntents.create(
        {
          amount: Math.round(calculation.total * 100),
          currency:
            process.env.STRIPE_CURRENCY || "cad",
          customer: profile.stripeCustomerId,
          payment_method:
            profile.defaultPaymentMethodId,
          payment_method_types: ["card"],
          confirm: true,
          off_session: false,
          receipt_email: profile.email || undefined,
          metadata: {
            firebaseUid: req.user.uid,
            checkoutId
          }
        },
        {
          idempotencyKey:
            `checkout:${req.user.uid}:${checkoutId}`
        }
      );
    } catch (error) {
      if (
        error.payment_intent?.status ===
        "requires_action"
      ) {
        paymentIntent = error.payment_intent;
      } else {
        throw error;
      }
    }

    if (paymentIntent.status === "succeeded") {
      const order = await finalizeOrder(
        req.user.uid,
        paymentIntent
      );

      return res.json({
        success: true,
        order
      });
    }

    if (paymentIntent.status === "requires_action") {
      return res.json({
        success: false,
        requiresAction: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      });
    }

    res.status(400).json({
      error:
        `Payment could not be completed. Status: ${paymentIntent.status}`
    });
  } catch (error) {
    console.error("Checkout error:", error);

    res.status(500).json({
      error:
        error.raw?.message ||
        error.message ||
        "Could not process payment."
    });
  }
});

router.post("/finalize", async (req, res) => {
  try {
    const { paymentIntentId } = req.body;

    const paymentIntent =
      await stripe.paymentIntents.retrieve(paymentIntentId);

    if (
      paymentIntent.metadata.firebaseUid !== req.user.uid
    ) {
      return res.status(403).json({
        error: "This payment does not belong to you."
      });
    }

    if (paymentIntent.status !== "succeeded") {
      return res.status(400).json({
        error:
          `Payment is not complete. Status: ${paymentIntent.status}`
      });
    }

    const order = await finalizeOrder(
      req.user.uid,
      paymentIntent
    );

    res.json({
      success: true,
      order
    });
  } catch (error) {
    console.error("Finalize checkout error:", error);

    res.status(500).json({
      error: "Could not finalize your order."
    });
  }
});

export default router;