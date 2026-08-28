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

router.get("/", async (req, res) => {
  try {
    const profile = await ensureUserProfile(req.user);
    res.json(publicProfile(profile));
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      error: "Could not load your profile."
    });
  }
});

router.put("/", async (req, res) => {
  try {
    const db = await connectDB();
    const currentProfile = await ensureUserProfile(req.user);

    const fullName = String(req.body.fullName || "").trim();
    const phone = String(req.body.phone || "").trim();

    const address = {
      line1: String(req.body.address?.line1 || "").trim(),
      line2: String(req.body.address?.line2 || "").trim(),
      city: String(req.body.address?.city || "").trim(),
      province: String(req.body.address?.province || "").trim(),
      postalCode: String(req.body.address?.postalCode || "")
        .trim()
        .toUpperCase(),
      country: String(req.body.address?.country || "CA")
        .trim()
        .toUpperCase(),
      deliveryInstructions: String(
        req.body.address?.deliveryInstructions || ""
      ).trim()
    };

    if (!fullName) {
      return res.status(400).json({
        error: "Full name is required."
      });
    }

    await db.collection("userProfiles").updateOne(
      {
        firebaseUid: req.user.uid
      },
      {
        $set: {
          email: req.user.email || currentProfile.email || "",
          fullName,
          phone,
          address,
          updatedAt: new Date()
        }
      }
    );

    await stripe.customers.update(
      currentProfile.stripeCustomerId,
      {
        name: fullName,
        email: req.user.email || undefined,
        phone: phone || undefined,
        address: address.line1
          ? {
              line1: address.line1,
              line2: address.line2 || undefined,
              city: address.city,
              state: address.province,
              postal_code: address.postalCode,
              country: address.country
            }
          : undefined
      }
    );

    const updatedProfile = await db
      .collection("userProfiles")
      .findOne({
        firebaseUid: req.user.uid
      });

    res.json(publicProfile(updatedProfile));
  } catch (error) {
    console.error("Update profile error:", error);

    res.status(500).json({
      error: "Could not update your profile."
    });
  }
});

export default router;