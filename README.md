# Stursky aka Open Hatch

A realtime collaborative workspace for chat, documents, memory, files, and a shared canvas.

## What it is

Open Hatch is a multiplayer workspace app built with React, TypeScript, Vite, and Supabase. A **workspace** is the top-level shared room. Inside a workspace, users can:

- chat with AI
- create and edit documents
- store memory/facts
- upload files
- draw and manipulate objects on a shared canvas
- see other users live with cursors and presence

## Core ideas

- **Workspace-first model** — collaboration happens at the workspace level
- **Shared canvas** — drawings and object movement sync in realtime
- **Local windows, shared content** — each user can open their own windows without forcing them open for everyone else
- **Realtime presence** — live cursor updates and workspace presence indicators

## Features

- realtime multiplayer cursors
- realtime canvas object updates
- shared workspace canvas
- floating document / chat / memory windows
- document autosave
- image and file drop support
- sticky notes, shapes, lines, arrows, and pen strokes
- workspace sharing with members and roles
- workspace grid view with previews
- wallpaper-backed home and workspace views

## Tech stack

- React 18
- TypeScript
- Vite
- Supabase
- Lucide React
- Vite PWA plugin

## Local development

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create a `.env` file with your own Supabase project values:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

These are **not included** in the repo. Anyone cloning this project should create their own Supabase project and supply their own values.

### 3. Set up Supabase

This app is still built on **Supabase**. What is removed from the repo is any private project configuration or secret value — not the Supabase integration itself.

Database schema and migrations live in:

```text
supabase/migrations/
```

Typical setup flow:

```bash
# install Supabase CLI if needed
npm install -g supabase

# login and link to your project
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# apply the schema to your hosted project
supabase db push
```

For local development with local Supabase:

```bash
supabase start
supabase db reset
```

### 4. Configure server-side AI secret

The AI chat function uses a **server-side** secret, not a browser-exposed Vite env var.

Set this in Supabase secrets:

```bash
supabase secrets set ANTHROPIC_API_KEY=your_key_here
```

Then deploy the function if needed:

```bash
supabase functions deploy ai-chat
```

### 5. Run the app

```bash
npm run dev
```

### 6. Production build

```bash
npm run build
```

### 7. Typecheck

```bash
npm run typecheck
```

### 8. Lint

```bash
npm run lint
```

## Supabase

This repository assumes a Supabase backend, but **you bring your own project**.

At minimum, a fresh setup should:

- create a Supabase project
- set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- apply the migrations in `supabase/migrations/`
- set the `ANTHROPIC_API_KEY` secret for the `ai-chat` function
- deploy the `ai-chat` function if using hosted inference

If you are setting this project up fresh, apply the migrations before testing auth, sharing, multiplayer canvas, or chat.

## Project structure

```text
src/
  components/   UI components
  hooks/        app state and realtime hooks
  lib/          Supabase and offline helpers
  types/        shared types
supabase/
  migrations/   database schema changes
```

## Current product shape

Open Hatch currently focuses on:

- collaborative workspaces
- shared visual thinking on canvas
- AI chat inside the same environment
- document + memory workflows alongside the canvas

## Notes

- this is an app repo, not a published npm package
- realtime behavior depends on Supabase being configured correctly
- workspace sharing and presence depend on authenticated users and workspace membership

## License

Add your preferred license here before public release.
