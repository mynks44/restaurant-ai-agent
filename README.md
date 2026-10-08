# Restaurant AI Agent

A full-stack AI-powered restaurant ordering system where users can order pizza using natural language, manage a live cart, complete secure Stripe test checkout, track orders, reorder previous orders, and view saved order data in MongoDB.

Live Demo: https://restaurant-ai-agent-three.vercel.app/

GitHub: https://github.com/mynks44/restaurant-ai-agent

---

## Project Overview

Restaurant AI Agent is a full-stack web application designed to demonstrate how an AI agent can complete real application workflows beyond simple chatbot replies.

The AI assistant can understand customer intent, interact with backend tools, manage a live cart, calculate order totals, place orders, retrieve saved order details, and support reordering previous orders.

Users can order in two ways:

1. AI Assistant: order using natural language commands.
2. Manual Order Builder: build an order by selecting pizza size, crust, sauce, toppings, sides, drinks, and dips.

The project includes frontend, backend, database, AI integration, secure test checkout, deployment, and real order persistence.

---

## Demo Highlights

In the screen recording, the following workflow is demonstrated:

- Opening the deployed web application
- Viewing the restaurant menu
- Ordering pizza using natural language
- Adding items to the live cart through AI commands
- Building an order manually
- Removing and clearing cart items
- Completing secure Stripe test checkout
- Receiving an order confirmation with an order ID
- Tracking full order details using the order ID
- Reordering a previous order
- Opening MongoDB Atlas to verify saved order data

---

## Key Features

### AI Ordering

Users can type natural language commands such as:

```txt
I want a medium pizza with extra cheese and mushrooms
Add it to cart
Place my cart order
Give me full details about this order ORDER_ID
Place the same order again
```

The AI agent understands the request and selects the correct backend action.

---

### Live Cart Management

The AI can manage the cart using commands:

- Add item to cart
- Remove last item from cart
- Clear cart
- Place cart order
- Continue adding multiple items

The cart updates in real time on the frontend.

---

### Manual Order Builder

Users can also build an order manually by selecting:

- Pizza size
- Crust
- Sauce
- Toppings
- Sides
- Drinks
- Dips

This provides a traditional UI option for users who prefer clicking instead of chatting.

---

### Secure Stripe Test Checkout

The project includes Stripe test checkout for secure payment flow simulation.

This is a demo implementation using Stripe test mode. No real payment is processed.

---

### Order Tracking

After placing an order, the system generates an order ID.

Users can ask the AI:

```txt
Give me full details about this order ORDER_ID
```

The backend retrieves the saved order from MongoDB and returns full order details, including:

- Order ID
- Status
- Pizza details
- Crust
- Sauce
- Toppings
- Sides
- Drinks
- Dips
- Subtotal
- Tax
- Total

---

### Reorder Previous Orders

Users can repeat a previous order using the AI assistant.

Example:

```txt
Place the same order again
```

or

```txt
ORDER_ID place this same order again
```

The AI retrieves the previous order, prepares it again, recalculates pricing, and asks for confirmation.

---

### MongoDB Persistence

Orders and chat data are saved in MongoDB Atlas.

The MongoDB order document stores data such as:

- Order items
- Pizza configuration
- Cart items
- Status
- Subtotal
- Tax
- Total
- Payment/checkout status
- Created timestamp

---

### Dark and Light Theme

The frontend supports both dark mode and light mode with responsive, user-friendly styling.

---

## Tech Stack

### Frontend

- React
- Vite
- JavaScript
- CSS
- Vercel

### Backend

- Node.js
- Express.js
- REST APIs
- Render

### Database

- MongoDB Atlas

### AI

- Gemini API

### Payment

- Stripe test checkout

### Deployment

- Frontend deployed on Vercel
- Backend deployed on Render
- Database hosted on MongoDB Atlas

---

## System Architecture

```txt
User
  ↓
React Frontend
  ↓
Express Backend API
  ↓
AI Agent with Gemini API
  ↓
Backend Tools
  ↓
MongoDB Atlas
  ↓
Response returned to frontend
```

The AI agent does not directly change the UI. Instead, it returns structured actions to the frontend, such as adding an item to the cart or placing an order.

---

## AI Agent Flow

```txt
User message
  ↓
Frontend sends message to backend
  ↓
Backend sends request to Gemini API
  ↓
AI understands intent
  ↓
Backend runs matching tool/action
  ↓
MongoDB stores or retrieves data
  ↓
Frontend updates chat, cart, or order status
```

---

## Example AI Commands

```txt
Show me the full menu
```

```txt
I want a medium pizza with extra cheese and mushrooms
```

```txt
Add it to cart
```

```txt
Add a large pizza with bacon and coke to the cart
```

```txt
Remove last item from cart
```

```txt
Clear cart
```

```txt
Place cart order
```

```txt
Give me full details about this order ORDER_ID
```

```txt
Place the same order again
```

---

## Project Structure

```txt
restaurant-ai-agent/
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── auth/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
│
├── backend/
│   ├── routes/
│   │   ├── chatRoutes.js
│   │   ├── orderRoutes.js
│   │   └── menuRoutes.js
│   ├── agent.js
│   ├── tools.js
│   ├── db.js
│   ├── seed.js
│   ├── server.js
│   └── package.json
│
└── README.md
```

---

## Backend API Overview

### Chat API

```txt
POST /api/chat
```

Used by the frontend to send user messages to the AI agent.

---

### Menu API

```txt
GET /api/menu
```

Returns menu data such as pizza sizes, toppings, crusts, sauces, sides, drinks, and dips.

---

### Order API

```txt
GET /api/orders/:id
```

Gets full order details by order ID.

```txt
POST /api/orders/manual
```

Places a manual order.

```txt
PATCH /api/orders/:id/status
```

Updates order status.

```txt
PATCH /api/orders/:id/cancel
```

Cancels an order if cancellation is allowed.

---

## Environment Variables

Create a `.env` file inside the backend folder.

```env
MONGODB_URI=your_mongodb_connection_string
DB_NAME=restaurantAgentDB
GEMINI_API_KEY=your_gemini_api_key
FRONTEND_URL=http://localhost:5173
STRIPE_SECRET_KEY=your_stripe_secret_key
```

For frontend, create a `.env` file inside the frontend folder.

```env
VITE_API_URL=http://localhost:5000
```

For production, use the deployed backend URL:

```env
VITE_API_URL=https://your-render-backend-url.onrender.com
```

Important: Never commit `.env` files to GitHub.

---

## Run Locally

### 1. Clone the repository

```bash
git clone https://github.com/mynks44/restaurant-ai-agent.git
cd restaurant-ai-agent
```

---

### 2. Install backend dependencies

```bash
cd backend
npm install
```

---

### 3. Start backend

```bash
npm start
```

Backend runs on:

```txt
http://localhost:5000
```

---

### 4. Install frontend dependencies

Open a new terminal:

```bash
cd frontend
npm install
```

---

### 5. Start frontend

```bash
npm run dev
```

Frontend runs on:

```txt
http://localhost:5173
```

---

## Database Collections

The project uses MongoDB Atlas with collections such as:

```txt
menu
toppings
crusts
sauces
sides
drinks
dips
orders
chatMessages
users
profiles
```

The `orders` collection stores completed orders with item details, total price, tax, status, and timestamps.

---

## Security Notes

This project uses environment variables for sensitive keys.

Do not expose:

- MongoDB connection string
- Gemini API key
- Stripe secret key
- Render environment variables
- Vercel environment variables
- User payment details
- Real customer address or phone number

Stripe is used in test mode for demonstration.

---

## Future Improvements

Planned future features include:

- Order history by customer account
- Search previous orders by order ID or date
- Repeat orders from history using AI commands
- Long-term chat memory for returning users
- Personalized recommendations
- Delivery time estimation
- Admin dashboard for managing orders
- Store analytics and sales insights
- Better order status timeline
- Support for multiple restaurants
- Email receipt after checkout
- Role-based admin access

---

## What I Learned

This project helped me improve my understanding of:

- Full-stack application development
- React frontend architecture
- Node.js and Express backend development
- REST API design
- MongoDB database design
- AI agent workflows
- Gemini API integration
- Stripe test checkout
- Frontend-backend communication
- Deployment with Vercel and Render
- Real-world product workflow design

The biggest learning was understanding that an AI agent is more than a chatbot. A chatbot only replies with text, but an AI agent can understand user intent, call backend tools, update application state, save data, retrieve data, and complete real tasks.

---

## Author

Mayank Surani

GitHub: https://github.com/mynks44

Live Project: https://restaurant-ai-agent-three.vercel.app/
