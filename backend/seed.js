import dotenv from "dotenv";
import { connectDB } from "./db.js";

dotenv.config();

async function seedDatabase() {
  const db = await connectDB();

  await db.collection("menu").deleteMany({});
  await db.collection("toppings").deleteMany({});
  await db.collection("orders").deleteMany({});
  await db.collection("chatMessages").deleteMany({});

  await db.collection("menu").insertMany([
    {
      type: "pizza",
      size: "small",
      name: "Small Pizza",
      price: 9.99,
      available: true
    },
    {
      type: "pizza",
      size: "medium",
      name: "Medium Pizza",
      price: 12.99,
      available: true
    },
    {
      type: "pizza",
      size: "large",
      name: "Large Pizza",
      price: 15.99,
      available: true
    }
  ]);

  await db.collection("toppings").insertMany([
    {
      name: "pepperoni",
      price: 2.0,
      available: true
    },
    {
      name: "extra cheese",
      price: 2.0,
      available: true
    },
    {
      name: "mushrooms",
      price: 1.5,
      available: true
    },
    {
      name: "olives",
      price: 1.5,
      available: true
    }
  ]);

  console.log("Database seeded successfully");
  process.exit();
}

seedDatabase().catch((error) => {
  console.error(error);
  process.exit(1);
});