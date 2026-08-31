import { Elements } from "@stripe/react-stripe-js";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { stripePromise } from "../stripeClient";
import PaymentSetupForm from "./PaymentSetupForm";

const emptyProfile = {
  email: "",
  fullName: "",
  phone: "",
  address: {
    line1: "",
    line2: "",
    city: "",
    province: "ON",
    postalCode: "",
    country: "CA",
    deliveryInstructions: ""
  },
  paymentSummary: null,
  profileComplete: false,
  paymentReady: false
};

function detectCardBrand(cardNumber = "") {
  const number = cardNumber.replace(/\D/g, "");

  if (/^4/.test(number)) {
    return "Visa";
  }

  if (
    /^(5[1-5]|2(2[2-9]|[3-6][0-9]|7[01]|720))/.test(number)
  ) {
    return "Mastercard";
  }

  if (/^3[47]/.test(number)) {
    return "American Express";
  }

  if (/^(6011|65|64[4-9])/.test(number)) {
    return "Discover";
  }

  if (/^35/.test(number)) {
    return "JCB";
  }

  if (/^3(0[0-5]|[68])/.test(number)) {
    return "Diners Club";
  }

  if (/^62/.test(number)) {
    return "UnionPay";
  }

  return "";
}

function formatCardNumber(value = "") {
  const digits = value
    .replace(/\D/g, "")
    .slice(0, 16);

  return digits
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

function SettingsModal({ onClose, theme = "dark" }) {
  const { getToken } = useAuth();

  const expiryYearRef = useRef(null);

  const [tab, setTab] = useState("profile");
  const [profile, setProfile] = useState(emptyProfile);
  const [clientSecret, setClientSecret] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [cardDetails, setCardDetails] = useState({
    cardNumber: "",
    expiryMonth: "",
    expiryYear: "",
    cvv: "",
    cardholderName: ""
  });

  const cardBrand = detectCardBrand(
    cardDetails.cardNumber
  );

  async function authorizedFetch(path, options = {}) {
    const token = await getToken();

    return fetch(
      `${import.meta.env.VITE_API_URL}${path}`,
      {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(options.headers || {})
        }
      }
    );
  }

  useEffect(() => {
    async function loadProfile() {
      try {
        const response =
          await authorizedFetch("/api/profile");

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error);
        }

        setProfile({
          ...emptyProfile,
          ...data,
          address: {
            ...emptyProfile.address,
            ...(data.address || {})
          }
        });
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  function changeProfile(event) {
    setProfile(previous => ({
      ...previous,
      [event.target.name]:
        event.target.value
    }));
  }

  function changeAddress(event) {
    setProfile(previous => ({
      ...previous,
      address: {
        ...previous.address,
        [event.target.name]:
          event.target.value
      }
    }));
  }

  function handleCardNumberChange(event) {
    const formattedNumber =
      formatCardNumber(
        event.target.value
      );

    setCardDetails(previous => ({
      ...previous,
      cardNumber: formattedNumber
    }));
  }

  function handleExpiryMonthChange(event) {
    let value = event.target.value
      .replace(/\D/g, "")
      .slice(0, 2);

    if (value.length === 2) {
      const month = Number(value);

      if (month < 1 || month > 12) {
        return;
      }
    }

    setCardDetails(previous => ({
      ...previous,
      expiryMonth: value
    }));

    if (value.length === 2) {
      setTimeout(() => {
        expiryYearRef.current?.focus();
      }, 0);
    }
  }

  function handleExpiryYearChange(event) {
    const value = event.target.value
      .replace(/\D/g, "")
      .slice(0, 2);

    setCardDetails(previous => ({
      ...previous,
      expiryYear: value
    }));
  }

  function handleCvvChange(event) {
    const value = event.target.value
      .replace(/\D/g, "")
      .slice(0, 4);

    setCardDetails(previous => ({
      ...previous,
      cvv: value
    }));
  }

  async function saveProfile(event) {
    event.preventDefault();

    setMessage("");
    setError("");

    try {
      const response =
        await authorizedFetch(
          "/api/profile",
          {
            method: "PUT",
            body: JSON.stringify({
              fullName: profile.fullName,
              phone: profile.phone,
              address: profile.address
            })
          }
        );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      setProfile(data);

      setMessage(
        "Your details were saved successfully."
      );
    } catch (error) {
      setError(error.message);
    }
  }

  async function startPaymentSetup() {
    setError("");
    setMessage("");

    if (
      !cardDetails.cardNumber ||
      !cardDetails.expiryMonth ||
      !cardDetails.expiryYear ||
      !cardDetails.cvv ||
      !cardDetails.cardholderName
    ) {
      setError(
        "Please fill in all card details."
      );

      return;
    }

    if (!consent) {
      setError(
        "Please agree to securely save this payment method."
      );

      return;
    }

    try {
      const response =
        await authorizedFetch(
          "/api/payments/setup-intent",
          {
            method: "POST",
            body: JSON.stringify({
              consentGiven: true
            })
          }
        );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      setClientSecret(
        data.clientSecret
      );
    } catch (error) {
      setError(error.message);
    }
  }

  async function removePayment() {
    try {
      const response =
        await authorizedFetch(
          "/api/payments/default",
          {
            method: "DELETE"
          }
        );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      setProfile(previous => ({
        ...previous,
        paymentSummary: null,
        paymentReady: false
      }));

      setClientSecret("");

      setMessage(
        "Saved payment method removed."
      );
    } catch (error) {
      setError(error.message);
    }
  }

  if (loading) {
    return (
      <div className="accountOverlay">
        <div className="accountModal">
          Loading settings...
        </div>
      </div>
    );
  }

  return (
    <div className="accountOverlay">
      <div className="accountModal settingsModal">
        <div className="settingsHeader">
          <div>
            <p className="eyebrow">
              Customer preferences
            </p>

            <h2>
              Account Settings
            </h2>
          </div>

          <button
            className="accountClose"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="settingsTabs">
          <button
            className={
              tab === "profile"
                ? "settingsTab activeSettingsTab"
                : "settingsTab"
            }
            onClick={() =>
              setTab("profile")
            }
          >
            Personal details
          </button>

          <button
            className={
              tab === "address"
                ? "settingsTab activeSettingsTab"
                : "settingsTab"
            }
            onClick={() =>
              setTab("address")
            }
          >
            Delivery address
          </button>

          <button
            className={
              tab === "payment"
                ? "settingsTab activeSettingsTab"
                : "settingsTab"
            }
            onClick={() =>
              setTab("payment")
            }
          >
            Payment
          </button>
        </div>

        {message && (
          <div className="accountSuccess">
            {message}
          </div>
        )}

        {error && (
          <div className="accountError">
            {error}
          </div>
        )}

        {tab === "profile" && (
          <form
            className="accountForm"
            onSubmit={saveProfile}
          >
            <label>
              Full name

              <input
                name="fullName"
                value={profile.fullName}
                onChange={changeProfile}
                required
              />
            </label>

            <label>
              Email address

              <input
                value={profile.email}
                disabled
              />
            </label>

            <label>
              Phone number

              <input
                name="phone"
                value={profile.phone}
                onChange={changeProfile}
                placeholder="416-555-1234"
              />
            </label>

            <button className="accountPrimary">
              Save personal details
            </button>
          </form>
        )}

        {tab === "address" && (
          <form
            className="accountForm"
            onSubmit={saveProfile}
          >
            <label>
              Street address

              <input
                name="line1"
                value={
                  profile.address.line1
                }
                onChange={changeAddress}
                required
              />
            </label>

            <label>
              Apartment or unit

              <input
                name="line2"
                value={
                  profile.address.line2
                }
                onChange={changeAddress}
              />
            </label>

            <div className="accountFormGrid">
              <label>
                City

                <input
                  name="city"
                  value={
                    profile.address.city
                  }
                  onChange={
                    changeAddress
                  }
                  required
                />
              </label>

              <label>
                Province

                <input
                  name="province"
                  value={
                    profile.address.province
                  }
                  onChange={
                    changeAddress
                  }
                  required
                />
              </label>
            </div>

            <div className="accountFormGrid">
              <label>
                Postal code

                <input
                  name="postalCode"
                  value={
                    profile.address.postalCode
                  }
                  onChange={
                    changeAddress
                  }
                  required
                />
              </label>

              <label>
                Country

                <input
                  name="country"
                  value={
                    profile.address.country
                  }
                  onChange={
                    changeAddress
                  }
                  required
                />
              </label>
            </div>

            <label>
              Delivery instructions

              <textarea
                name="deliveryInstructions"
                value={
                  profile.address
                    .deliveryInstructions
                }
                onChange={
                  changeAddress
                }
                placeholder="Leave at the door, do not ring the bell..."
              />
            </label>

            <button className="accountPrimary">
              Save delivery address
            </button>
          </form>
        )}

        {tab === "payment" && (
          <div className="paymentSettings">
            {profile.paymentSummary ? (
              <div className="savedPaymentCard">
                <div>
                  <span className="savedCardBrand">
                    {
                      profile
                        .paymentSummary
                        .brand
                    }
                  </span>

                  <strong>
                    ••••{" "}
                    {
                      profile
                        .paymentSummary
                        .last4
                    }
                  </strong>
                </div>

                <span>
                  Expires{" "}
                  {
                    profile
                      .paymentSummary
                      .expMonth
                  }
                  /
                  {
                    profile
                      .paymentSummary
                      .expYear
                  }
                </span>

                <button
                  className="dangerButton"
                  onClick={
                    removePayment
                  }
                >
                  Remove payment method
                </button>
              </div>
            ) : (
              <div className="emptyPayment">
                <h3>
                  No saved payment method
                </h3>

                <p>
                  Add a card once and use it
                  for future confirmed
                  orders.
                </p>
              </div>
            )}

            {!clientSecret && (
              <>
                {!profile.paymentSummary && (
                  <div className="cardInputGroup">
                    <label>
                      Card number
                      {cardBrand
                        ? ` (${cardBrand})`
                        : ""}

                      <input
                        type="text"
                        inputMode="numeric"
                        value={
                          cardDetails.cardNumber
                        }
                        onChange={
                          handleCardNumberChange
                        }
                        placeholder="1234 5678 9012 3456"
                        maxLength="19"
                      />
                    </label>

                    <div className="cardRow">
                      <label>
                        Expiry (MM/YY)

                        <div className="expiryGroup">
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="MM"
                            value={
                              cardDetails.expiryMonth
                            }
                            onChange={
                              handleExpiryMonthChange
                            }
                            maxLength="2"
                          />

                          <span>/</span>

                          <input
                            ref={
                              expiryYearRef
                            }
                            type="text"
                            inputMode="numeric"
                            placeholder="YY"
                            value={
                              cardDetails.expiryYear
                            }
                            onChange={
                              handleExpiryYearChange
                            }
                            maxLength="2"
                          />
                        </div>
                      </label>

                      <label>
                        CVV

                        <input
                          type="text"
                          inputMode="numeric"
                          value={
                            cardDetails.cvv
                          }
                          onChange={
                            handleCvvChange
                          }
                          placeholder="123"
                          maxLength="4"
                        />
                      </label>
                    </div>

                    <label>
                      Cardholder name

                      <input
                        type="text"
                        value={
                          cardDetails.cardholderName
                        }
                        onChange={(e) =>
                          setCardDetails({
                            ...cardDetails,
                            cardholderName:
                              e.target.value
                          })
                        }
                        placeholder="John Doe"
                      />
                    </label>
                  </div>
                )}

                <label className="consentRow">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={event =>
                      setConsent(
                        event.target.checked
                      )
                    }
                  />

                  <span>
                    I authorize this app to
                    securely save this
                    payment method with
                    Stripe for future orders
                    that I explicitly
                    confirm.
                  </span>
                </label>

                <button
                  className="accountPrimary"
                  onClick={
                    startPaymentSetup
                  }
                  disabled={
                    !!profile.paymentSummary
                  }
                >
                  {profile.paymentSummary
                    ? "Replace payment method"
                    : "Add payment method"}
                </button>
              </>
            )}

            {clientSecret && (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme:
                      theme === "dark"
                        ? "night"
                        : "stripe",
                    variables: {
                      colorPrimary:
                        "#f97316"
                    }
                  }
                }}
              >
                <PaymentSetupForm
                  clientSecret={
                    clientSecret
                  }
                  cardDetails={
                    cardDetails
                  }
                  onSaved={
                    updatedProfile => {
                      setProfile(
                        updatedProfile
                      );

                      setClientSecret("");

                      setMessage(
                        "Payment method saved securely."
                      );
                    }
                  }
                />
              </Elements>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SettingsModal;