import { ObjectId } from "mongodb";
import { connectDB } from "./db.js";

function normalizeText(value) {
  return value.toLowerCase().trim();
}

export async function getMenu() {
  const db = await connectDB();

  const pizzas = await db.collection("menu").find({
    available: true
  }).toArray();

  const toppings = await db.collection("toppings").find({
    available: true
  }).toArray();

  return {
    pizzas,
    toppings
  };
}

export async function calculatePizzaPrice(size, toppings = []) {
  const db = await connectDB();

  const pizza = await db.collection("menu").findOne({
    type: "pizza",
    size: normalizeText(size),
    available: true
  });

  if (!pizza) {
    return {
      available: false,
      message: `Sorry, ${size} pizza is not available.`
    };
  }

  const normalizedToppings = toppings.map(normalizeText);

  const toppingDocs = await db.collection("toppings").find({
    name: { $in: normalizedToppings },
    available: true
  }).toArray();

  const foundToppingNames = toppingDocs.map((item) => item.name);

  const missingToppings = normalizedToppings.filter(
    (item) => !foundToppingNames.includes(item)
  );

  if (missingToppings.length > 0) {
    return {
      available: false,
      message: `Sorry, these toppings are not available: ${missingToppings.join(", ")}.`
    };
  }

  const toppingsTotal = toppingDocs.reduce((sum, item) => {
    return sum + item.price;
  }, 0);

  const subtotal = pizza.price + toppingsTotal;
  const tax = Number((subtotal * 0.13).toFixed(2));
  const total = Number((subtotal + tax).toFixed(2));

  return {
    available: true,
    pizza,
    toppings: toppingDocs,
    subtotal,
    tax,
    total
  };
}

export async function createOrder(orderData) {
  const db = await connectDB();

  const order = {
    item: orderData.item,
    size: orderData.size,
    toppings: orderData.toppings || [],
    subtotal: orderData.subtotal,
    tax: orderData.tax,
    total: orderData.total,
    status: "Order Received",
    customerName: "Guest",
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const result = await db.collection("orders").insertOne(order);

  return {
    success: true,
    orderId: result.insertedId.toString(),
    status: order.status,
    total: order.total
  };
}

export async function getOrderStatus(orderId) {
  const db = await connectDB();

  if (!ObjectId.isValid(orderId)) {
    return {
      found: false,
      message: "Invalid order ID."
    };
  }

  const order = await db.collection("orders").findOne({
    _id: new ObjectId(orderId)
  });

  if (!order) {
    return {
      found: false,
      message: "Order not found."
    };
  }

  return {
    found: true,
    orderId,
    status: order.status,
    total: order.total,
    item: order.item,
    size: order.size,
    toppings: order.toppings
  };
}