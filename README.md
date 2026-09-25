# PropelCRM — Broker & Agent CRM (Full Stack)

A complete, working full-stack implementation of the Broker & Agent CRM described in your
requirement document, built with **React + Redux Toolkit** on the frontend and
**Node.js + Express + PostgreSQL + Socket.IO** on the backend — matching the dark-navy
sidebar / white-card UI theme you approved.

```
project/
├── backend/     Node.js + Express + PostgreSQL API, JWT auth, Socket.IO live tracking
└── frontend/    React 18 + Redux Toolkit + React Router + Chart.js
```

## 1. Backend setup

```bash
cd backend
npm install
cp .env.example .env        # then edit DB credentials + JWT_SECRET
```

Make sure PostgreSQL is running locally and a database exists matching `DB_NAME` in `.env`
(e.g. `createdb broker_agent_crm`).

```bash
npm run db:migrate   # creates all tables from the Sequelize models
npm run db:seed      # optional: adds the one demo broker, 2 agents, projects, leads & follow-ups
npm run dev           # starts the API on http://localhost:5000 with nodemon
```

### Authentication: Firebase Phone Auth (real SMS OTP, no passwords)

There is only **one Broker** — created once via the seed script (or directly in the
database); there is no self-registration flow. The Broker adds every Agent from the
**Agents** page, giving each one a **Full Name**, a **unique Phone Number**, and an
**optional Email**.

OTP delivery is handled by **Firebase Phone Authentication** — Firebase sends the real
SMS directly from Google's infrastructure and verifies it in the browser; our backend
never generates or sends the code itself. It only verifies the resulting token.

**One-time Firebase setup:**
1. Create a project at https://console.firebase.google.com (free).
2. **Authentication → Sign-in method** → enable **Phone**.
3. **Authentication → Settings → Authorized domains** → confirm `localhost` is listed
   (add your production domain later when you deploy).
4. **Project Settings → General → Your apps** → add a Web app → copy the config values
   into `frontend/.env` (see `frontend/.env.example`).
5. **Project Settings → Service Accounts** → Generate new private key → copy
   `project_id`, `client_email` and `private_key` from the downloaded JSON into
   `backend/.env` (see `backend/.env.example` — keep the `\n` sequences literal).
6. Phone Auth has a small free daily SMS quota; if you exceed it, Firebase asks you to
   enable the Blaze (pay-as-you-go) plan — SMS costs a fraction of a cent each.

**Login flow:**
1. User enters their phone number → frontend calls Firebase's `signInWithPhoneNumber`
   (behind an invisible reCAPTCHA) → Firebase texts a real 6-digit OTP to that phone.
2. A **60-second countdown** is shown; while it's running, "Resend OTP" is disabled.
   If it hits zero before the user finishes, they can tap **Resend OTP** to get a new code
   sent to the same real number.
3. User enters the OTP → Firebase verifies it client-side and returns a signed ID token.
4. Frontend sends that ID token to `POST /api/auth/firebase-login` → backend verifies it
   with the Firebase Admin SDK, extracts the phone number, and looks up the account:
   - Found → returns `{ user, token }` and the frontend redirects to
     `/broker/dashboard` or `/agent/dashboard`.
   - Not found → `404 { message: "Account not found. Please contact the broker." }`
     (and the frontend signs the user back out of the Firebase session).

Demo login after seeding (once Firebase is configured):
- Broker: `+919820012345`
- Agent: `+919823011234` (Vikram Rao)

### Key backend features
- Firebase Phone Auth verification (via Firebase Admin SDK), roles: `broker` / `agent`
- Multi-tenant scoping — every resource (`brokerId`) is isolated per brokerage
- Full CRUD: Projects, Leads, Clients (closed leads), Agents (with project assignment), Meetings/Calendar, Follow-ups, Settings
- Lead assignment, stage history tracking, agent feedback (Positive/Neutral/Negative)
- Reports endpoints: overview KPIs, leads-by-status, leads-by-source, monthly trend, agent performance
- Activity/audit History log, auto-recorded on every important action
- Real-time agent location tracking over Socket.IO (with REST fallback), online/offline status

## 2. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env    # points at the backend API + socket URL
npm run dev              # starts Vite dev server on http://localhost:5173
```

The Vite dev server proxies `/api` to `http://localhost:5000`, so no CORS setup is
needed in development.

### Key frontend features
- Firebase Phone Auth login: phone → real SMS OTP → 60s countdown → resend → verify
- Redux Toolkit slices for auth (Firebase token exchange), projects, leads, agents, meetings, follow-ups, reports, history, tracking
- Role-aware routing (`/broker/...` vs `/agent/...`) with `ProtectedRoute`
- Broker sidebar: Dashboard, Projects, Leads, **Clients**, Agents, Agent Tracking, Meetings,
  Calendar, Reports, History, Settings
- Agent sidebar: Dashboard, My Leads, Calendar, Reports, History, Settings — **no Meetings tab**;
  scheduling stays broker-only
- **Clients page** — automatically lists every lead whose stage is `Closed` (i.e. they've
  bought a property from us), with the property, phone and handling agent
- Shared components reused by both roles (Calendar, History, Settings, Leads table)
- Chart.js dashboards (line, bar, doughnut) for reports
- Live agent-tracking map view fed by Socket.IO events
- Matches the approved UI: dark navy sidebar, white cards, blue primary actions, badges,
  progress bars, KPI cards

## 3. Data model & permissions

```
Broker
 ├── Agents (brokerId)
 ├── Projects (brokerId)
 ├── Agent ↔ Project   (N:M via agent_projects — which agents can work which projects)
 └── Leads (brokerId + projectId + agentId + createdBy/createdByRole)
       └── FollowUps (leadId + agentId) — the interaction timeline
```

- **Broker**: full CRUD on Projects, Agents, Leads. Can import leads from CSV/Excel,
  assign/reassign leads to agents, assign projects to agents, and see everything.
- **Agent**: sees only projects assigned to them and leads assigned to them.
  Can create leads *only* for their assigned projects. Can **edit/delete only
  leads they created themselves** — broker-created leads assigned to them can still have
  their **stage, priority, and follow-ups** updated (`PATCH /leads/:id/stage`), just not
  the core customer details (`PUT /leads/:id`) or be deleted.
- **Clients** page (broker) is just Leads filtered to `stage = "Closed"` — no separate table.

### Key endpoints
| Method | Path | Notes |
|---|---|---|
| GET/POST | `/api/projects` | role-aware list (agent sees only assigned) |
| PUT/DELETE | `/api/projects/:id` | broker only |
| GET/POST | `/api/leads` | role-aware list/create |
| PUT | `/api/leads/:id` | full edit — broker: any; agent: self-created only |
| PATCH | `/api/leads/:id/stage` | stage/priority/notes — broker: any; agent: any assigned lead |
| DELETE | `/api/leads/:id` | broker: any; agent: self-created only |
| POST | `/api/leads/:id/assign` | broker only — assign/reassign to an agent |
| POST | `/api/leads/import` | broker only — multipart CSV/Excel upload, field name `file` |
| GET/POST | `/api/leads/:id/follow-ups` | lead's interaction timeline |
| PATCH/DELETE | `/api/follow-ups/:id` | only the logging agent, or broker |
| GET | `/api/follow-ups/today` \| `/overdue` | work-queue views, scoped by role |
| PUT | `/api/agents/:id/projects` | broker only — replace an agent's project assignments |

## 4. Production build

```bash
cd frontend && npm run build     # outputs static files to frontend/dist
cd backend && npm start           # run the API with Node directly (no nodemon)
```

Serve `frontend/dist` behind your webserver/CDN of choice and point it at the backend API URL
via `VITE_API_URL` (set at build time) or a reverse proxy.

## 5. Extending

- Swap the demo map (`Tracking.jsx`) for Google Maps / Mapbox using the same `lat`/`lng`
  data already being pushed over Socket.IO.
- Add file uploads for project images via `multer` (already installed) + S3/Cloudinary
  (env vars are stubbed in `.env.example`).
- Add role-based notification preferences by extending the `Notification` model/routes.
