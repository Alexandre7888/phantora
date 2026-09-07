When implementing or updating the credit recharge and payment system via InfinitePay
- **Do not rely solely on simple URL parameters for success verification** (e.g., `?sucesso=1&creditos=10`) as it is insecure.
- **Step 1: Order Generation**: Generate a unique `order_nsu` combining the user's public ID and a timestamp (e.g., `recarga_usr_1b42..._1786487957011`).
- **Step 2: Pre-registration**: Save this `order_nsu` in the user's Firebase node as a "Pending" order, storing the amount of credits they should receive.
- **Step 3: API Call**: Make a POST request to `https://code-hub-eta.vercel.app/api/payment.js` with payload:
  ```json
  {
    "order_nsu": "recarga_...",
    "items": [{ "quantity": 1, "price": 500, "description": "..." }],
    "redirect_success": "URL_AQUI",
    "redirect_fail": "URL_AQUI"
  }
  ```
  *(Note: price must be in cents)*
- **Step 4: Redirection**: Redirect the user to the `url` returned by the API.
- **Step 5: Verification on Return**: When the user returns to `redirect_success`, the URL will contain parameters like `?capture_method=pix&transaction_id=...&order_nsu=...&receipt_url=...`.
- **Step 6: Validation & Fulfillment**: Read the `order_nsu` from the URL, check Firebase to ensure it exists and is marked as "Pending". If valid, grant the credits, save the `transaction_id` and `receipt_url`, and mark the order as "Completed" to prevent reuse.
- **Step 7: Cleanup**: Clean the URL parameters using `window.history.replaceState` so the user doesn't refresh the page and trigger the logic again.