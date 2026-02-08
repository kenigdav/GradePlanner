# Assignment Planner

A web app to post school assignments with a date, subject, and description, view them in a calendar, and manage access with three user roles.

## Features

- **Assignments** – Due date, subject, description, and images; drag-and-drop between days and months
- **Calendar** – Month view, click a day to see details; click an assignment to view description and images (enlarge images)
- **Access control** – Three roles:
  - **Viewer** – View the planner only (no add/edit/delete)
  - **Contributor** – View, add, and modify assignments; approve new viewers; add new users as viewers
  - **Administrator** – Full access; add users with any role; change any user’s role
- **User accounts** – Register (pending until approved), sign in, change password. Passwords are hashed on the server (bcrypt).

## Default admin

- **Username:** `admin`  
- **Password:** `blabla1`  

Change this password after first login (Change password in the header).

## Put the code on GitHub

1. **Install Git** if you don’t have it: [git-scm.com](https://git-scm.com/) (use the default options).

2. **Create a new repository on GitHub**
   - Go to [github.com](https://github.com) → **+** → **New repository**.
   - Name it (e.g. `GradePlanner`), leave “Add a README” **unchecked**, then **Create repository**.

3. **Push this folder from your machine** (run in the project root, e.g. `c:\Users\kenig\code\GradePlanner`):
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Assignment Planner app"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```
   Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your GitHub username and the repo name you chose. If GitHub asks for auth, use a **Personal Access Token** as the password (Settings → Developer settings → Personal access tokens).

Your code will be on GitHub; you can then connect the repo to Render (or another host) to deploy.

## Run locally

1. **Install dependencies** (once):
   ```bash
   npm install
   cd server && npm install && cd ..
   ```

2. **Start both API and frontend** (easiest – one command from project root):
   ```bash
   npm run dev:all
   ```
   This starts the API at http://localhost:3001 and the app at http://localhost:5173. Open the **Local** URL shown in the terminal (e.g. http://localhost:5173).

   **If you see "npm is not recognized"** – the terminal doesn't have Node in PATH. Either:
   - **Restart Cursor** (or open a new terminal) so it picks up PATH after installing Node, or
   - Run the PowerShell script that refreshes PATH and starts the app:
     ```powershell
     .\scripts\dev-all.ps1
     ```
     (From the project root. If you get an execution policy error, run: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` once.)

   **Or** run in two terminals:
   - Terminal 1: `cd server && npm run dev`
   - Terminal 2: `npm run dev` then open http://localhost:5173

3. Sign in with **admin** / **blabla1**, or register a new account (contributor/admin must approve viewers).

**If login says "Cannot reach server"** – the API isn’t running. Start it with `cd server && npm run dev` (or use `npm run dev:all`).

### Restart after updating the app

When you change components or config and want a clean run:

- **Same terminal:** Press **Ctrl+C** to stop, then run `npm run dev:all` again. Open the **Local** URL shown.
- **Ports stuck or need a clean kill:** In a new terminal run `npm run stop` (stops port 3001 and 5173–5176), then `npm run dev:all`.
- **Restart from another terminal:** Run `npm run restart` (runs stop then dev:all).

## Build for production (local)

```bash
npm run build
NODE_ENV=production npm start
```

One server serves both the API and the built frontend at http://localhost:3001. Set `JWT_SECRET` in production (and use HTTPS).

---

## Deploy to a public server

The app runs as a **single process**: the Node server serves the API and the built frontend. No separate static host needed.

### Option 1: Docker (any cloud or VPS)

1. **Build and run locally** (optional test):
   ```bash
   docker build -t grade-planner .
   docker run -p 3001:3001 -e JWT_SECRET=your-secret-here grade-planner
   ```
   Open http://localhost:3001.

2. **Deploy** to a host that runs Docker (e.g. Railway, Render, Fly.io, or your own VPS):
   - Connect the repo and use the project’s **Dockerfile**.
   - Set **port** to `3001` (or the port the host assigns via `PORT`).
   - Set env **`JWT_SECRET`** to a long random string (required in production).
   - **Data:** By default, users and assignments are stored in `server/data/files/`. On most PaaS hosts the filesystem is ephemeral, so data is lost on redeploy unless you attach a **volume** (or later switch to a database). Configure a persistent volume for `server/data` if your host supports it.

### Option 2: Build + Node (VPS or PaaS with Node)

1. On the server or in the build step:
   ```bash
   npm ci
   npm run build
   ```
2. Start with:
   ```bash
   NODE_ENV=production PORT=3001 JWT_SECRET=your-secret-here node server/index.js
   ```
   Or from root: `NODE_ENV=production npm start` (with `PORT` and `JWT_SECRET` set in the environment).

3. Put a **reverse proxy** (e.g. nginx or Caddy) in front and enable **HTTPS**. Point the proxy at `http://localhost:3001`.

### Environment variables (production)

| Variable      | Required | Description |
|---------------|----------|-------------|
| `PORT`        | No       | Port to listen on (default `3001`). Many hosts set this automatically. |
| `JWT_SECRET`  | Yes      | Secret used to sign JWTs. Use a long random string. |
| `NODE_ENV`    | Yes for single-server | Set to `production` so the server serves the built frontend. |
