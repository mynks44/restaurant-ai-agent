import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import {
  calculateCartOrder,
  calculatePizzaPrice,
  cancelOrder,
  getMenu,
  getOrderStatus,
  getStoreHoursText,
  prepareReorder
} from "./tools.js";

dotenv.config();

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is missing.");
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

function extractJson(text = "") {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);

    if (!match) {
      return null;
    }

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function extractOrderIdFromText(text = "") {
  const match = text.match(/\b[a-f\d]{24}\b/i);
  return match ? match[0] : null;
}

function isPositiveConfirmation(text = "") {
  return /^(yes|yes please|yeah|yep|yup|ok|okay|sure|confirm|confirmed|place it|place the order|place order|order it|do it|go ahead|proceed|checkout|check out)( please)?[.!]?$/i.test(
    text.trim()
  );
}

function isNegativeConfirmation(text = "") {
  return /^(no|nope|cancel|never mind|nevermind|do not|don't|stop)[.!]?$/i.test(
    text.trim()
  );
}

function isOrderDetailsRequest(text = "") {
  return /(order|status|track|detail|details|description|receipt|summary|where|information)/i.test(
    text
  );
}

function isReorderRequest(text = "") {
  return /(same order|order again|place again|reorder|re-order|repeat|usual|same as before|same as last time|order that again|place that again)/i.test(
    text
  );
}

function isCancelRequest(text = "") {
  return /(cancel order|cancel my order|delete order|stop order|cancel this order)/i.test(
    text
  );
}

function isStoreHoursRequest(text = "") {
  return /(are you open|store hours|opening hours|closing time|what time.*open|what time.*close|when.*open|when.*close|open now|closed now)/i.test(
    text
  );
}

function isPaymentQuestion(text = "") {
  return /(payment method|saved card|credit card|debit card|card details|pay online|payment details|stripe|cash|how.*pay|change.*card|remove.*card)/i.test(
    text
  );
}

function isProfileQuestion(text = "") {
  return /(my profile|my address|delivery address|home address|email address|phone number|personal details|account settings|change.*address|change.*email|change.*name|change.*phone)/i.test(
    text
  );
}

function isAllergyQuestion(text = "") {
  return /(allergy|allergic|gluten|dairy|halal|vegetarian|vegan|nut|nuts|safe to eat|dietary restriction)/i.test(
    text
  );
}

function wantsAddToCart(text = "") {
  return /(add.*(?:to|into).*cart|put.*(?:in|into).*cart|cart it|add this to cart|add it to cart)/i.test(
    text
  );
}

function wantsRemoveFromCart(text = "") {
  return /(remove last.*cart|remove.*from.*cart|delete last.*cart|take.*out.*cart)/i.test(
    text
  );
}

function wantsClearCart(text = "") {
  return /(clear.*cart|empty.*cart|remove all.*cart|delete all.*cart)/i.test(
    text
  );
}

function wantsPlaceCart(text = "") {
  return /(place.*cart|checkout.*cart|check out.*cart|place cart order|order cart|submit cart|place all.*cart|buy.*cart)/i.test(
    text
  );
}

function wantsViewCart(text = "") {
  return /(show.*cart|view.*cart|what.*in.*cart|cart summary|cart total|read.*cart)/i.test(
    text
  );
}

function names(items = []) {
  return items
    .map((item) => item.displayName || item.name)
    .filter(Boolean)
    .join(", ");
}

function prices(items = []) {
  return items
    .map(
      (item) =>
        `${item.displayName || item.name}: $${Number(
          item.price || 0
        ).toFixed(2)}`
    )
    .join("\n");
}

function normalizeArray(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) =>
      item?.toString().toLowerCase().trim()
    )
    .filter(Boolean);
}

function updateArray(
  current = [],
  incoming = [],
  operation = "replace"
) {
  const currentItems = normalizeArray(current);
  const incomingItems = normalizeArray(incoming);

  if (operation === "add") {
    return [
      ...new Set([
        ...currentItems,
        ...incomingItems
      ])
    ];
  }

  if (operation === "remove") {
    return currentItems.filter(
      (item) => !incomingItems.includes(item)
    );
  }

  return incomingItems;
}

function buildCartItemFromPendingOrder(order) {
  const firstItem =
    Array.isArray(order.items) &&
    order.items.length > 0
      ? order.items[0]
      : order;

  return {
    size:
      firstItem.size ||
      order.size ||
      "medium",
    crust:
      firstItem.crust ||
      order.crust ||
      "regular",
    sauce:
      firstItem.sauce ||
      order.sauce ||
      "tomato",
    toppings: normalizeArray(
      firstItem.toppings ||
        order.toppings ||
        []
    ),
    sides: normalizeArray(
      firstItem.sides ||
        order.sides ||
        []
    ),
    drinks: normalizeArray(
      firstItem.drinks ||
        order.drinks ||
        []
    ),
    dips: normalizeArray(
      firstItem.dips ||
        order.dips ||
        []
    ),
    quantity: Math.max(
      1,
      Number(
        firstItem.quantity ||
          order.quantity ||
          1
      )
    ),
    itemSubtotal: Number(
      firstItem.itemSubtotal ||
        firstItem.subtotal ||
        order.subtotal ||
        0
    )
  };
}

function buildCheckoutItems(order) {
  if (
    Array.isArray(order?.items) &&
    order.items.length > 0
  ) {
    return order.items.map((item) => ({
      size: item.size || "medium",
      crust: item.crust || "regular",
      sauce: item.sauce || "tomato",
      toppings: normalizeArray(
        item.toppings || []
      ),
      sides: normalizeArray(
        item.sides || []
      ),
      drinks: normalizeArray(
        item.drinks || []
      ),
      dips: normalizeArray(
        item.dips || []
      ),
      quantity: Math.max(
        1,
        Number(item.quantity || 1)
      ),
      itemSubtotal: Number(
        item.itemSubtotal ||
          item.subtotal ||
          0
      )
    }));
  }

  return [
    buildCartItemFromPendingOrder(
      order || {}
    )
  ];
}

function formatPendingOrder(order) {
  const items = buildCheckoutItems(order);

  const itemText = items
    .map((item, index) => {
      return (
        `${index + 1}. ${item.size} pizza\n` +
        `Quantity: ${item.quantity}\n` +
        `Crust: ${item.crust}\n` +
        `Sauce: ${item.sauce}\n` +
        `Toppings: ${
          item.toppings.length
            ? item.toppings.join(", ")
            : "None"
        }\n` +
        `Sides: ${
          item.sides.length
            ? item.sides.join(", ")
            : "None"
        }\n` +
        `Drinks: ${
          item.drinks.length
            ? item.drinks.join(", ")
            : "None"
        }\n` +
        `Dips: ${
          item.dips.length
            ? item.dips.join(", ")
            : "None"
        }`
      );
    })
    .join("\n\n");

  return (
    `Order Summary:\n\n` +
    `${itemText}\n\n` +
    `Fulfillment: ${
      order.fulfillmentType || "pickup"
    }\n` +
    `${
      order.requestedTime
        ? `Requested Time: ${order.requestedTime}\n`
        : ""
    }` +
    `${
      order.specialInstructions
        ? `Special Instructions: ${order.specialInstructions}\n`
        : ""
    }` +
    `${
      order.couponCode
        ? `Coupon: ${order.couponCode}\n`
        : ""
    }` +
    `Subtotal: $${Number(
      order.subtotal || 0
    ).toFixed(2)}\n` +
    `${
      order.discount
        ? `Discount: -$${Number(
            order.discount
          ).toFixed(2)}\n`
        : ""
    }` +
    `${
      order.deliveryFee
        ? `Delivery Fee: $${Number(
            order.deliveryFee
          ).toFixed(2)}\n`
        : ""
    }` +
    `Tax: $${Number(
      order.tax || 0
    ).toFixed(2)}\n` +
    `Total: $${Number(
      order.total || 0
    ).toFixed(2)}\n\n` +
    `You can say "add it to cart" or "yes" to continue to secure checkout.`
  );
}

function formatCartSummary(cart = []) {
  if (
    !Array.isArray(cart) ||
    cart.length === 0
  ) {
    return "Your cart is empty.";
  }

  const lines = cart.map(
    (item, index) => {
      const toppings =
        Array.isArray(item.toppings) &&
        item.toppings.length
          ? item.toppings.join(", ")
          : "None";

      return (
        `${index + 1}. ${
          item.quantity || 1
        } × ${
          item.size || "medium"
        } pizza\n` +
        `Crust: ${
          item.crust || "regular"
        }\n` +
        `Sauce: ${
          item.sauce || "tomato"
        }\n` +
        `Toppings: ${toppings}\n` +
        `Item subtotal: $${Number(
          item.subtotal ||
            item.itemSubtotal ||
            0
        ).toFixed(2)}`
      );
    }
  );

  const subtotal = cart.reduce(
    (sum, item) =>
      sum +
      Number(
        item.subtotal ||
          item.itemSubtotal ||
          0
      ),
    0
  );

  const tax = Number(
    (subtotal * 0.13).toFixed(2)
  );

  const total = Number(
    (subtotal + tax).toFixed(2)
  );

  return (
    `Your Cart:\n\n` +
    `${lines.join("\n\n")}\n\n` +
    `Estimated subtotal: $${subtotal.toFixed(
      2
    )}\n` +
    `Estimated tax: $${tax.toFixed(
      2
    )}\n` +
    `Estimated total: $${total.toFixed(
      2
    )}\n\n` +
    `Say "place cart order" when you are ready for secure checkout.`
  );
}

async function recalculatePendingOrder(
  order
) {
  const items = buildCheckoutItems(order);

  const calculation =
    await calculateCartOrder(items, {
      fulfillmentType:
        order.fulfillmentType ||
        "pickup",
      requestedTime:
        order.requestedTime || null,
      couponCode:
        order.couponCode || null,
      specialInstructions:
        order.specialInstructions || ""
    });

  if (!calculation.available) {
    return {
      available: false,
      message: calculation.message
    };
  }

  return {
    available: true,
    pendingOrder: {
      ...order,
      items: calculation.items,
      subtotal: calculation.subtotal,
      discount: calculation.discount,
      deliveryFee:
        calculation.deliveryFee,
      tax: calculation.tax,
      total: calculation.total,
      couponCode:
        calculation.couponCode,
      couponMessage:
        calculation.couponMessage,
      fulfillmentType:
        calculation.fulfillmentType,
      requestedTime:
        calculation.requestedTime,
      specialInstructions:
        calculation.specialInstructions
    }
  };
}

async function generateWithFallback(
  prompt
) {
  const models = [
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.0-flash"
  ];

  let lastError;

  for (const model of models) {
    try {
      return await ai.models.generateContent(
        {
          model,
          contents: prompt
        }
      );
    } catch (error) {
      lastError = error;
      console.error(
        `Gemini model failed: ${model}`
      );
      console.error(
        error.message || error
      );
    }
  }

  throw lastError;
}

export async function runRestaurantAgent(
  userMessage,
  conversationState = {}
) {
  const message = String(
    userMessage || ""
  ).trim();

  const directOrderId =
    extractOrderIdFromText(message);

  const currentCart = Array.isArray(
    conversationState.cart
  )
    ? conversationState.cart
    : [];

  if (!message) {
    return {
      reply: "Please enter a message.",
      state: conversationState
    };
  }

  if (isNegativeConfirmation(message)) {
    if (
      conversationState.pendingOrder ||
      conversationState.pendingCancelOrderId
    ) {
      return {
        reply:
          "No problem. I cancelled the pending action.",
        state: {
          ...conversationState,
          pendingOrder: null,
          pendingCancelOrderId: null
        }
      };
    }
  }

  if (
    isPositiveConfirmation(message) &&
    conversationState.pendingCancelOrderId
  ) {
    const result = await cancelOrder(
      conversationState.pendingCancelOrderId
    );

    return {
      reply: result.message,
      state: {
        ...conversationState,
        pendingCancelOrderId: null
      }
    };
  }

  if (
    isPositiveConfirmation(message) &&
    conversationState.pendingOrder
  ) {
    const items = buildCheckoutItems(
      conversationState.pendingOrder
    );

    return {
      reply:
        "Your order is ready for secure checkout. I will use your saved customer profile, delivery address, and payment method after you confirm payment.",
      state: {
        ...conversationState,
        pendingOrder: null
      },
      cartAction: {
        type: "request_checkout",
        items
      }
    };
  }

  if (wantsClearCart(message)) {
    return {
      reply: "I cleared your cart.",
      state: {
        ...conversationState,
        pendingOrder: null
      },
      cartAction: {
        type: "clear_cart"
      }
    };
  }

  if (wantsRemoveFromCart(message)) {
    if (currentCart.length === 0) {
      return {
        reply:
          "Your cart is already empty.",
        state: conversationState
      };
    }

    return {
      reply:
        "I removed the last item from your cart.",
      state: conversationState,
      cartAction: {
        type: "remove_last"
      }
    };
  }

  if (wantsViewCart(message)) {
    return {
      reply:
        formatCartSummary(currentCart),
      state: conversationState
    };
  }

  if (wantsPlaceCart(message)) {
    if (currentCart.length > 0) {
      return {
        reply:
          "Your cart is ready for secure checkout. I will use your saved delivery and payment details.",
        state: conversationState,
        cartAction: {
          type: "request_checkout",
          items: currentCart
        }
      };
    }

    if (
      conversationState.pendingOrder
    ) {
      return {
        reply:
          "Your pending order is ready for secure checkout. I will use your saved delivery and payment details.",
        state: {
          ...conversationState,
          pendingOrder: null
        },
        cartAction: {
          type: "request_checkout",
          items: buildCheckoutItems(
            conversationState.pendingOrder
          )
        }
      };
    }

    return {
      reply:
        "Your cart is empty. Tell me what pizza you would like, or use the manual order builder.",
      state: conversationState
    };
  }

  if (
    wantsAddToCart(message) &&
    conversationState.pendingOrder
  ) {
    const cartItem =
      buildCartItemFromPendingOrder(
        conversationState.pendingOrder
      );

    return {
      reply:
        `I added this item to your cart:\n\n` +
        `${cartItem.quantity} × ${cartItem.size} pizza\n` +
        `Crust: ${cartItem.crust}\n` +
        `Sauce: ${cartItem.sauce}\n` +
        `Toppings: ${
          cartItem.toppings.length
            ? cartItem.toppings.join(", ")
            : "None"
        }\n` +
        `Sides: ${
          cartItem.sides.length
            ? cartItem.sides.join(", ")
            : "None"
        }\n` +
        `Drinks: ${
          cartItem.drinks.length
            ? cartItem.drinks.join(", ")
            : "None"
        }\n` +
        `Dips: ${
          cartItem.dips.length
            ? cartItem.dips.join(", ")
            : "None"
        }\n` +
        `Item subtotal: $${cartItem.itemSubtotal.toFixed(
          2
        )}\n\n` +
        `You can add more items or say "place cart order".`,
      state: {
        ...conversationState,
        pendingOrder: null
      },
      cartAction: {
        type: "add_item",
        item: cartItem
      }
    };
  }

  if (isCancelRequest(message)) {
    const orderId =
      directOrderId ||
      conversationState.lastOrderId ||
      conversationState.lastDetailedOrderId;

    if (!orderId) {
      return {
        reply:
          "Please provide the order ID you want to cancel.",
        state: conversationState
      };
    }

    const statusResult =
      await getOrderStatus(orderId);

    if (!statusResult.found) {
      return {
        reply: statusResult.message,
        state: conversationState
      };
    }

    return {
      reply:
        `I found this order:\n\n` +
        `${statusResult.description}\n\n` +
        `Type "yes" to confirm cancellation.`,
      state: {
        ...conversationState,
        pendingCancelOrderId: orderId,
        lastDetailedOrderId: orderId
      }
    };
  }

  if (isReorderRequest(message)) {
    const orderId =
      directOrderId ||
      conversationState.lastDetailedOrderId ||
      conversationState.lastOrderId;

    if (!orderId) {
      return {
        reply:
          "Please provide the previous order ID you want to reorder.",
        state: conversationState
      };
    }

    const reorderResult =
      await prepareReorder(orderId);

    if (!reorderResult.found) {
      return {
        reply: reorderResult.message,
        state: conversationState
      };
    }

    return {
      reply:
        `${reorderResult.description}\n\n` +
        `Should I continue to secure checkout for this same order?`,
      state: {
        ...conversationState,
        pendingOrder:
          reorderResult.pendingOrder,
        lastOrderId: orderId,
        lastDetailedOrderId: orderId
      }
    };
  }

  if (
    directOrderId &&
    isOrderDetailsRequest(message)
  ) {
    const statusResult =
      await getOrderStatus(
        directOrderId
      );

    if (!statusResult.found) {
      return {
        reply: statusResult.message,
        state: conversationState
      };
    }

    return {
      reply:
        `Here are the full details for your order:\n\n` +
        statusResult.description,
      state: {
        ...conversationState,
        lastOrderId: directOrderId,
        lastDetailedOrderId:
          directOrderId
      }
    };
  }

  if (isStoreHoursRequest(message)) {
    const hoursText =
      await getStoreHoursText();

    return {
      reply: hoursText,
      state: conversationState
    };
  }

  if (isProfileQuestion(message)) {
    return {
      reply:
        "Your saved name, email, phone number, delivery address, delivery instructions, and payment method are managed from Settings. The AI does not display or store your full card number or security code.",
      state: conversationState
    };
  }

  if (isPaymentQuestion(message)) {
    return {
      reply:
        "Saved payments are managed securely from Settings through Stripe. The application stores only a Stripe payment reference and masked card summary. Payment is processed only after you confirm checkout.",
      state: conversationState
    };
  }

  if (isAllergyQuestion(message)) {
    return {
      reply:
        "I can help identify menu options, but allergy and dietary information must be confirmed with restaurant staff before ordering. Do not rely only on the AI for severe allergies.",
      state: conversationState
    };
  }

  const prompt = `
You are Restaurant AI Agent, a professional restaurant ordering assistant.

Return valid JSON only. Do not use markdown and do not add text outside the JSON object.

Available actions:
- check_menu
- check_price
- place_order
- track_order
- reorder_order
- modify_pending_order
- cancel_order
- apply_coupon
- schedule_order
- check_store_hours
- view_cart
- add_to_cart
- remove_from_cart
- clear_cart
- general_reply

Return this JSON structure:
{
  "action": "check_price",
  "item": "pizza",
  "size": "medium",
  "quantity": 1,
  "crust": "regular",
  "sauce": "tomato",
  "toppings": ["extra cheese"],
  "sides": ["garlic bread"],
  "drinks": ["coke"],
  "dips": ["creamy garlic dip"],
  "fulfillmentType": "pickup",
  "requestedTime": null,
  "specialInstructions": "",
  "couponCode": null,
  "operation": "replace",
  "orderId": null,
  "reply": "optional short reply"
}

Menu:
Pizza sizes: small, medium, large, x-large.
Crusts: regular, thin, thick, stuffed.
Sauces: tomato, bbq, creamy garlic, buffalo.
Toppings: pepperoni, extra cheese, mushrooms, green peppers, red onions, black olives, pineapple, jalapenos, chicken, bacon, sausage, tomatoes, spinach, hot peppers.
Sides: garlic bread, potato wedges, chicken wings, caesar salad.
Drinks: coke, diet coke, sprite, water.
Dips: creamy garlic dip, ranch dip, marinara dip, cheddar jalapeno dip.

Rules:
- Use check_menu when the customer asks about menu items, choices, or prices without building a specific order.
- Use check_price when the customer describes a pizza and includes a size.
- If the customer describes a pizza and asks to add it to the cart, still use check_price.
- Include quantity when the customer gives a quantity.
- Use add_to_cart when the customer wants the existing pending order added to the cart.
- Use view_cart when the customer asks what is in the cart.
- Use remove_from_cart when the customer asks to remove the last cart item.
- Use clear_cart when the customer asks to empty the cart.
- Use place_order when the customer wants to checkout a pending order or cart.
- The frontend performs secure checkout. Never claim payment succeeded yourself.
- Use track_order for status, receipt, summary, or full order details.
- Use reorder_order for repeat, reorder, usual, or same order again.
- Use modify_pending_order when the customer changes a pending order.
- For modify_pending_order, operation must be add, remove, or replace.
- Use cancel_order when the customer wants to cancel an existing order.
- Use apply_coupon when the customer provides a coupon code.
- Use schedule_order for pickup, delivery, scheduling, requested date, or requested time.
- Use check_store_hours for opening or closing hours.
- Use general_reply for greetings, help, profile, settings, payment, and project questions.
- Do not invent prices.
- Do not ask for or expose full payment card information.
- Keep replies brief and professional.

Current cart:
${JSON.stringify(currentCart)}

Previous conversation state:
${JSON.stringify({
  ...conversationState,
  cart: undefined
})}

Customer message:
${message}
`;

  let response;

  try {
    response =
      await generateWithFallback(prompt);
  } catch (error) {
    console.error(
      "All Gemini models failed:",
      error
    );

    return {
      reply:
        "The AI service is temporarily unavailable. Please try again in a few seconds.",
      state: conversationState
    };
  }

  const parsed = extractJson(
    response.text || ""
  );

  if (!parsed?.action) {
    return {
      reply:
        "I could not understand that request clearly. Please try again with the pizza size and any toppings you want.",
      state: conversationState
    };
  }

  if (parsed.action === "check_menu") {
    const menu = await getMenu();

    return {
      reply:
        `Restaurant AI Agent Menu\n\n` +
        `Pizza Sizes:\n${prices(
          menu.pizzas
        )}\n\n` +
        `Crust Options:\n${prices(
          menu.crusts
        )}\n\n` +
        `Sauce Options:\n${names(
          menu.sauces
        )}\n\n` +
        `Toppings:\n${prices(
          menu.toppings
        )}\n\n` +
        `Sides:\n${prices(
          menu.sides
        )}\n\n` +
        `Drinks:\n${prices(
          menu.drinks
        )}\n\n` +
        `Dips:\n${prices(
          menu.dips
        )}\n\n` +
        `Try: "Add a medium pizza with extra cheese and mushrooms to my cart."`,
      state: conversationState
    };
  }

  if (parsed.action === "view_cart") {
    return {
      reply:
        formatCartSummary(currentCart),
      state: conversationState
    };
  }

  if (
    parsed.action ===
    "remove_from_cart"
  ) {
    if (currentCart.length === 0) {
      return {
        reply:
          "Your cart is already empty.",
        state: conversationState
      };
    }

    return {
      reply:
        "I removed the last item from your cart.",
      state: conversationState,
      cartAction: {
        type: "remove_last"
      }
    };
  }

  if (parsed.action === "clear_cart") {
    return {
      reply: "I cleared your cart.",
      state: {
        ...conversationState,
        pendingOrder: null
      },
      cartAction: {
        type: "clear_cart"
      }
    };
  }

  if (parsed.action === "check_price") {
    if (!parsed.size) {
      return {
        reply:
          "What size pizza would you like: small, medium, large, or x-large?",
        state: conversationState
      };
    }

    const priceResult =
      await calculatePizzaPrice(
        parsed.size,
        parsed.toppings || [],
        parsed.crust || "regular",
        parsed.sauce || "tomato",
        parsed.sides || [],
        parsed.drinks || [],
        parsed.dips || [],
        parsed.quantity || 1
      );

    if (!priceResult.available) {
      return {
        reply: priceResult.message,
        state: conversationState
      };
    }

    const pendingOrder = {
      source: "ai-agent",
      size: String(
        parsed.size
      ).toLowerCase(),
      crust:
        parsed.crust || "regular",
      sauce:
        parsed.sauce || "tomato",
      toppings: normalizeArray(
        parsed.toppings || []
      ),
      sides: normalizeArray(
        parsed.sides || []
      ),
      drinks: normalizeArray(
        parsed.drinks || []
      ),
      dips: normalizeArray(
        parsed.dips || []
      ),
      quantity: Math.max(
        1,
        Number(parsed.quantity || 1)
      ),
      fulfillmentType:
        parsed.fulfillmentType ||
        "pickup",
      requestedTime:
        parsed.requestedTime || null,
      specialInstructions:
        parsed.specialInstructions || "",
      couponCode:
        parsed.couponCode || null
    };

    const calculation =
      await recalculatePendingOrder(
        pendingOrder
      );

    if (!calculation.available) {
      return {
        reply: calculation.message,
        state: conversationState
      };
    }

    if (wantsAddToCart(message)) {
      const cartItem =
        buildCartItemFromPendingOrder(
          calculation.pendingOrder
        );

      return {
        reply:
          `I added this item to your cart:\n\n` +
          `${cartItem.quantity} × ${cartItem.size} pizza\n` +
          `Crust: ${cartItem.crust}\n` +
          `Sauce: ${cartItem.sauce}\n` +
          `Toppings: ${
            cartItem.toppings.length
              ? cartItem.toppings.join(
                  ", "
                )
              : "None"
          }\n` +
          `Item subtotal: $${cartItem.itemSubtotal.toFixed(
            2
          )}\n\n` +
          `You can add more items or say "place cart order".`,
        state: {
          ...conversationState,
          pendingOrder: null
        },
        cartAction: {
          type: "add_item",
          item: cartItem
        }
      };
    }

    return {
      reply: formatPendingOrder(
        calculation.pendingOrder
      ),
      state: {
        ...conversationState,
        pendingOrder:
          calculation.pendingOrder
      }
    };
  }

  if (parsed.action === "add_to_cart") {
    if (
      !conversationState.pendingOrder
    ) {
      return {
        reply:
          "There is no pending order to add. Tell me what pizza you would like first.",
        state: conversationState
      };
    }

    const cartItem =
      buildCartItemFromPendingOrder(
        conversationState.pendingOrder
      );

    return {
      reply:
        `I added ${cartItem.quantity} × ${cartItem.size} pizza to your cart.`,
      state: {
        ...conversationState,
        pendingOrder: null
      },
      cartAction: {
        type: "add_item",
        item: cartItem
      }
    };
  }

  if (
    parsed.action ===
    "modify_pending_order"
  ) {
    if (
      !conversationState.pendingOrder
    ) {
      return {
        reply:
          "I do not see a pending order yet. Tell me what pizza you would like first.",
        state: conversationState
      };
    }

    const operation = [
      "add",
      "remove",
      "replace"
    ].includes(parsed.operation)
      ? parsed.operation
      : "replace";

    const current =
      conversationState.pendingOrder;

    const firstItem =
      Array.isArray(current.items) &&
      current.items.length > 0
        ? current.items[0]
        : current;

    const updatedItem = {
      ...firstItem,
      size:
        parsed.size ||
        firstItem.size,
      crust:
        parsed.crust ||
        firstItem.crust ||
        "regular",
      sauce:
        parsed.sauce ||
        firstItem.sauce ||
        "tomato",
      quantity: Math.max(
        1,
        Number(
          parsed.quantity ||
            firstItem.quantity ||
            1
        )
      ),
      toppings: Array.isArray(
        parsed.toppings
      )
        ? updateArray(
            firstItem.toppings,
            parsed.toppings,
            operation
          )
        : firstItem.toppings || [],
      sides: Array.isArray(
        parsed.sides
      )
        ? updateArray(
            firstItem.sides,
            parsed.sides,
            operation
          )
        : firstItem.sides || [],
      drinks: Array.isArray(
        parsed.drinks
      )
        ? updateArray(
            firstItem.drinks,
            parsed.drinks,
            operation
          )
        : firstItem.drinks || [],
      dips: Array.isArray(
        parsed.dips
      )
        ? updateArray(
            firstItem.dips,
            parsed.dips,
            operation
          )
        : firstItem.dips || []
    };

    const updatedOrder = {
      ...current,
      items: [updatedItem],
      fulfillmentType:
        parsed.fulfillmentType ||
        current.fulfillmentType ||
        "pickup",
      requestedTime:
        parsed.requestedTime ??
        current.requestedTime ??
        null,
      specialInstructions:
        parsed.specialInstructions ??
        current.specialInstructions ??
        "",
      couponCode:
        parsed.couponCode ??
        current.couponCode ??
        null
    };

    const calculation =
      await recalculatePendingOrder(
        updatedOrder
      );

    if (!calculation.available) {
      return {
        reply: calculation.message,
        state: conversationState
      };
    }

    return {
      reply:
        `I updated your pending order.\n\n` +
        formatPendingOrder(
          calculation.pendingOrder
        ),
      state: {
        ...conversationState,
        pendingOrder:
          calculation.pendingOrder
      }
    };
  }

  if (
    parsed.action === "apply_coupon"
  ) {
    if (
      !conversationState.pendingOrder
    ) {
      return {
        reply:
          "Please create an order first, and then I can apply a coupon.",
        state: conversationState
      };
    }

    if (!parsed.couponCode) {
      return {
        reply:
          "Please provide the coupon code you want to apply.",
        state: conversationState
      };
    }

    const calculation =
      await recalculatePendingOrder({
        ...conversationState.pendingOrder,
        couponCode: parsed.couponCode
      });

    if (!calculation.available) {
      return {
        reply: calculation.message,
        state: conversationState
      };
    }

    const couponMessage =
      calculation.pendingOrder
        .couponMessage
        ? `${calculation.pendingOrder.couponMessage}\n\n`
        : "";

    return {
      reply:
        couponMessage +
        formatPendingOrder(
          calculation.pendingOrder
        ),
      state: {
        ...conversationState,
        pendingOrder:
          calculation.pendingOrder
      }
    };
  }

  if (
    parsed.action === "schedule_order"
  ) {
    if (
      !conversationState.pendingOrder
    ) {
      return {
        reply:
          "Please create an order first, and then I can set pickup, delivery, or a scheduled time.",
        state: conversationState
      };
    }

    const calculation =
      await recalculatePendingOrder({
        ...conversationState.pendingOrder,
        fulfillmentType:
          parsed.fulfillmentType ||
          conversationState
            .pendingOrder
            .fulfillmentType ||
          "pickup",
        requestedTime:
          parsed.requestedTime ??
          conversationState
            .pendingOrder
            .requestedTime ??
          null,
        specialInstructions:
          parsed.specialInstructions ??
          conversationState
            .pendingOrder
            .specialInstructions ??
          ""
      });

    if (!calculation.available) {
      return {
        reply: calculation.message,
        state: conversationState
      };
    }

    return {
      reply:
        `I updated the fulfillment details.\n\n` +
        formatPendingOrder(
          calculation.pendingOrder
        ),
      state: {
        ...conversationState,
        pendingOrder:
          calculation.pendingOrder
      }
    };
  }

  if (
    parsed.action === "place_order"
  ) {
    const checkoutItems =
      currentCart.length > 0
        ? currentCart
        : conversationState.pendingOrder
          ? buildCheckoutItems(
              conversationState.pendingOrder
            )
          : [];

    if (checkoutItems.length === 0) {
      return {
        reply:
          "There is no order ready for checkout. Build a pizza or add an item to the cart first.",
        state: conversationState
      };
    }

    return {
      reply:
        "Your order is ready for secure checkout. I will use your saved profile, delivery address, and payment method.",
      state: {
        ...conversationState,
        pendingOrder: null
      },
      cartAction: {
        type: "request_checkout",
        items: checkoutItems
      }
    };
  }

  if (
    parsed.action === "track_order"
  ) {
    const orderId =
      parsed.orderId ||
      directOrderId ||
      conversationState.lastOrderId ||
      conversationState
        .lastDetailedOrderId;

    if (!orderId) {
      return {
        reply:
          "Please provide the order ID so I can check the full order details.",
        state: conversationState
      };
    }

    const statusResult =
      await getOrderStatus(orderId);

    if (!statusResult.found) {
      return {
        reply: statusResult.message,
        state: conversationState
      };
    }

    return {
      reply:
        `Here are the full details for your order:\n\n` +
        statusResult.description,
      state: {
        ...conversationState,
        lastOrderId: orderId,
        lastDetailedOrderId: orderId
      }
    };
  }

  if (
    parsed.action === "reorder_order"
  ) {
    const orderId =
      parsed.orderId ||
      directOrderId ||
      conversationState
        .lastDetailedOrderId ||
      conversationState.lastOrderId;

    if (!orderId) {
      return {
        reply:
          "Please provide the previous order ID you want to reorder.",
        state: conversationState
      };
    }

    const reorderResult =
      await prepareReorder(orderId);

    if (!reorderResult.found) {
      return {
        reply: reorderResult.message,
        state: conversationState
      };
    }

    return {
      reply:
        `${reorderResult.description}\n\n` +
        `Should I continue to secure checkout for this same order?`,
      state: {
        ...conversationState,
        pendingOrder:
          reorderResult.pendingOrder,
        lastOrderId: orderId,
        lastDetailedOrderId: orderId
      }
    };
  }

  if (
    parsed.action === "cancel_order"
  ) {
    const orderId =
      parsed.orderId ||
      directOrderId ||
      conversationState.lastOrderId ||
      conversationState
        .lastDetailedOrderId;

    if (!orderId) {
      return {
        reply:
          "Please provide the order ID you want to cancel.",
        state: conversationState
      };
    }

    const statusResult =
      await getOrderStatus(orderId);

    if (!statusResult.found) {
      return {
        reply: statusResult.message,
        state: conversationState
      };
    }

    return {
      reply:
        `I found this order:\n\n` +
        `${statusResult.description}\n\n` +
        `Type "yes" to confirm cancellation.`,
      state: {
        ...conversationState,
        pendingCancelOrderId: orderId,
        lastDetailedOrderId: orderId
      }
    };
  }

  if (
    parsed.action ===
    "check_store_hours"
  ) {
    const hoursText =
      await getStoreHoursText();

    return {
      reply: hoursText,
      state: conversationState
    };
  }

  return {
    reply:
      parsed.reply ||
      "I can show the menu, build or modify a pizza, manage the cart, repeat an order, track or cancel an order, apply a coupon, and start secure checkout.",
    state: conversationState
  };
}