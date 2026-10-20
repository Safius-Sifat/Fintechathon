# Wallet Payment Request Fixtures

Reference fixtures for Person 3 mobile QR scanning and payment drafting, satisfying milestone gate **`P4-W01`** and **`WQ03`**.

## Contents

- `index.html`: Interactive web page rendering QR codes and parameter details for both valid transfers and malformed/rejected request scenarios.
- `requests.json`: Machine-readable array of all test requests, expected parsing results, and standardized error codes (`ERC681_UNSUPPORTED_CHAIN`, `ERC681_DUPLICATE_PARAM`, `ERC681_UNKNOWN_FUNCTION`, `ERC681_INVALID_AMOUNT`, `ERC681_INVALID_ADDRESS`).

## Usage for Person 3

To test camera scanning and deep-linking on an Android or iOS device:

```bash
# Serve the directory locally
npx serve demo/wallet-requests -p 8080
```

1. Open `http://localhost:8080` (or host IP on mobile Wi-Fi).
2. Scan each QR code using the Mandate mobile app camera.
3. Verify that valid requests populate the draft send screen with exact recipient, asset, and base-unit amounts.
4. Verify that invalid requests reject natively and display the expected error without submitting a transaction.
