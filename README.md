# Monitoring Tools Workspace

This repository is now organized as a full-stack workspace with a clear separation between the React frontend and a future Node.js/Express backend.

## Structure

```text
monitoring-tools/
├── backend/
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── app.js
│       ├── server.js
│       ├── config/
│       ├── controllers/
│       ├── middleware/
│       └── routes/
├── frontend/
│   ├── package.json
│   ├── package-lock.json
│   ├── index.html
│   ├── vite.config.js
│   ├── eslint.config.js
│   ├── public/
│   └── src/
├── .gitignore
└── package.json
```

## Frontend

The existing Vite + React application was preserved and placed under `frontend/` so its files stay intact while being separated from backend work.

Useful commands:

```bash
npm run dev:frontend
npm run build:frontend
npm run lint:frontend
```

## Backend

`backend/` contains a starter Express structure for future API work.

Useful commands:

```bash
npm run dev:backend
npm run start:backend
```

Before running the backend for the first time, install its dependencies inside `backend/`.

## Notes

- The root `package.json` is now a workspace-style entry point for the whole project.
- Frontend and backend are separated so future API development will not mix with UI files.
- The backend currently includes a health-check route to give the server scaffold a clean starting point.
