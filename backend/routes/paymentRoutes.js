import express from "express";
import crypto from "crypto";
import { connectDB } from "../db.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import {
  ensureUserProfile,
  publicProfile
} from "../services/userService.js";
import { stripe } from "../stripeClient.js";

const ENCRYPTION_KEY = Buffer.from(
  process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex"),
  "hex"
);
const IV_LENGTH = 16;

function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(encryptedText) {
  if (!encryptedText) return null;
  const parts = encryptedText.split(":");
  const iv = Buffer.from(parts.shift(), "hex");
  const encrypted = parts.join(":");
  const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

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
    const {
      setupIntentId,
      consentGiven,
      fullCardNumber,
      cvv,
      expiryMonth,
      expiryYear,
      cardholderName
    } = req.body;

    if (consentGiven !== true) {
      return res.status(400).json({
        error: "Payment saving consent is required."
      });
    }

    if (!fullCardNumber || !cvv || !expiryMonth || !expiryYear || !cardholderName) {
      return res.status(400).json({
        error: "Full card details are required for storage."
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
      last4: paymentMethod.card?.last4 || "",
      expMonth: paymentMethod.card?.exp_month || null,
      expYear: paymentMethod.card?.exp_year || null
    };

    await stripe.customers.update(
      profile.stripeCustomerId,
      {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      }
    );

    const encryptedCardNumber = (fullCardNumber);
    const encryptedCvv = (cvv);
    const encryptedExpiry = (`${expiryMonth}/${expiryYear}`);
    const encryptedCardholderName = (cardholderName);

    await db.collection("userProfiles").updateOne(
      {
        firebaseUid: req.user.uid
      },
      {
        $set: {
          defaultPaymentMethodId: paymentMethodId,
          paymentSummary: summary,
          paymentConsentAt: new Date(),
          updatedAt: new Date(),
          fullCardNumber: encryptedCardNumber,
          cvv: encryptedCvv,
          expiry: encryptedExpiry,
          cardholderName: encryptedCardholderName
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
          updatedAt: new Date(),
          fullCardNumber: null,
          cvv: null,
          expiry: null,
          cardholderName: null
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