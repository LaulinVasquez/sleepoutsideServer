# Sleepoutside: Server starter code

## Description

Use this as a starting point to complete the backed for the WDD 360 team activity: the SleepOutside web application. It scaffolds out a simple node backed that we will use to develop our own API.

## Prerequisites

- You must have Node installed. Visit [https://byui-cit.github.io/learning-modules/modules/general/node-installation/](https://byui-cit.github.io/learning-modules/modules/general/node-installation/) and skip to the Node section for instructions

## Setup

- `npm install`
- Save `.env.sample` as `.env` in the root of this project. You will need to add your own MongoDB connection string and username/password
- `npm run dev` starts up a local server.

### Global route errors

The error middleware returns `{ error: { statusCode, code, message } }` while
preserving the HTTP error status. For 401, 404, and 500 it also returns
`redirectTo` and `flash: { type: "error", message }` for frontend navigation.
Missing, malformed, invalid, and expired credentials produce 401. Unexpected
server errors use a generic public message. API responses never redirect to HTML.
Run regression tests with `npm run test:ci -- tests/unit/errors.test.ts`.

### Backlog2 API

- `POST /api/v1/users/password`, Bearer token, JSON `{ currentPassword, newPassword }`. Password length is 6–100; current password is required. Returns 200, 400, 401, or 409. Existing tokens retain their normal expiry.
- `POST /api/v1/orders/`, Bearer token, uses `OrderCreateRequest` in the served `swaggerDesign.json` (`/api/v1/api-docs`). The older `openapi.yaml` is not served.
- Orders contain `userId`, `name`, `shippingAddress`, `orderItems`, `taxAmount`, `shippingCost`, `totalPrice`, and request-only `cardNumber`, `cardExpiration` (MM/YY), `cardCode` (three digits). Each cart entry is one unit, including repeats; no quantity field is accepted as a multiplier. Catalog prices are authoritative. Tax is 6% of merchandise, excluding shipping; shipping is $10 + $2 per additional unit. Round merchandise prices and tax to cents; total includes all three amounts.
- Payment is simulated: only `4242424242424242` is accepted with a three-digit code and unexpired month (UTC, inclusive through month end). No card details are persisted or returned.
- The server supplies order ID, status and timestamps. Invalid requests return 400, missing/expired authentication 401, a mismatched userId 403, and persistence failures 500. Success returns 201 `{ order }`.
- Run `npm run test:ci -- tests/unit` and `npm run build`. Start with `npm run dev` using the existing MongoDB/JWT `.env` configuration. No database reseeding is required.
