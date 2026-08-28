import dotenv from "dotenv";
import { connectDB } from "./db.js";

dotenv.config();

async function seedDatabase() {
  const db = await connectDB();

  await db.collection("menu").deleteMany({});
  await db.collection("toppings").deleteMany({});
  await db.collection("crusts").deleteMany({});
  await db.collection("sauces").deleteMany({});
  await db.collection("sides").deleteMany({});
  await db.collection("drinks").deleteMany({});
  await db.collection("dips").deleteMany({});
  await db.collection("orders").deleteMany({});
  await db.collection("chatMessages").deleteMany({});

  await db.collection("menu").insertMany([
    {
      type: "pizza",
      category: "size",
      size: "small",
      name: "Small Pizza",
      price: 9.99,
      available: true
    },
    {
      type: "pizza",
      category: "size",
      size: "medium",
      name: "Medium Pizza",
      price: 12.99,
      available: true
    },
    {
      type: "pizza",
      category: "size",
      size: "large",
      name: "Large Pizza",
      price: 15.99,
      available: true
    },
    {
      type: "pizza",
      category: "size",
      size: "x-large",
      name: "X-Large Pizza",
      price: 18.99,
      available: true
    }
  ]);

  await db.collection("toppings").insertMany([
    { name: "pepperoni", displayName: "Pepperoni", price: 2.0, available: true },
    { name: "extra cheese", displayName: "Extra Cheese", price: 2.0, available: true },
    { name: "mushrooms", displayName: "Mushrooms", price: 1.5, available: true },
    { name: "green peppers", displayName: "Green Peppers", price: 1.5, available: true },
    { name: "red onions", displayName: "Red Onions", price: 1.5, available: true },
    { name: "black olives", displayName: "Black Olives", price: 1.5, available: true },
    { name: "pineapple", displayName: "Pineapple", price: 1.5, available: true },
    { name: "jalapenos", displayName: "Jalapeños", price: 1.5, available: true },
    { name: "chicken", displayName: "Grilled Chicken", price: 2.5, available: true },
    { name: "bacon", displayName: "Bacon", price: 2.5, available: true },
    { name: "sausage", displayName: "Italian Sausage", price: 2.25, available: true },
    { name: "tomatoes", displayName: "Tomatoes", price: 1.5, available: true },
    { name: "spinach", displayName: "Spinach", price: 1.5, available: true },
    { name: "hot peppers", displayName: "Hot Peppers", price: 1.5, available: true }
  ]);

  await db.collection("crusts").insertMany([
    { name: "regular", displayName: "Regular Crust", price: 0, available: true },
    { name: "thin", displayName: "Thin Crust", price: 0, available: true },
    { name: "thick", displayName: "Thick Crust", price: 1.5, available: true },
    { name: "stuffed", displayName: "Stuffed Crust", price: 3.0, available: true }
  ]);

  await db.collection("sauces").insertMany([
    { name: "tomato", displayName: "Classic Tomato Sauce", price: 0, available: true },
    { name: "bbq", displayName: "BBQ Sauce", price: 0, available: true },
    { name: "creamy garlic", displayName: "Creamy Garlic Sauce", price: 0, available: true },
    { name: "buffalo", displayName: "Spicy Buffalo Sauce", price: 0, available: true }
  ]);

  await db.collection("sides").insertMany([
    { name: "garlic bread", displayName: "Garlic Bread", price: 5.99, available: true },
    { name: "potato wedges", displayName: "Potato Wedges", price: 6.49, available: true },
    { name: "chicken wings", displayName: "Chicken Wings", price: 11.99, available: true },
    { name: "caesar salad", displayName: "Caesar Salad", price: 7.99, available: true }
  ]);

  await db.collection("drinks").insertMany([
    { name: "coke", displayName: "Coke", price: 2.49, available: true },
    { name: "diet coke", displayName: "Diet Coke", price: 2.49, available: true },
    { name: "sprite", displayName: "Sprite", price: 2.49, available: true },
    { name: "water", displayName: "Water", price: 1.99, available: true }
  ]);

  await db.collection("dips").insertMany([
    { name: "creamy garlic dip", displayName: "Creamy Garlic Dip", price: 1.25, available: true },
    { name: "ranch dip", displayName: "Ranch Dip", price: 1.25, available: true },
    { name: "marinara dip", displayName: "Marinara Dip", price: 1.25, available: true },
    { name: "cheddar jalapeno dip", displayName: "Cheddar Jalapeño Dip", price: 1.25, available: true }
  ]);

  console.log("Professional demo menu seeded successfully.");
  process.exit();
}

seedDatabase().catch((error) => {
  console.error(error);
  process.exit(1);
});