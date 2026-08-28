import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is missing.");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);