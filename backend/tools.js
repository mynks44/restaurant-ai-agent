import { ObjectId } from "mongodb";
import { connectDB } from "./db.js";

function normalizeText(value = "") {
  return value.toString().toLowerCase().trim();
}

function money(value = 0) {
  return Number(Number(value || 0).toFixed(2));
}

function moneyText(value = 0) {
  return money(value).toFixed(2);
}

function formatList(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return "None";
  }

  return items.join(", ");
}

function normalizeArray(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map(normalizeText).filter(Boolean);
}

function defaultStoreSettings() {
  return {
    storeName: "Restaurant AI Agent Demo",
    timezone: "America/Toronto",
    fulfillmentTypes: ["pickup", "delivery"],
    averagePickupMinutes: 20,
    averageDeliveryMinutes: 40,
    deliveryFee: 4.99,
    hours: {
      monday: { open: "10:00", close: "22:00" },
      tuesday: { open: "10:00", close: "22:00" },
      wednesday: { open: "10:00", close: "22:00" },
      thursday: { open: "10:00", close: "22:00" },
      friday: { open: "10:00", close: "23:00" },
      saturday: { open: "11:00", close: "23:00" },
      sunday: { open: "11:00", close: "21:00" }
    }
  };
}

async function findAvailableItems(collectionName, names = []) {
  const db = await connectDB();
  const normalizedNames = normalizeArray(names);

  if (normalizedNames.length === 0) {
    return {
      foundItems: [],
      missingItems: []
    };
  }

  const foundItems = await db.collection(collectionName).find({
    name: { $in: normalizedNames },
    available: true
  }).toArray();

  const foundNames = foundItems.map((item) => item.name);

  const missingItems = normalizedNames.filter(
    (name) => !foundNames.includes(name)
  );

  return {
    foundItems,
    missingItems
  };
}

function buildSingleOrderItem(order) {
  return {
    item: order.item || "pizza",
    size: order.size || "Not selected",
    crust: order.crust || "regular",
    sauce: order.sauce || "tomato",
    toppings: Array.isArray(order.toppings) ? order.toppings : [],
    sides: Array.isArray(order.sides) ? order.sides : [],
    drinks: Array.isArray(order.drinks) ? order.drinks : [],
    dips: Array.isArray(order.dips) ? order.dips : [],
    quantity: Number(order.quantity || 1),
    itemSubtotal: order.itemSubtotal || order.subtotal || order.total || 0
  };
}

function buildOrderDescription(order, orderId) {
  const items =
    Array.isArray(order.items) && order.items.length > 0
      ? order.items
      : [buildSingleOrderItem(order)];

  const itemText = items
    .map((item, index) => {
      return (
        `${index + 1}. ${item.size || "Not selected"} pizza\n` +
        `Quantity: ${item.quantity || 1}\n` +
        `Crust: ${item.crust || "regular"}\n` +
        `Sauce: ${item.sauce || "tomato"}\n` +
        `Toppings: ${formatList(item.toppings)}\n` +
        `Sides: ${formatList(item.sides)}\n` +
        `Drinks: ${formatList(item.drinks)}\n` +
        `Dips: ${formatList(item.dips)}\n` +
        `Item Total: $${moneyText(item.itemSubtotal || item.subtotal)}`
      );
    })
    .join("\n\n");

  const fulfillmentText = order.fulfillmentType
    ? `Fulfillment: ${order.fulfillmentType}\n`
    : "";

  const requestedTimeText = order.requestedTime
    ? `Requested Time: ${order.requestedTime}\n`
    : "";

  const instructionsText = order.specialInstructions
    ? `Special Instructions: ${order.specialInstructions}\n`
    : "";

  const discountText = order.discount
    ? `Discount: -$${moneyText(order.discount)}\n`
    : "";

  const deliveryFeeText = order.deliveryFee
    ? `Delivery Fee: $${moneyText(order.deliveryFee)}\n`
    : "";

  return (
    `Order ID: ${orderId}\n` +
    `Status: ${order.status || "Order Received"}\n` +
    fulfillmentText +
    requestedTimeText +
    instructionsText +
    `\nItems:\n${itemText}\n\n` +
    `Subtotal: $${moneyText(order.subtotal)}\n` +
    discountText +
    deliveryFeeText +
    `Tax: $${moneyText(order.tax)}\n` +
    `Total: $${moneyText(order.total)}`
  );
}

function buildStatusHistory(status) {
  return [
    {
      status,
      time: new Date()
    }
  ];
}

async function getPromotion(couponCode) {
  if (!couponCode) {
    return null;
  }

  const db = await connectDB();
  const normalizedCode = couponCode.toString().trim().toUpperCase();

  const promotion = await db.collection("promotions").findOne({
    code: normalizedCode,
    active: true
  });

  if (promotion) {
    return promotion;
  }

  if (normalizedCode === "DEMO10") {
    return {
      code: "DEMO10",
      type: "percentage",
      value: 10,
      minimumSubtotal: 10,
      active: true
    };
  }

  if (normalizedCode === "PIZZA5") {
    return {
      code: "PIZZA5",
      type: "fixed",
      value: 5,
      minimumSubtotal: 20,
      active: true
    };
  }

  return null;
}

async function calculateDiscount(subtotal, couponCode) {
  const promotion = await getPromotion(couponCode);

  if (!promotion) {
    return {
      couponCode: null,
      discount: 0,
      message: couponCode ? "Coupon code is not valid." : null
    };
  }

  if (subtotal < Number(promotion.minimumSubtotal || 0)) {
    return {
      couponCode: promotion.code,
      discount: 0,
      message: `Coupon ${promotion.code} requires minimum subtotal of $${moneyText(promotion.minimumSubtotal)}.`
    };
  }

  let discount = 0;

  if (promotion.type === "percentage") {
    discount = subtotal * (Number(promotion.value || 0) / 100);
  } else {
    discount = Number(promotion.value || 0);
  }

  discount = Math.min(discount, subtotal);

  return {
    couponCode: promotion.code,
    discount: money(discount),
    message: `Coupon ${promotion.code} applied successfully.`
  };
}

export async function getMenu() {
  const db = await connectDB();

  const pizzas = await db.collection("menu").find({ available: true }).toArray();
  const toppings = await db.collection("toppings").find({ available: true }).toArray();
  const crusts = await db.collection("crusts").find({ available: true }).toArray();
  const sauces = await db.collection("sauces").find({ available: true }).toArray();
  const sides = await db.collection("sides").find({ available: true }).toArray();
  const drinks = await db.collection("drinks").find({ available: true }).toArray();
  const dips = await db.collection("dips").find({ available: true }).toArray();

  return {
    pizzas,
    toppings,
    crusts,
    sauces,
    sides,
    drinks,
    dips
  };
}

export async function getStoreSettings() {
  const db = await connectDB();
  const settings = await db.collection("storeSettings").findOne({
    key: "main"
  });

  return settings || defaultStoreSettings();
}

export async function getStoreHoursText() {
  const settings = await getStoreSettings();
  const hours = settings.hours || defaultStoreSettings().hours;

  const lines = Object.entries(hours).map(([day, value]) => {
    return `${day.charAt(0).toUpperCase() + day.slice(1)}: ${value.open} - ${value.close}`;
  });

  return (
    `${settings.storeName || "Restaurant AI Agent Demo"} hours:\n\n` +
    lines.join("\n") +
    `\n\nAverage pickup time: ${settings.averagePickupMinutes || 20} minutes\n` +
    `Average delivery time: ${settings.averageDeliveryMinutes || 40} minutes`
  );
}

export async function calculatePizzaPrice(
  size,
  toppings = [],
  crust = "regular",
  sauce = "tomato",
  sides = [],
  drinks = [],
  dips = [],
  quantity = 1
) {
  const db = await connectDB();

  const normalizedSize = normalizeText(size);
  const normalizedCrust = normalizeText(crust || "regular");
  const normalizedSauce = normalizeText(sauce || "tomato");
  const safeQuantity = Math.max(1, Number(quantity || 1));

  const pizza = await db.collection("menu").findOne({
    type: "pizza",
    size: normalizedSize,
    available: true
  });

  if (!pizza) {
    return {
      available: false,
      message: `Sorry, ${size} pizza is not available. Available sizes are small, medium, large, and x-large.`
    };
  }

  const crustDoc = await db.collection("crusts").findOne({
    name: normalizedCrust,
    available: true
  });

  if (!crustDoc) {
    return {
      available: false,
      message: `Sorry, ${crust} crust is not available.`
    };
  }

  const sauceDoc = await db.collection("sauces").findOne({
    name: normalizedSauce,
    available: true
  });

  if (!sauceDoc) {
    return {
      available: false,
      message: `Sorry, ${sauce} sauce is not available.`
    };
  }

  const toppingResult = await findAvailableItems("toppings", toppings);
  if (toppingResult.missingItems.length > 0) {
    return {
      available: false,
      message: `Sorry, these toppings are not available: ${toppingResult.missingItems.join(", ")}.`
    };
  }

  const sideResult = await findAvailableItems("sides", sides);
  if (sideResult.missingItems.length > 0) {
    return {
      available: false,
      message: `Sorry, these sides are not available: ${sideResult.missingItems.join(", ")}.`
    };
  }

  const drinkResult = await findAvailableItems("drinks", drinks);
  if (drinkResult.missingItems.length > 0) {
    return {
      available: false,
      message: `Sorry, these drinks are not available: ${drinkResult.missingItems.join(", ")}.`
    };
  }

  const dipResult = await findAvailableItems("dips", dips);
  if (dipResult.missingItems.length > 0) {
    return {
      available: false,
      message: `Sorry, these dips are not available: ${dipResult.missingItems.join(", ")}.`
    };
  }

  const toppingTotal = toppingResult.foundItems.reduce(
    (sum, item) => sum + item.price,
    0
  );

  const sideTotal = sideResult.foundItems.reduce(
    (sum, item) => sum + item.price,
    0
  );

  const drinkTotal = drinkResult.foundItems.reduce(
    (sum, item) => sum + item.price,
    0
  );

  const dipTotal = dipResult.foundItems.reduce(
    (sum, item) => sum + item.price,
    0
  );

  const singleSubtotal = money(
    pizza.price +
      crustDoc.price +
      sauceDoc.price +
      toppingTotal +
      sideTotal +
      drinkTotal +
      dipTotal
  );

  const subtotal = money(singleSubtotal * safeQuantity);
  const tax = money(subtotal * 0.13);
  const total = money(subtotal + tax);

  return {
    available: true,
    pizza,
    crust: crustDoc,
    sauce: sauceDoc,
    toppings: toppingResult.foundItems,
    sides: sideResult.foundItems,
    drinks: drinkResult.foundItems,
    dips: dipResult.foundItems,
    quantity: safeQuantity,
    singleSubtotal,
    subtotal,
    tax,
    total
  };
}

export async function calculateCartOrder(items = [], options = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      available: false,
      message: "Cart is empty."
    };
  }

  const settings = await getStoreSettings();
  const fulfillmentType = options.fulfillmentType || "pickup";
  const calculatedItems = [];
  let subtotal = 0;

  for (const item of items) {
    const result = await calculatePizzaPrice(
      item.size,
      item.toppings || [],
      item.crust || "regular",
      item.sauce || "tomato",
      item.sides || [],
      item.drinks || [],
      item.dips || [],
      item.quantity || 1
    );

    if (!result.available) {
      return result;
    }

    subtotal += result.subtotal;

    calculatedItems.push({
      item: "pizza",
      size: normalizeText(item.size),
      crust: normalizeText(item.crust || "regular"),
      sauce: normalizeText(item.sauce || "tomato"),
      toppings: normalizeArray(item.toppings || []),
      sides: normalizeArray(item.sides || []),
      drinks: normalizeArray(item.drinks || []),
      dips: normalizeArray(item.dips || []),
      quantity: Number(item.quantity || 1),
      itemSubtotal: result.subtotal
    });
  }

  subtotal = money(subtotal);

  const couponResult = await calculateDiscount(subtotal, options.couponCode);
  const discount = couponResult.discount || 0;
  const deliveryFee = fulfillmentType === "delivery" ? money(settings.deliveryFee || 4.99) : 0;
  const taxableAmount = money(subtotal - discount + deliveryFee);
  const tax = money(taxableAmount * 0.13);
  const total = money(taxableAmount + tax);

  return {
    available: true,
    items: calculatedItems,
    subtotal,
    discount,
    deliveryFee,
    tax,
    total,
    couponCode: couponResult.couponCode,
    couponMessage: couponResult.message,
    fulfillmentType,
    requestedTime: options.requestedTime || null,
    specialInstructions: options.specialInstructions || ""
  };
}

export async function createOrder(orderData) {
  const db = await connectDB();

  const items = Array.isArray(orderData.items) && orderData.items.length > 0
    ? orderData.items
    : [
        {
          size: orderData.size,
          crust: orderData.crust || "regular",
          sauce: orderData.sauce || "tomato",
          toppings: orderData.toppings || [],
          sides: orderData.sides || [],
          drinks: orderData.drinks || [],
          dips: orderData.dips || [],
          quantity: orderData.quantity || 1
        }
      ];

  const calculation = await calculateCartOrder(items, {
    fulfillmentType: orderData.fulfillmentType || "pickup",
    requestedTime: orderData.requestedTime || null,
    couponCode: orderData.couponCode || null,
    specialInstructions: orderData.specialInstructions || ""
  });

  if (!calculation.available) {
    return {
      success: false,
      message: calculation.message
    };
  }

  const order = {
    source: orderData.source || "ai-agent",
    type: "cart-order",
    items: calculation.items,
    item: calculation.items[0]?.item || "pizza",
    size: calculation.items[0]?.size,
    crust: calculation.items[0]?.crust,
    sauce: calculation.items[0]?.sauce,
    toppings: calculation.items[0]?.toppings || [],
    sides: calculation.items[0]?.sides || [],
    drinks: calculation.items[0]?.drinks || [],
    dips: calculation.items[0]?.dips || [],
    quantity: calculation.items[0]?.quantity || 1,
    subtotal: calculation.subtotal,
    discount: calculation.discount,
    deliveryFee: calculation.deliveryFee,
    tax: calculation.tax,
    total: calculation.total,
    couponCode: calculation.couponCode,
    couponMessage: calculation.couponMessage,
    fulfillmentType: calculation.fulfillmentType,
    requestedTime: calculation.requestedTime,
    specialInstructions: calculation.specialInstructions,
    status: orderData.requestedTime ? "Scheduled" : "Order Received",
    statusHistory: buildStatusHistory(orderData.requestedTime ? "Scheduled" : "Order Received"),
    customerName: orderData.customerName || "Guest",
    phone: orderData.phone || "",
    address: orderData.address || "",
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const result = await db.collection("orders").insertOne(order);

  return {
    success: true,
    orderId: result.insertedId.toString(),
    status: order.status,
    subtotal: order.subtotal,
    discount: order.discount,
    deliveryFee: order.deliveryFee,
    tax: order.tax,
    total: order.total,
    description: buildOrderDescription(order, result.insertedId.toString())
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

  const items =
    Array.isArray(order.items) && order.items.length > 0
      ? order.items
      : [buildSingleOrderItem(order)];

  const description = buildOrderDescription(order, orderId);

  return {
    found: true,
    orderId,
    status: order.status || "Order Received",
    source: order.source || "ai-agent",
    items,
    subtotal: order.subtotal || 0,
    discount: order.discount || 0,
    deliveryFee: order.deliveryFee || 0,
    tax: order.tax || 0,
    total: order.total || 0,
    description,
    order
  };
}

export async function prepareReorder(orderId) {
  const statusResult = await getOrderStatus(orderId);

  if (!statusResult.found) {
    return statusResult;
  }

  const order = statusResult.order;
  const items =
    Array.isArray(order.items) && order.items.length > 0
      ? order.items
      : [buildSingleOrderItem(order)];

  const calculation = await calculateCartOrder(items, {
    fulfillmentType: order.fulfillmentType || "pickup",
    couponCode: order.couponCode || null,
    specialInstructions: order.specialInstructions || ""
  });

  if (!calculation.available) {
    return {
      found: false,
      message: calculation.message
    };
  }

  return {
    found: true,
    pendingOrder: {
      source: "ai-agent-reorder",
      items: calculation.items,
      fulfillmentType: calculation.fulfillmentType,
      couponCode: calculation.couponCode,
      specialInstructions: calculation.specialInstructions,
      subtotal: calculation.subtotal,
      discount: calculation.discount,
      deliveryFee: calculation.deliveryFee,
      tax: calculation.tax,
      total: calculation.total
    },
    description:
      `I found your previous order and prepared it again with current pricing.\n\n` +
      buildOrderDescription(
        {
          ...order,
          items: calculation.items,
          subtotal: calculation.subtotal,
          discount: calculation.discount,
          deliveryFee: calculation.deliveryFee,
          tax: calculation.tax,
          total: calculation.total,
          status: "Pending Confirmation"
        },
        orderId
      )
  };
}

export async function cancelOrder(orderId) {
  const db = await connectDB();

  if (!ObjectId.isValid(orderId)) {
    return {
      success: false,
      message: "Invalid order ID."
    };
  }

  const order = await db.collection("orders").findOne({
    _id: new ObjectId(orderId)
  });

  if (!order) {
    return {
      success: false,
      message: "Order not found."
    };
  }

  if (["Cancelled", "Delivered", "Completed"].includes(order.status)) {
    return {
      success: false,
      message: `This order cannot be cancelled because its current status is ${order.status}.`
    };
  }

  await db.collection("orders").updateOne(
    { _id: new ObjectId(orderId) },
    {
      $set: {
        status: "Cancelled",
        updatedAt: new Date()
      },
      $push: {
        statusHistory: {
          status: "Cancelled",
          time: new Date()
        }
      }
    }
  );

  return {
    success: true,
    message: `Order ${orderId} has been cancelled.`
  };
}