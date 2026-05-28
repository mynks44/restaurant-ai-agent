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
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userText = input;

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        text: userText
      }
    ]);

    setInput("");
    setLoading(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL;

      console.log("VITE_API_URL:", apiUrl);

      if (!apiUrl) {
        throw new Error("VITE_API_URL is missing. Add it in Vercel environment variables.");
      }

      const response = await fetch(`${apiUrl}/api/chat`, {
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

      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error("Backend did not return JSON response.");
      }

      console.log("Backend response:", data);

      if (!response.ok) {
        throw new Error(data.error || `Backend error. Status: ${response.status}`);
      }

      if (data.state) {
        setState(data.state);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.reply || "Backend responded, but no reply field was found."
        }
      ]);
    } catch (error) {
      console.error("Frontend error:", error);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: error.message || "Backend is not responding."
        }
      ]);
    } finally {
      setLoading(false);
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

          {loading && (
            <div className="message assistant">
              Thinking... please wait.
            </div>
          )}
        </div>

        <div className="inputRow">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage();
            }}
            placeholder="Type your order..."
            disabled={loading}
          />
          <button onClick={sendMessage} disabled={loading}>
            {loading ? "Wait..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;