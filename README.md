# CampusFix

CampusFix is a full-stack web application for reporting and managing maintenance problems and service requests on a university campus. It replaces phone calls, paper forms, WhatsApp messages and office visits with one system in which:

- **students and staff** report faults (electricity, plumbing, furniture, internet, classroom equipment, hostel repairs and more), attach photos and follow each request until it is fixed;
- **maintenance officers** see the jobs assigned to them, update progress and mark work as completed;
- **administrators** manage users and categories, assign requests, monitor status in real time and generate reports.

Built for MIT 8333 – Advanced Web Application Development (MIVA Open University, 2026/2027).

## Live demo

| | |
|---|---|
| Application | https://campusfix-5j9g.onrender.com |
| API documentation (Swagger) | https://campusfix-5j9g.onrender.com/api/docs |
| Health check | https://campusfix-5j9g.onrender.com/api/health |

Demo accounts (password **`CampusFix@2026`**):

| Role | Email |
|---|---|
| Administrator | `admin@campusfix.app` |
| Maintenance officer | `ibrahim.musa@campusfix.app` |
| Student | `student@campusfix.app` |
| Staff | `staff@campusfix.app` |

> The free hosting plan sleeps after 15 minutes without traffic, so the first visit can take up to a minute to load.

## Features

**Frontend**
- Registration and sign-in with client-side validation and clear error messages
- Role-based dashboards for Student/Staff, Maintenance Officer and Administrator
- Service request form with category picker, urgency, location and up to four photos
- Request tracking page with search, filters (status, category, priority, officer, dates), sorting and pagination
- Request detail page with a progress "stage rail", activity history, comments, photos and role-specific actions
- Administrator pages for users, categories, reports (charts) and the audit log
- Responsive layout down to phone width, keyboard focus states and screen-reader labels

**Backend / API**
- RESTful JSON API built with Express 5
- JWT access tokens (15 min) with rotating, revocable refresh tokens in httpOnly cookies
- Passwords hashed with bcrypt; rate-limited sign-in; Helmet security headers
- Role-based access control on every route
- Full CRUD for service requests, plus assignment, status workflow and comments
- Workflow rules enforced on the server (e.g. only an officer can mark a job completed; only the requester confirms it)
- Consistent JSON error responses with field-level validation messages (Zod)

**Advanced features (all nine from the brief)**
1. JWT/session-based authentication with refresh-token rotation and reuse detection
2. Role-based access control (Student, Staff, Officer, Administrator)
3. Image upload for evidence of fault and proof of completion
4. In-app notifications (plus optional e-mail via SMTP)
5. Search, filter and pagination
6. Real-time status updates with Socket.IO
7. Audit trail of every sign-in, change and export
8. API documentation with Swagger (OpenAPI 3)
9. Data export to CSV and PDF

## Technology

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, React Router, TanStack Query, React Hook Form + Zod, Tailwind CSS 4, Recharts, Socket.IO client |
| Backend | Node.js 22, Express 5, Knex.js, Zod, JSON Web Tokens, bcrypt, Multer, Socket.IO, PDFKit, Swagger UI |
| Database | PostgreSQL 18 on Neon in production (PostgreSQL 16 used for local development and tests) |
| Testing | Jest + Supertest (API), Vitest + React Testing Library (components), Playwright (end-to-end) |
| Hosting | Render (web service) + Neon (database) |

## Project structure

```
campusfix/
├── client/                 React single-page application
│   └── src/
│       ├── components/     Layout, stage rail, request list, dialogs, UI kit
│       ├── context/        Auth and real-time providers
│       ├── lib/            API client, validation schemas, formatters
│       ├── pages/          Dashboards, requests, admin pages, auth pages
│       └── test/           Component tests
├── server/                 Express API
│   ├── src/
│   │   ├── controllers/    Route handlers
│   │   ├── db/             Migrations and seed data
│   │   ├── docs/           OpenAPI specification
│   │   ├── middleware/     Auth, RBAC, validation, uploads, errors
│   │   ├── services/       Audit, notifications, e-mail, shared queries
│   │   └── routes/         Route table
│   └── tests/              API tests
├── e2e/                    Browser end-to-end test
└── render.yaml             Deployment blueprint
```

## Running locally

Requirements: Node.js 20+ and PostgreSQL 14+.

```bash
# 1. Install dependencies
npm run install:all

# 2. Configure the API
cp server/.env.example server/.env      # then edit DATABASE_URL and JWT_ACCESS_SECRET
createdb campusfix && createdb campusfix_test

# 3. Create the tables and load demo data
npm run migrate --prefix server
npm run seed --prefix server

# 4. Start the API (port 4000) and the client (port 5173) in two terminals
npm run dev:server
npm run dev:client
```

Open http://localhost:5173 and sign in with one of the demo accounts above.

## Tests

```bash
npm test --prefix server     # 83 API tests (uses the campusfix_test database)
npm test --prefix client     # 44 component tests
```

The end-to-end test drives a real browser through the whole request life-cycle (submit → assign → start → complete → confirm), checks real-time updates and role guards:

```bash
pip install playwright pillow && playwright install chromium
BASE_URL=http://localhost:4000 python3 e2e/workflow_e2e.py
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md).

## Author

Emeka Ofe, Master of Information Technology, MIVA Open University.
