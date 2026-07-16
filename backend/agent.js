import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import {
  calculatePizzaPrice,
  createOrder,
  getMenu,
  getOrderStatus
} from "./tools.js";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

function extractJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function generateWithFallback(prompt) {
  const models = [
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.0-flash"
  ];

  let lastError;

  for (const model of models) {
    try {
      console.log("Trying Gemini model:", model);

      const response = await ai.models.generateContent({
        model,
        contents: prompt
      });

      console.log("Gemini model succeeded:", model);
      return response;
    } catch (error) {
      lastError = error;

      console.error("Gemini model failed:", model);
      console.error(error.message || error);

      if (error.status) {
        console.error("Gemini error status:", error.status);
      }
    }
  }

  throw lastError;
}

export async function runRestaurantAgent(userMessage, conversationState = {}) {
  const prompt = `
You are a restaurant AI agent.

Return JSON only. No markdown. No explanation.

Available actions:
- check_menu
- check_price
- place_order
- track_order
- general_reply

Return JSON format:
{
  "action": "check_price",
  "item": "pizza",
  "size": "medium",
  "toppings": ["extra cheese"],
  "orderId": null,
  "reply": "optional reply"
}

Rules:
- If user asks menu, action is check_menu.
- If user greets you, action is general_reply.
- If user wants pizza and gives size/toppings, action is check_price.
- If user says yes/place it/order it and pending order exists, action is place_order.
- If user asks order status, action is track_order.
- If missing size, ask question using general_reply.
- Do not invent prices. Backend/database calculates prices.
- Keep replies short and friendly.

Previous state:
${JSON.stringify(conversationState)}

User message:
${userMessage}
`;

  let response;

  try {
    response = await generateWithFallback(prompt);
  } catch (error) {
    console.error("All Gemini models failed:", error);

    return {
      reply: "The AI service is busy right now. Please try again in a few seconds.",
      state: conversationState
    };
  }

  const parsed = extractJson(response.text || "");

  if (!parsed) {
    return {
      reply: "Sorry, I could not understand clearly. Can you repeat your order?",
      state: conversationState
    };
  }

  if (parsed.action === "check_menu") {
    const menu = await getMenu();

    const pizzaText = menu.pizzas
      .map((pizza) => `${pizza.name}: $${pizza.price}`)
      .join(", ");

    const toppingText = menu.toppings
      .map((topping) => `${topping.name}: $${topping.price}`)
      .join(", ");

    return {
      reply: `Available pizzas: ${pizzaText}. Available toppings: ${toppingText}.`,
      state: conversationState
    };
  }

  if (parsed.action === "check_price") {
    if (!parsed.size) {
      return {
        reply: "What size pizza would you like: small, medium, or large?",
        state: conversationState
      };
    }

    const priceResult = await calculatePizzaPrice(
      parsed.size,
      parsed.toppings || []
    );

    if (!priceResult.available) {
      return {
        reply: priceResult.message,
        state: conversationState
      };
    }

    const pendingOrder = {
      item: "pizza",
      size: parsed.size.toLowerCase(),
      toppings: parsed.toppings || [],
      subtotal: priceResult.subtotal,
      tax: priceResult.tax,
      total: priceResult.total
    };

    return {
      reply: `Your ${parsed.size} pizza with ${(parsed.toppings || []).join(", ") || "no extra toppings"} is available. Subtotal is $${priceResult.subtotal}, tax is $${priceResult.tax}, and total is $${priceResult.total}. Should I place the order?`,
      state: {
        ...conversationState,
        pendingOrder
      }
    };
  }

  if (parsed.action === "place_order") {
    if (!conversationState.pendingOrder) {
      return {
        reply: "I do not see a pending order. Please tell me what pizza you want first.",
        state: conversationState
      };
    }

    const orderResult = await createOrder(conversationState.pendingOrder);

    return {
      reply: `Your order has been placed successfully. Order ID is ${orderResult.orderId}. Status: ${orderResult.status}. Total: $${orderResult.total}.`,
      state: {
        ...conversationState,
        pendingOrder: null,
        lastOrderId: orderResult.orderId
      }
    };
  }

  if (parsed.action === "track_order") {
    const orderId = parsed.orderId || conversationState.lastOrderId;

    if (!orderId) {
      return {
        reply: "Please provide your order ID so I can check the status.",
        state: conversationState
      };
    }

    const statusResult = await getOrderStatus(orderId);

    if (!statusResult.found) {
      return {
        reply: statusResult.message,
        state: conversationState
      };
    }

    return {
      reply: `Order ${statusResult.orderId} is currently: ${statusResult.status}.`,
      state: conversationState
    };
  }

  return {
    reply:
      parsed.reply ||
      "Hi! I can help you order pizza. You can ask for the menu or tell me what pizza you want.",
    state: conversationState
  };
}