import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./db.js";

import chatRoutes from "./routes/chatRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import menuRoutes from "./routes/menuRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import checkoutRoutes from "./routes/checkoutRoutes.js";

dotenv.config();

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://restaurant-ai-agent-three.vercel.app",
  process.env.FRONTEND_URL
].filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    console.error(`CORS blocked origin: ${origin}`);

    callback(
      new Error(`CORS blocked this origin: ${origin}`)
    );
  },
  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS"
  ],
  allowedHeaders: [
    "Content-Type",
    "Authorization"
  ],
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

app.options(/.*/, cors(corsOptions));

app.use(
  express.json({
    limit: "1mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb"
  })
);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message:
      "Restaurant AI Agent backend is running."
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Backend is healthy",
    environment:
      process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString()
  });
});

app.use("/api/chat", chatRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/checkout", checkoutRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

app.use((error, req, res, next) => {
  console.error("Server error:");
  console.error(error);

  if (
    error.message?.startsWith(
      "CORS blocked"
    )
  ) {
    return res.status(403).json({
      success: false,
      error: error.message
    });
  }

  res.status(
    error.status || error.statusCode || 500
  ).json({
    success: false,
    error:
      process.env.NODE_ENV === "production"
        ? "Internal server error."
        : error.message ||
          "Internal server error."
  });
});

const PORT = Number(
  process.env.PORT || 5000
);

async function startServer() {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(
        `Server running on http://localhost:${PORT}`
      );

      console.log(
        "MongoDB connected successfully"
      );

      console.log(
        "Allowed frontend origins:"
      );

      allowedOrigins.forEach(
        (origin) => {
          console.log(`- ${origin}`);
        }
      );
    });
  } catch (error) {
    console.error(
      "Database connection failed:"
    );

    console.error(error);

    process.exit(1);
  }
}

startServer();