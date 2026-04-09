# Cineflow

Premium project management for filmmakers, videographers, and media agencies.

## Stack

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui** (Radix primitives)
- **Supabase** (auth + database — Phase 2)

## Setup

### 1. Install Node.js

Install Node.js 20+ via [nvm](https://github.com/nvm-sh/nvm) or [Homebrew](https://brew.sh):

```bash
# via Homebrew
brew install node

# or via nvm
nvm install 20
nvm use 20
```

### 2. Install dependencies

```bash
cd /Users/kennethgarcia/Sites/cineflow
npm install
```

### 3. Environment variables

```bash
cp .env.local.example .env.local
```

Fill in your Supabase project URL and anon key (Phase 2 — optional for now, the app runs on mock data).

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Routes

| Route | Description |
|---|---|
| `/` | Landing page |
| `/login` | Sign in |
| `/signup` | Create account |
| `/dashboard` | Main dashboard |
| `/projects` | All projects (grid + list view) |
| `/projects/[id]` | Single project (tabs: Overview, Shot List, Storyboard, Revisions, Notes) |
| `/calendar` | Event calendar |
| `/settings` | Account settings |

## Project Structure

```
cineflow/
├── app/
│   ├── (auth)/          # login, signup
│   ├── (app)/           # dashboard, projects, calendar, settings
│   └── page.tsx         # landing page
├── components/
│   ├── ui/              # shadcn primitives
│   ├── layout/          # Sidebar, Header, AppLayout
│   ├── dashboard/       # StatCard, ActivityFeed
│   ├── projects/        # ProjectCard
│   └── shared/          # StatusBadge, AvatarGroup
├── lib/
│   ├── utils.ts         # helpers + design tokens
│   └── supabase/        # client + server helpers
├── mock/                # mock data (projects, activity, calendar)
├── types/               # TypeScript types
└── supabase/            # schema + seed (Phase 2)
```

## Phase 2 (next steps)

- Supabase auth wiring
- Database schema + RLS policies
- Projects CRUD from real data
- File uploads (revisions)
- Real-time comments
