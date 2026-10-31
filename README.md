# SunPower SIMS

SunPower SIMS is a solar installation management workspace with public enquiry capture, role-based authentication, leads, surveys, quotes, projects, payments, and a responsive customer/staff UI.

## Run locally

1. Start PostgreSQL and create the `sunpower_sims` database.
2. Copy `server/.env.example` to `server/.env` and set a local `DATABASE_URL` and `JWT_SECRET`.
3. Copy `client/.env.example` to `client/.env`.
4. Run:

```powershell
npm install
npm run setup
npm run dev
```

The client runs at `http://localhost:5173` and the API runs at `http://localhost:5000`.

The seed creates demo staff accounts using the emails shown in `server/prisma/seed.js`. The local demo password is `Demo@1234`.

## Project structure

- `client/src/main.jsx` is the Vite bootstrap entrypoint.
- `client/src/app/App.jsx` contains the signed-in application shell and operational workflow screens.
- `client/src/pages/PublicPage.jsx` contains the public marketing and enquiry page.
- `client/src/pages/LoginPage.jsx` contains staff login, demo login, and customer registration.
- `client/src/shared/` contains the shared API client, error handling, and formatters.
- `client/src/styles.css` contains shared responsive styles.
- `server/src/modules/` contains feature-specific routes and services.
- `server/src/core/` contains shared infrastructure such as Prisma, events, logging, and uploads.
- `server/src/middlewares/` contains authentication, authorization, validation, and error handling.
- `server/prisma/` contains the database schema and seed data.

## Verification

```powershell
npm test
npm --workspace client run build
npm --workspace server exec prisma validate
```

Environment files and uploads are intentionally excluded from source control.
