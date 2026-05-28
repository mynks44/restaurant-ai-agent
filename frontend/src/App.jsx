import { useState } from "react";
import "./App.css";

function App() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hi! I am your restaurant AI agent. Try: I want a medium pizza with extra cheese."
    }
  ]);

  const [input, setInput] = useState("");
  const [state, setState] = useState({});

  async function sendMessage() {
    if (!input.trim()) return;

    const userText = input;

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        text: userText
      }
    ]);

    setInput("");

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: userText,
          userId: "guest",
          state
        })
      });

      const data = await response.json();

      if (data.state) {
        setState(data.state);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.reply || data.error || "No reply received."
        }
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Backend is not responding."
        }
      ]);
    }
  }

  return (
    <div className="page">
      <div className="chatBox">
        <h1>Restaurant AI Agent</h1>
        <p>Order pizza using natural language.</p>

        <div className="messages">
          {messages.map((message, index) => (
            <div key={index} className={`message ${message.role}`}>
              {message.text}
            </div>
          ))}
        </div>

        <div className="inputRow">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage();
            }}
            placeholder="Type your order..."
          />
          <button onClick={sendMessage}>Send</button>
        </div>
      </div>
    </div>
  );
}

export default App;