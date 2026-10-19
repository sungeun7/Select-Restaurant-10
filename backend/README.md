## SR10 Cloud Run Backend

This backend provides cookie-based session authentication and basic initialization state.

### Environment variables
- `INSTANCE_CONNECTION_NAME`: Cloud SQL instance connection name
- `DB_USER`, `DB_PASS`, `DB_NAME` (default `sr10`)
- `SQL_IP_TYPE` (default `PRIVATE`)
- `SESSION_SECRET`: required; used to sign session cookies
- `MASTER_USERNAME`, `MASTER_PASSWORD`: seed master user if missing

### Local development
This repo currently includes only server code scaffolding. If you want local dev, install Node.js and run:
1. `npm i` (inside `backend/`)
2. set env vars (e.g. via `.env`)
3. `npm start`

### Deploy
Deploy this folder to Cloud Run with Node.js runtime (Docker build or Cloud Buildpacks),
and provide the environment variables in Cloud Run settings.

