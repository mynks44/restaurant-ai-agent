import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import "./components/Account.css";
import { useAuth } from "./auth/AuthContext.jsx";
import AuthModal from "./components/AuthModal";
import SettingsModal from "./components/SettingsModal";
import { stripePromise } from "./stripeClient";

const defaultMenu = {
  pizzas: [
    {
      name: "Small Pizza",
      size: "small",
      price: 9.99
    },
    {
      name: "Medium Pizza",
      size: "medium",
      price: 12.99
    },
    {
      name: "Large Pizza",
      size: "large",
      price: 15.99
    },
    {
      name: "X-Large Pizza",
      size: "x-large",
      price: 18.99
    }
  ],
  toppings: [
    {
      name: "pepperoni",
      displayName: "Pepperoni",
      price: 2
    },
    {
      name: "extra cheese",
      displayName: "Extra Cheese",
      price: 2
    },
    {
      name: "mushrooms",
      displayName: "Mushrooms",
      price: 1.5
    },
    {
      name: "green peppers",
      displayName: "Green Peppers",
      price: 1.5
    },
    {
      name: "red onions",
      displayName: "Red Onions",
      price: 1.5
    },
    {
      name: "black olives",
      displayName: "Black Olives",
      price: 1.5
    },
    {
      name: "pineapple",
      displayName: "Pineapple",
      price: 1.5
    },
    {
      name: "jalapenos",
      displayName: "Jalapeños",
      price: 1.5
    },
    {
      name: "chicken",
      displayName: "Grilled Chicken",
      price: 2.5
    },
    {
      name: "bacon",
      displayName: "Bacon",
      price: 2.5
    },
    {
      name: "sausage",
      displayName: "Italian Sausage",
      price: 2.25
    },
    {
      name: "spinach",
      displayName: "Spinach",
      price: 1.5
    }
  ],
  crusts: [
    {
      name: "regular",
      displayName: "Regular Crust",
      price: 0
    },
    {
      name: "thin",
      displayName: "Thin Crust",
      price: 0
    },
    {
      name: "thick",
      displayName: "Thick Crust",
      price: 1.5
    },
    {
      name: "stuffed",
      displayName: "Stuffed Crust",
      price: 3
    }
  ],
  sauces: [
    {
      name: "tomato",
      displayName: "Classic Tomato Sauce",
      price: 0
    },
    {
      name: "bbq",
      displayName: "BBQ Sauce",
      price: 0
    },
    {
      name: "creamy garlic",
      displayName: "Creamy Garlic Sauce",
      price: 0
    },
    {
      name: "buffalo",
      displayName: "Spicy Buffalo Sauce",
      price: 0
    }
  ],
  sides: [
    {
      name: "garlic bread",
      displayName: "Garlic Bread",
      price: 5.99
    },
    {
      name: "potato wedges",
      displayName: "Potato Wedges",
      price: 6.49
    },
    {
      name: "chicken wings",
      displayName: "Chicken Wings",
      price: 11.99
    },
    {
      name: "caesar salad",
      displayName: "Caesar Salad",
      price: 7.99
    }
  ],
  drinks: [
    {
      name: "coke",
      displayName: "Coke",
      price: 2.49
    },
    {
      name: "diet coke",
      displayName: "Diet Coke",
      price: 2.49
    },
    {
      name: "sprite",
      displayName: "Sprite",
      price: 2.49
    },
    {
      name: "water",
      displayName: "Water",
      price: 1.99
    }
  ],
  dips: [
    {
      name: "creamy garlic dip",
      displayName: "Creamy Garlic Dip",
      price: 1.25
    },
    {
      name: "ranch dip",
      displayName: "Ranch Dip",
      price: 1.25
    },
    {
      name: "marinara dip",
      displayName: "Marinara Dip",
      price: 1.25
    },
    {
      name: "cheddar jalapeno dip",
      displayName: "Cheddar Jalapeño Dip",
      price: 1.25
    }
  ]
};

const initialSelection = {
  size: "medium",
  crust: "regular",
  sauce: "tomato",
  toppings: [],
  sides: [],
  drinks: [],
  dips: []
};

const suggestedPrompts = [
  "Show me the full menu",
  "I want a medium pizza with extra cheese and mushrooms",
  "Add my pizza to the cart",
  "Place my cart order",
  "Track my order"
];

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function displayName(item) {
  return item?.displayName || item?.name || "";
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function App() {
  const messagesEndRef = useRef(null);

  const {
    user,
    authLoading,
    logout,
    getToken
  } = useAuth();

  const [authOpen, setAuthOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("restaurant-ai-theme") || "dark";
  });

  const [activeMode, setActiveMode] = useState("chat");
  const [menuOpen, setMenuOpen] = useState(false);
  const [menu, setMenu] = useState(defaultMenu);

  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text:
        "Welcome to Restaurant AI Agent. I can show the menu, build an order, manage your cart, process a secure test payment, and track your order."
    }
  ]);

  const [input, setInput] = useState("");
  const [state, setState] = useState({});
  const [loading, setLoading] = useState(false);

  const [selection, setSelection] = useState(initialSelection);
  const [cart, setCart] = useState([]);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualOrder, setManualOrder] = useState(null);

  const [selectedPrompt, setSelectedPrompt] = useState(
    suggestedPrompts[0]
  );

  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem("restaurant-ai-theme", theme);
  }, [theme]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end"
    });
  }, [messages, loading]);

  useEffect(() => {
    const modalOpen =
      menuOpen ||
      authOpen ||
      settingsOpen;

    document.body.style.overflow = modalOpen
      ? "hidden"
      : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen, authOpen, settingsOpen]);

  useEffect(() => {
    function handleEscape(event) {
      if (event.key !== "Escape") {
        return;
      }

      setMenuOpen(false);
      setAuthOpen(false);
      setSettingsOpen(false);
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    let active = true;

    async function checkProfile() {
      try {
        const token = await getToken();

        if (!token) {
          return;
        }

        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/profile`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        if (!response.ok) {
          return;
        }

        const profile = await response.json();

        if (
          active &&
          (!profile.profileComplete ||
            !profile.paymentReady)
        ) {
          setSettingsOpen(true);
        }
      } catch (error) {
        console.error("Profile check error:", error);
      }
    }

    checkProfile();

    return () => {
      active = false;
    };
  }, [user, getToken]);

  useEffect(() => {
    let active = true;

    async function loadMenu() {
      try {
        const apiUrl =
          import.meta.env.VITE_API_URL;

        if (!apiUrl) {
          return;
        }

        const response = await fetch(
          `${apiUrl}/api/menu`
        );

        const data = await response.json();

        if (!response.ok || !active) {
          return;
        }

        setMenu({
          pizzas: data.pizzas?.length
            ? data.pizzas
            : defaultMenu.pizzas,
          toppings: data.toppings?.length
            ? data.toppings
            : defaultMenu.toppings,
          crusts: data.crusts?.length
            ? data.crusts
            : defaultMenu.crusts,
          sauces: data.sauces?.length
            ? data.sauces
            : defaultMenu.sauces,
          sides: data.sides?.length
            ? data.sides
            : defaultMenu.sides,
          drinks: data.drinks?.length
            ? data.drinks
            : defaultMenu.drinks,
          dips: data.dips?.length
            ? data.dips
            : defaultMenu.dips
        });
      } catch (error) {
        console.error("Menu load error:", error);
      }
    }

    loadMenu();

    return () => {
      active = false;
    };
  }, []);

  function findItem(collection, key) {
    return menu[collection]?.find(
      (item) =>
        item.name === key ||
        item.size === key
    );
  }

  function totalForSelection(orderSelection) {
    const pizza = menu.pizzas.find(
      (item) =>
        item.size === orderSelection.size
    );

    const crust = findItem(
      "crusts",
      orderSelection.crust
    );

    const sauce = findItem(
      "sauces",
      orderSelection.sauce
    );

    const toppingTotal =
      orderSelection.toppings.reduce(
        (sum, name) =>
          sum +
          (findItem("toppings", name)?.price ||
            0),
        0
      );

    const sideTotal =
      orderSelection.sides.reduce(
        (sum, name) =>
          sum +
          (findItem("sides", name)?.price ||
            0),
        0
      );

    const drinkTotal =
      orderSelection.drinks.reduce(
        (sum, name) =>
          sum +
          (findItem("drinks", name)?.price ||
            0),
        0
      );

    const dipTotal =
      orderSelection.dips.reduce(
        (sum, name) =>
          sum +
          (findItem("dips", name)?.price ||
            0),
        0
      );

    const subtotal =
      Number(pizza?.price || 0) +
      Number(crust?.price || 0) +
      Number(sauce?.price || 0) +
      toppingTotal +
      sideTotal +
      drinkTotal +
      dipTotal;

    const tax = subtotal * 0.13;
    const total = subtotal + tax;

    return {
      subtotal: Number(subtotal.toFixed(2)),
      tax: Number(tax.toFixed(2)),
      total: Number(total.toFixed(2))
    };
  }

  const currentTotal = useMemo(() => {
    return totalForSelection(selection);
  }, [selection, menu]);

  const cartTotal = useMemo(() => {
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

    const tax = subtotal * 0.13;
    const total = subtotal + tax;

    return {
      subtotal: Number(subtotal.toFixed(2)),
      tax: Number(tax.toFixed(2)),
      total: Number(total.toFixed(2))
    };
  }, [cart]);

  function toggleMulti(field, value) {
    setSelection((previous) => {
      const exists =
        previous[field].includes(value);

      return {
        ...previous,
        [field]: exists
          ? previous[field].filter(
              (item) => item !== value
            )
          : [...previous[field], value]
      };
    });
  }

  function addToCart() {
    const totals =
      totalForSelection(selection);

    setCart((previous) => [
      ...previous,
      {
        id: createId(),
        ...selection,
        quantity: 1,
        subtotal: totals.subtotal
      }
    ]);

    setManualOrder(null);
  }

  function removeFromCart(id) {
    setCart((previous) =>
      previous.filter(
        (item) => item.id !== id
      )
    );

    setManualOrder(null);
  }

  function clearCart() {
    setCart([]);
    setManualOrder(null);
  }

  async function handleLogout() {
    try {
      await logout();

      setAuthOpen(false);
      setSettingsOpen(false);
      setCart([]);
      setState({});
      setManualOrder(null);

      setMessages([
        {
          role: "assistant",
          text:
            "You have signed out. Sign in again to use saved delivery and payment details."
        }
      ]);
    } catch (error) {
      console.error("Sign out error:", error);
    }
  }

  async function placePaidOrder(
    itemsToOrder = cart
  ) {
    if (
      !Array.isArray(itemsToOrder) ||
      itemsToOrder.length === 0 ||
      manualLoading
    ) {
      return;
    }

    if (!user) {
      setAuthOpen(true);

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          text:
            "Please sign in before checkout so I can use your saved customer, delivery, and payment details."
        }
      ]);

      return;
    }

    setManualLoading(true);
    setManualOrder(null);

    try {
      const apiUrl =
        import.meta.env.VITE_API_URL;

      if (!apiUrl) {
        throw new Error(
          "VITE_API_URL is missing."
        );
      }

      const token = await getToken();

      if (!token) {
        throw new Error(
          "Please sign in again before checkout."
        );
      }

      const checkoutId = createId();

      let response = await fetch(
        `${apiUrl}/api/checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            checkoutId,
            items: itemsToOrder,
            fulfillmentType: "delivery",
            specialInstructions: ""
          })
        }
      );

      let data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Could not begin checkout."
        );
      }

      if (data.requiresAction) {
        const stripe = await stripePromise;

        if (!stripe) {
          throw new Error(
            "Stripe is not available."
          );
        }

        const actionResult =
          await stripe.handleNextAction({
            clientSecret: data.clientSecret
          });

        if (actionResult.error) {
          throw new Error(
            actionResult.error.message
          );
        }

        response = await fetch(
          `${apiUrl}/api/checkout/finalize`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              paymentIntentId:
                data.paymentIntentId
            })
          }
        );

        data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Could not finalize checkout."
          );
        }
      }

      if (!data.success || !data.order) {
        throw new Error(
          data.error ||
            "Order information was not returned."
        );
      }

      setManualOrder(data.order);
      setCart([]);

      setState((previous) => ({
        ...previous,
        lastOrderId:
          data.order.orderId,
        lastDetailedOrderId:
          data.order.orderId
      }));

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          text:
            `Payment completed and your order was placed successfully.\n\n` +
            `Order ID: ${data.order.orderId}\n` +
            `Status: ${data.order.status}\n` +
            `Total: $${formatMoney(
              data.order.total
            )}`
        }
      ]);
    } catch (error) {
      const errorMessage =
        error.message ||
        "Could not complete checkout.";

      setManualOrder({
        error: errorMessage
      });

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          text: errorMessage
        }
      ]);

      if (
        /settings|profile|delivery details|payment method/i.test(
          errorMessage
        )
      ) {
        setSettingsOpen(true);
      }
    } finally {
      setManualLoading(false);
    }
  }

  function applyCartAction(action) {
    if (!action?.type) {
      return;
    }

    if (
      action.type === "add_item" &&
      action.item
    ) {
      const itemSubtotal = Number(
        action.item.itemSubtotal ||
          action.item.subtotal ||
          0
      );

      const newItem = {
        id: createId(),
        size:
          action.item.size || "medium",
        crust:
          action.item.crust || "regular",
        sauce:
          action.item.sauce || "tomato",
        toppings: Array.isArray(
          action.item.toppings
        )
          ? action.item.toppings
          : [],
        sides: Array.isArray(
          action.item.sides
        )
          ? action.item.sides
          : [],
        drinks: Array.isArray(
          action.item.drinks
        )
          ? action.item.drinks
          : [],
        dips: Array.isArray(
          action.item.dips
        )
          ? action.item.dips
          : [],
        quantity: Number(
          action.item.quantity || 1
        ),
        subtotal: itemSubtotal
      };

      setCart((previous) => [
        ...previous,
        newItem
      ]);

      setManualOrder(null);
      return;
    }

    if (action.type === "remove_last") {
      setCart((previous) =>
        previous.slice(0, -1)
      );

      setManualOrder(null);
      return;
    }

    if (action.type === "clear_cart") {
      clearCart();
      return;
    }

    if (action.type === "order_placed") {
      setCart([]);

      if (action.order) {
        setManualOrder(action.order);
      }
    }
  }

  async function sendMessage(
    customMessage
  ) {
    const messageToSend =
      customMessage || input;

    if (
      !messageToSend.trim() ||
      loading
    ) {
      return;
    }

    setMessages((previous) => [
      ...previous,
      {
        role: "user",
        text: messageToSend.trim()
      }
    ]);

    setInput("");
    setLoading(true);

    try {
      const apiUrl =
        import.meta.env.VITE_API_URL;

      if (!apiUrl) {
        throw new Error(
          "VITE_API_URL is missing."
        );
      }

      const token = user
        ? await getToken()
        : null;

      const response = await fetch(
        `${apiUrl}/api/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            ...(token
              ? {
                  Authorization: `Bearer ${token}`
                }
              : {})
          },
          body: JSON.stringify({
            message: messageToSend.trim(),
            userId: user?.uid || "guest",
            state: {
              ...state,
              cart
            }
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "The backend returned an error."
        );
      }

      if (data.state) {
        const {
          cart: ignoredCart,
          ...cleanState
        } = data.state;

        setState(cleanState);
      }

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          text:
            data.reply ||
            "No reply was received."
        }
      ]);

      if (
        data.cartAction?.type ===
        "request_checkout"
      ) {
        const checkoutItems =
          Array.isArray(
            data.cartAction.items
          ) &&
          data.cartAction.items.length > 0
            ? data.cartAction.items
            : cart;

        await placePaidOrder(
          checkoutItems
        );
      } else if (data.cartAction) {
        applyCartAction(
          data.cartAction
        );
      }
    } catch (error) {
      console.error(
        "Frontend chat error:",
        error
      );

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          text:
            error.message ||
            "Something went wrong. Please try again."
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      sendMessage();
    }
  }

  function renderMenuSection(
    title,
    items,
    valueKey = "name"
  ) {
    return (
      <section className="menuSection">
        <h3>{title}</h3>

        <div className="menuGrid">
          {items.map((item) => (
            <div
              key={
                item[valueKey] ||
                item.name
              }
              className="menuItem"
            >
              <span>
                {displayName(item)}
              </span>

              <strong>
                ${formatMoney(item.price)}
              </strong>
            </div>
          ))}
        </div>
      </section>
    );
  }

  function renderOptions(
    title,
    field,
    items
  ) {
    return (
      <section className="manualBlock">
        <div className="blockTitle">
          <h3>{title}</h3>

          <span>
            {selection[field].length} selected
          </span>
        </div>

        <div className="chipGrid">
          {items.map((item) => {
            const active =
              selection[field].includes(
                item.name
              );

            return (
              <button
                key={item.name}
                type="button"
                className={
                  active
                    ? "optionChip activeChip"
                    : "optionChip"
                }
                onClick={() =>
                  toggleMulti(
                    field,
                    item.name
                  )
                }
              >
                <span>
                  {displayName(item)}
                </span>

                <small>
                  ${formatMoney(item.price)}
                </small>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="logoMark">
            RA
          </div>

          <div>
            <p className="eyebrow">
              Full-Stack AI Ordering System
            </p>

            <h1>
              Restaurant AI Agent
            </h1>
          </div>
        </div>

        <div className="topActions">
          <button
            type="button"
            className="secondaryButton"
            onClick={() =>
              setMenuOpen(true)
            }
          >
            View Full Menu
          </button>

          <button
            type="button"
            className="themeButton"
            onClick={() =>
              setTheme((currentTheme) =>
                currentTheme === "dark"
                  ? "light"
                  : "dark"
              )
            }
          >
            {theme === "dark"
              ? "☀️ Light"
              : "🌙 Dark"}
          </button>

          {!authLoading && (
            <>
              {user ? (
                <>
                  <button
                    type="button"
                    className="secondaryButton"
                    onClick={() =>
                      setSettingsOpen(true)
                    }
                  >
                    Settings
                  </button>

                  <button
                    type="button"
                    className="secondaryButton"
                    onClick={handleLogout}
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="secondaryButton"
                  onClick={() =>
                    setAuthOpen(true)
                  }
                >
                  Sign In
                </button>
              )}
            </>
          )}
        </div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">
            AI + Manual Ordering
          </p>

          <h2>
            Professional restaurant ordering
            assistant with secure customer
            profiles, a live cart, and saved
            payment checkout.
          </h2>

          <p>
            Build an order using natural
            language or the manual pizza
            builder. Signed-in customers can
            securely reuse saved delivery and
            payment details.
          </p>
        </div>

        <div className="heroStats">
          <div>
            <strong>
              AI Assistant
            </strong>

            <span>
              Natural language ordering
            </span>
          </div>

          <div>
            <strong>
              Live Cart
            </strong>

            <span>
              Add, remove, clear, and checkout
            </span>
          </div>

          <div>
            <strong>
              Secure Profile
            </strong>

            <span>
              Saved address and Stripe payment
            </span>
          </div>
        </div>
      </section>

      <main className="workspace">
        <section className="mainPanel">
          <div className="modeTabs">
            <button
              type="button"
              className={
                activeMode === "chat"
                  ? "activeTab"
                  : ""
              }
              onClick={() =>
                setActiveMode("chat")
              }
            >
              AI Assistant
            </button>

            <button
              type="button"
              className={
                activeMode === "manual"
                  ? "activeTab"
                  : ""
              }
              onClick={() =>
                setActiveMode("manual")
              }
            >
              Manual Order
            </button>
          </div>

          {activeMode === "chat" ? (
            <div className="chatArea">
              <div className="chatHeader">
                <div>
                  <p className="eyebrow">
                    Conversation Mode
                  </p>

                  <h2>
                    AI Restaurant Assistant
                  </h2>
                </div>

                <span className="liveBadge">
                  {user
                    ? "Signed In"
                    : "Guest Mode"}
                </span>
              </div>

              <div className="messages">
                {messages.map(
                  (message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      className={`messageRow ${
                        message.role ===
                        "user"
                          ? "userRow"
                          : "assistantRow"
                      }`}
                    >
                      <div
                        className={`messageBubble ${
                          message.role ===
                          "user"
                            ? "userBubble"
                            : "assistantBubble"
                        }`}
                      >
                        <span className="messageRole">
                          {message.role ===
                          "user"
                            ? "You"
                            : "Restaurant AI Agent"}
                        </span>

                        <p>
                          {message.text}
                        </p>
                      </div>
                    </div>
                  )
                )}

                {loading && (
                  <div className="messageRow assistantRow">
                    <div className="messageBubble assistantBubble">
                      <span className="messageRole">
                        Restaurant AI Agent
                      </span>

                      <p>
                        Checking the menu and
                        preparing a response...
                      </p>
                    </div>
                  </div>
                )}

                <div
                  ref={messagesEndRef}
                  aria-hidden="true"
                />
              </div>

              <div className="promptDropdownBar">
                <label htmlFor="quickPrompt">
                  Quick command
                </label>

                <div className="promptControls">
                  <select
                    id="quickPrompt"
                    value={selectedPrompt}
                    onChange={(event) =>
                      setSelectedPrompt(
                        event.target.value
                      )
                    }
                    disabled={loading}
                  >
                    {suggestedPrompts.map(
                      (prompt) => (
                        <option
                          key={prompt}
                          value={prompt}
                        >
                          {prompt}
                        </option>
                      )
                    )}
                  </select>

                  <button
                    type="button"
                    onClick={() =>
                      sendMessage(
                        selectedPrompt
                      )
                    }
                    disabled={loading}
                  >
                    Run
                  </button>
                </div>
              </div>

              <div className="inputArea">
                <input
                  value={input}
                  onChange={(event) =>
                    setInput(
                      event.target.value
                    )
                  }
                  onKeyDown={handleKeyDown}
                  placeholder="Example: Add a medium pizza with extra cheese to my cart"
                  disabled={loading}
                  aria-label="Message Restaurant AI Agent"
                />

                <button
                  type="button"
                  onClick={() =>
                    sendMessage()
                  }
                  disabled={
                    loading ||
                    !input.trim()
                  }
                >
                  {loading
                    ? "Sending..."
                    : "Send"}
                </button>
              </div>
            </div>
          ) : (
            <div className="manualArea">
              <div className="manualHeader">
                <div>
                  <p className="eyebrow">
                    Manual Builder
                  </p>

                  <h2>
                    Create an order manually
                  </h2>
                </div>

                <button
                  type="button"
                  className="secondaryButton"
                  onClick={() =>
                    setMenuOpen(true)
                  }
                >
                  Open Menu
                </button>
              </div>

              <div className="manualGrid">
                <section className="manualBlock">
                  <div className="blockTitle">
                    <h3>
                      Pizza Size
                    </h3>

                    <span>
                      Required
                    </span>
                  </div>

                  <div className="selectGrid">
                    {menu.pizzas.map(
                      (pizza) => (
                        <button
                          key={pizza.size}
                          type="button"
                          className={
                            selection.size ===
                            pizza.size
                              ? "selectCard selectedCard"
                              : "selectCard"
                          }
                          onClick={() =>
                            setSelection(
                              (previous) => ({
                                ...previous,
                                size: pizza.size
                              })
                            )
                          }
                        >
                          <strong>
                            {pizza.name}
                          </strong>

                          <span>
                            $
                            {formatMoney(
                              pizza.price
                            )}
                          </span>
                        </button>
                      )
                    )}
                  </div>
                </section>

                <section className="manualBlock">
                  <div className="blockTitle">
                    <h3>Crust</h3>

                    <span>
                      Choose one
                    </span>
                  </div>

                  <div className="selectGrid">
                    {menu.crusts.map(
                      (crust) => (
                        <button
                          key={crust.name}
                          type="button"
                          className={
                            selection.crust ===
                            crust.name
                              ? "selectCard selectedCard"
                              : "selectCard"
                          }
                          onClick={() =>
                            setSelection(
                              (previous) => ({
                                ...previous,
                                crust:
                                  crust.name
                              })
                            )
                          }
                        >
                          <strong>
                            {displayName(
                              crust
                            )}
                          </strong>

                          <span>
                            $
                            {formatMoney(
                              crust.price
                            )}
                          </span>
                        </button>
                      )
                    )}
                  </div>
                </section>

                <section className="manualBlock">
                  <div className="blockTitle">
                    <h3>Sauce</h3>

                    <span>
                      Choose one
                    </span>
                  </div>

                  <div className="selectGrid">
                    {menu.sauces.map(
                      (sauce) => (
                        <button
                          key={sauce.name}
                          type="button"
                          className={
                            selection.sauce ===
                            sauce.name
                              ? "selectCard selectedCard"
                              : "selectCard"
                          }
                          onClick={() =>
                            setSelection(
                              (previous) => ({
                                ...previous,
                                sauce:
                                  sauce.name
                              })
                            )
                          }
                        >
                          <strong>
                            {displayName(
                              sauce
                            )}
                          </strong>

                          <span>
                            $
                            {formatMoney(
                              sauce.price
                            )}
                          </span>
                        </button>
                      )
                    )}
                  </div>
                </section>

                {renderOptions(
                  "Toppings",
                  "toppings",
                  menu.toppings
                )}

                {renderOptions(
                  "Sides",
                  "sides",
                  menu.sides
                )}

                {renderOptions(
                  "Drinks",
                  "drinks",
                  menu.drinks
                )}

                {renderOptions(
                  "Dips",
                  "dips",
                  menu.dips
                )}
              </div>
            </div>
          )}
        </section>

        <aside className="cartPanel">
          <div className="cartHeader">
            <div>
              <p className="eyebrow">
                Live Cart
              </p>

              <h2>
                Order Summary
              </h2>
            </div>

            <span>
              {cart.length} item(s)
            </span>
          </div>

          <div className="currentPreview">
            <h3>
              Current Selection
            </h3>

            <p>
              {selection.size} pizza ·{" "}
              {selection.crust} crust ·{" "}
              {selection.sauce} sauce
            </p>

            <p>
              Toppings:{" "}
              {selection.toppings.length
                ? selection.toppings.join(
                    ", "
                  )
                : "None"}
            </p>

            <p>
              Sides:{" "}
              {selection.sides.length
                ? selection.sides.join(", ")
                : "None"}
            </p>

            <p>
              Drinks:{" "}
              {selection.drinks.length
                ? selection.drinks.join(
                    ", "
                  )
                : "None"}
            </p>

            <p>
              Dips:{" "}
              {selection.dips.length
                ? selection.dips.join(", ")
                : "None"}
            </p>

            <strong>
              $
              {formatMoney(
                currentTotal.total
              )}
            </strong>

            <button
              type="button"
              className="primaryWide"
              onClick={addToCart}
            >
              Add to Cart
            </button>
          </div>

          <div className="cartItems">
            {cart.length === 0 ? (
              <div className="emptyCart">
                <h3>
                  Your cart is empty
                </h3>

                <p>
                  Use Manual Order or the AI
                  Assistant to build your
                  order.
                </p>
              </div>
            ) : (
              cart.map((item, index) => (
                <div
                  className="cartItem"
                  key={
                    item.id ||
                    `${item.size}-${index}`
                  }
                >
                  <div>
                    <strong>
                      #{index + 1}{" "}
                      {item.quantity > 1
                        ? `${item.quantity} × `
                        : ""}
                      {item.size} pizza
                    </strong>

                    <p>
                      {item.crust} crust ·{" "}
                      {item.sauce} sauce
                    </p>

                    <p>
                      {item.toppings?.length
                        ? item.toppings.join(
                            ", "
                          )
                        : "No extra toppings"}
                    </p>

                    <span>
                      $
                      {formatMoney(
                        item.subtotal ||
                          item.itemSubtotal
                      )}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      removeFromCart(
                        item.id
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="totalBox">
            <div>
              <span>
                Subtotal
              </span>

              <strong>
                $
                {formatMoney(
                  cartTotal.subtotal
                )}
              </strong>
            </div>

            <div>
              <span>Tax</span>

              <strong>
                $
                {formatMoney(
                  cartTotal.tax
                )}
              </strong>
            </div>

            <div className="grandTotal">
              <span>Total</span>

              <strong>
                $
                {formatMoney(
                  cartTotal.total
                )}
              </strong>
            </div>
          </div>

          {cart.length > 0 && (
            <div className="cartActionRow">
              <button
                type="button"
                className="resetButton"
                onClick={clearCart}
                disabled={manualLoading}
              >
                Clear Cart
              </button>

              <button
                type="button"
                className="checkoutButton"
                disabled={manualLoading}
                onClick={() =>
                  placePaidOrder(cart)
                }
              >
                {manualLoading
                  ? "Processing..."
                  : user
                    ? "Secure Checkout"
                    : "Sign In to Checkout"}
              </button>
            </div>
          )}

          {manualOrder?.orderId && (
            <div className="successBox">
              <h3>
                Order Placed
              </h3>

              <p>Order ID:</p>

              <strong>
                {manualOrder.orderId}
              </strong>

              <p>
                Status:{" "}
                {manualOrder.status}
              </p>

              <p>
                Total: $
                {formatMoney(
                  manualOrder.total
                )}
              </p>
            </div>
          )}

          {manualOrder?.error && (
            <div className="errorBox">
              <h3>
                Checkout Error
              </h3>

              <p>
                {manualOrder.error}
              </p>
            </div>
          )}

          {state.lastOrderId && (
            <div className="successBox">
              <h3>
                Last Order
              </h3>

              <strong>
                {state.lastOrderId}
              </strong>
            </div>
          )}
        </aside>
      </main>

      {menuOpen && (
        <div
          className="modalOverlay"
          onClick={() =>
            setMenuOpen(false)
          }
        >
          <div
            className="menuModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="menuTitle"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modalHeader">
              <div>
                <p className="eyebrow">
                  Complete Restaurant Menu
                </p>

                <h2 id="menuTitle">
                  Restaurant AI Agent Menu
                </h2>
              </div>

              <button
                type="button"
                className="closeButton"
                aria-label="Close menu"
                onClick={() =>
                  setMenuOpen(false)
                }
              >
                ✕
              </button>
            </div>

            <div className="modalBody">
              {renderMenuSection(
                "Pizza Sizes",
                menu.pizzas,
                "size"
              )}

              {renderMenuSection(
                "Crust Options",
                menu.crusts
              )}

              {renderMenuSection(
                "Sauce Options",
                menu.sauces
              )}

              {renderMenuSection(
                "Toppings",
                menu.toppings
              )}

              {renderMenuSection(
                "Sides",
                menu.sides
              )}

              {renderMenuSection(
                "Drinks",
                menu.drinks
              )}

              {renderMenuSection(
                "Dips",
                menu.dips
              )}
            </div>
          </div>
        </div>
      )}

      {authOpen && (
        <AuthModal
          onClose={() =>
            setAuthOpen(false)
          }
          onSuccess={() => {
            setAuthOpen(false);
            setSettingsOpen(true);
          }}
        />
      )}

      {settingsOpen && user && (
        <SettingsModal
          theme={theme}
          onClose={() =>
            setSettingsOpen(false)
          }
        />
      )}
    </div>
  );
}

export default App;