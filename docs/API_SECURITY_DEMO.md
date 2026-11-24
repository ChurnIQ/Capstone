# ChurnIQ – API Security (HTTP Basic Auth) – Demo Guide

## What was added (no new app, no CRUD, no RBAC)
| Item | File |
|---|---|
| Reusable Basic Auth middleware (env creds, timing-safe, 401) | `middleware/basicAuth.js` |
| Applied to every existing `/api/*` route (incl. `POST /api/predict`) | `routes/api.js` |
| Swagger UI at `/api-docs` (spec: `docs/openapi.js`) | `app.js` |
| Postman collection + environment | `postman/` |
| Tests | `basicAuth.test.js` |

Credentials live in `.env` (`BASIC_AUTH_USER`, `BASIC_AUTH_PASS`), never in code.
The dashboard keeps its login + 2FA session; API clients use Basic Auth.

## Setup (once)
1. `npm install` (adds swagger-ui-express)
2. Confirm `.env` has `BASIC_AUTH_USER=churniq_api` and `BASIC_AUTH_PASS=ChurnIQ@Demo2026`
3. `npm run dev` then open http://localhost:3000

## Demo A – Postman
1. Import `postman/ChurnIQ-Basic-Auth.postman_collection.json` and `postman/ChurnIQ-Local.postman_environment.json`; select environment **ChurnIQ Local**.
2. Folder **1. Basic Auth checks**:
   - Valid credentials → **200**
   - Incorrect password → **401**
   - Incorrect username → **401**
   - Missing credentials → **401**
3. Folder **2. Churn prediction**: valid → **200** with `churn_prediction`, `churn_probability`, `risk_category`; no/wrong creds → **401**; missing `customer_id` → **400**.
4. Collection → **Run**: all tests should be green.

## Demo B – Swagger UI
1. Open http://localhost:3000/api-docs
2. `POST /api/predict` → Try it out → Execute without authorizing → **401**.
3. Click **Authorize**, enter `churniq_api` / `ChurnIQ@Demo2026`.
4. Execute `POST /api/predict` again → **200** with a prediction.
5. Authorize → Logout, enter a wrong password, execute → **401**.

## Demo C – curl (optional)
```
curl -i http://localhost:3000/api/stats                                  # 401
curl -i -u churniq_api:wrong http://localhost:3000/api/stats             # 401
curl -i -u churniq_api:ChurnIQ@Demo2026 http://localhost:3000/api/stats  # 200
```

## Automated tests
`node --test basicAuth.test.js` (10 tests: valid, wrong user/pass, missing, malformed, fail-closed, session still works).

## Deploying
Set `BASIC_AUTH_USER` and `BASIC_AUTH_PASS` (strong password) in Vercel → Environment Variables, otherwise Basic requests are rejected (fail closed).
