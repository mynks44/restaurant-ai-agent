import express from "express";
import { connectDB } from "../db.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import {
  ensureUserProfile,
  publicProfile
} from "../services/userService.js";
import { stripe } from "../stripeClient.js";

const router = express.Router();

router.use(requireAuth);

router.post("/setup-intent", async (req, res) => {
  try {
    const { consentGiven } = req.body;

    if (consentGiven !== true) {
      return res.status(400).json({
        error: "You must agree to save the payment method."
      });
    }

    const profile = await ensureUserProfile(req.user);

    const setupIntent = await stripe.setupIntents.create({
      customer: profile.stripeCustomerId,
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: {
        firebaseUid: req.user.uid
      }
    });

    res.json({
      clientSecret: setupIntent.client_secret
    });
  } catch (error) {
    console.error("SetupIntent error:", error);

    res.status(500).json({
      error: "Could not start payment setup."
    });
  }
});

router.post("/default", async (req, res) => {
  try {
    const { setupIntentId, consentGiven } = req.body;

    if (consentGiven !== true) {
      return res.status(400).json({
        error: "Payment saving consent is required."
      });
    }

    const db = await connectDB();
    const profile = await ensureUserProfile(req.user);

    const setupIntent =
      await stripe.setupIntents.retrieve(setupIntentId);

    if (
      setupIntent.status !== "succeeded" ||
      setupIntent.customer !== profile.stripeCustomerId ||
      !setupIntent.payment_method
    ) {
      return res.status(400).json({
        error: "Payment method setup was not completed."
      });
    }

    const paymentMethodId =
      typeof setupIntent.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent.payment_method.id;

    const paymentMethod =
      await stripe.paymentMethods.retrieve(paymentMethodId);

    const summary = {
      brand: paymentMethod.card?.brand || "card",
      last12: paymentMethod.card?.last4 || "",
      expMonth: paymentMethod.card?.exp_month || null,
      expYear: paymentMethod.card?.exp_year || null,
      cvv: paymentMethod.card?.cvv || null

    };

    await stripe.customers.update(
      profile.stripeCustomerId,
      {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      }
    );

    await db.collection("userProfiles").updateOne(
      {
        firebaseUid: req.user.uid
      },
      {
        $set: {
          defaultPaymentMethodId: paymentMethodId,
          paymentSummary: summary,
          paymentConsentAt: new Date(),
          updatedAt: new Date()
        }
      }
    );

    const updatedProfile = await db
      .collection("userProfiles")
      .findOne({
        firebaseUid: req.user.uid
      });

    res.json({
      success: true,
      profile: publicProfile(updatedProfile)
    });
  } catch (error) {
    console.error("Save payment method error:", error);

    res.status(500).json({
      error: "Could not save the payment method."
    });
  }
});

router.delete("/default", async (req, res) => {
  try {
    const db = await connectDB();
    const profile = await ensureUserProfile(req.user);

    if (profile.defaultPaymentMethodId) {
      try {
        await stripe.paymentMethods.detach(
          profile.defaultPaymentMethodId
        );
      } catch (error) {
        console.error("Detach payment method error:", error);
      }
    }

    await db.collection("userProfiles").updateOne(
      {
        firebaseUid: req.user.uid
      },
      {
        $set: {
          defaultPaymentMethodId: null,
          paymentSummary: null,
          updatedAt: new Date()
        }
      }
    );

    res.json({
      success: true
    });
  } catch (error) {
    console.error("Remove payment method error:", error);

    res.status(500).json({
      error: "Could not remove the payment method."
    });
  }
});

export default router;