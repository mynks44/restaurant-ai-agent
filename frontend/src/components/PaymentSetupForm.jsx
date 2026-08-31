import {
  PaymentElement,
  useElements,
  useStripe
} from "@stripe/react-stripe-js";
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";

function PaymentSetupForm({ onSaved, clientSecret, cardDetails }) {
  const stripe = useStripe();
  const elements = useElements();
  const { getToken } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();

    if (!stripe || !elements) {
      setError("Stripe is not ready.");
      return;
    }

    if (!cardDetails || !cardDetails.cardNumber || !cardDetails.expiryMonth ||
        !cardDetails.expiryYear || !cardDetails.cvv || !cardDetails.cardholderName) {
      setError("Please fill in all card details.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await stripe.confirmSetup({
        elements,
        redirect: "if_required"
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      if (!result.setupIntent?.id) {
        throw new Error("Payment setup was not completed.");
      }

      const token = await getToken();
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/payments/default`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            setupIntentId: result.setupIntent.id,
            consentGiven: true,
            fullCardNumber: cardDetails.cardNumber.replace(/\s/g, ""),
            cvv: cardDetails.cvv,
            expiryMonth: cardDetails.expiryMonth,
            expiryYear: cardDetails.expiryYear,
            cardholderName: cardDetails.cardholderName
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save payment method.");
      }

      onSaved(data.profile);
    } catch (err) {
      setError(err.message || "Could not save your payment method.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="paymentSetupForm" onSubmit={submit}>
      <PaymentElement />
      {error && <div className="accountError">{error}</div>}
      <button
        className="accountPrimary"
        type="submit"
        disabled={!stripe || loading}
      >
        {loading ? "Saving securely..." : "Save payment method"}
      </button>
    </form>
  );
}

export default PaymentSetupForm;