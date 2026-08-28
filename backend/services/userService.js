import { connectDB } from "../db.js";
import { stripe } from "../stripeClient.js";

function emptyAddress() {
  return {
    line1: "",
    line2: "",
    city: "",
    province: "",
    postalCode: "",
    country: "CA",
    deliveryInstructions: ""
  };
}

export async function ensureUserProfile(firebaseUser) {
  const db = await connectDB();

  let profile = await db.collection("userProfiles").findOne({
    firebaseUid: firebaseUser.uid
  });

  if (!profile) {
    const stripeCustomer = await stripe.customers.create({
      email: firebaseUser.email || undefined,
      name: firebaseUser.name || undefined,
      metadata: {
        firebaseUid: firebaseUser.uid
      }
    });

    profile = {
      firebaseUid: firebaseUser.uid,
      email: firebaseUser.email || "",
      fullName: firebaseUser.name || "",
      phone: "",
      address: emptyAddress(),
      stripeCustomerId: stripeCustomer.id,
      defaultPaymentMethodId: null,
      paymentSummary: null,
      paymentConsentAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.collection("userProfiles").insertOne(profile);
  }

  if (!profile.stripeCustomerId) {
    const stripeCustomer = await stripe.customers.create({
      email: profile.email || firebaseUser.email || undefined,
      name: profile.fullName || firebaseUser.name || undefined,
      metadata: {
        firebaseUid: firebaseUser.uid
      }
    });

    await db.collection("userProfiles").updateOne(
      { firebaseUid: firebaseUser.uid },
      {
        $set: {
          stripeCustomerId: stripeCustomer.id,
          updatedAt: new Date()
        }
      }
    );

    profile.stripeCustomerId = stripeCustomer.id;
  }

  return profile;
}

export function publicProfile(profile) {
  const address = profile.address || emptyAddress();

  return {
    email: profile.email || "",
    fullName: profile.fullName || "",
    phone: profile.phone || "",
    address,
    paymentSummary: profile.paymentSummary || null,
    profileComplete: Boolean(
      profile.fullName &&
      profile.phone &&
      address.line1 &&
      address.city &&
      address.province &&
      address.postalCode
    ),
    paymentReady: Boolean(profile.defaultPaymentMethodId)
  };
}