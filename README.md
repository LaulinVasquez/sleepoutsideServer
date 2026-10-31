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
