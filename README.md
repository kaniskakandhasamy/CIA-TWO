# Book Shelf CRUD

Beginner MERN CRUD app with account login, server sessions, and private book records.

## Local setup

```bash
npm install
npm run install:all
```

Create `backend/.env` using `backend/.env.example`.

```bash
npm run build
npm start
```

Open `http://localhost:3000`.

## Render

Use these settings on Render:

```text
Build Command: npm run render-build
Start Command: npm start
```

Add these environment variables:

```text
MONGODB_URI
SESSION_SECRET
MONGODB_DB=beginner_books_crud
```

The app uses the `books` collection for CRUD data and the `sessions` collection for login sessions.
