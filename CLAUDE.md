# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start dev server (choose platform)
npx expo start
npx expo start --ios
npx expo start --android
npx expo start --web
```

There is no lint or test script configured. TypeScript checking:
```bash
npx tsc --noEmit
```

## Environment Variables

Required in a `.env` file (not committed):
- `EXPO_PUBLIC_SUPABASE_URL` — Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
- `EXPO_PUBLIC_ANTHROPIC_API_KEY` — Anthropic API key (optional; falls back to static tips if absent)

## Architecture

**FlarePlan** is a React Native / Expo app for students with chronic illness to manage academic tasks around their energy levels and health flares.

### Routing (Expo Router file-based)

```
app/
  _layout.tsx          — Root layout: auth guard, session listener
  (tabs)/
    _layout.tsx        — Tab bar (Home, Planner, Insights, Recovery, Settings)
    index.tsx          — Home: greeting, energy pill, Canvas task list, recovery CTA
    planner.tsx        — Week strip + daily task view with energy per day
    insights.tsx       — Stats cards + energy-by-day bar chart
    recovery.tsx       — Recovery landing (last recovery summary) + 3-step wizard
    settings.tsx       — Canvas connection (URL + token) + sign-out
    tasks.tsx          — Legacy task CRUD (hidden from tabs, kept for reference)
  auth/
    login.tsx
    signup.tsx
```

Auth flow lives entirely in `app/_layout.tsx`: it subscribes to Supabase auth state and redirects unauthenticated users to `/auth/login`. On sign-in, the router replaces to `/` (the home tab).

The Home screen checks for a today checkin on mount and pre-fills the energy store; if none exists, the energy pill shows "set energy" and opens a bottom-sheet picker on tap.

Energy display: `lib/store.ts` holds the in-session energy level. Screens read from it and the picker in the Home modal writes both to the store and to the `checkins` table via upsert.

### Data layer (`lib/`)

- **`lib/supabase.ts`** — Supabase client (session stored in AsyncStorage), plus shared `Task` and `Checkin` TypeScript types.
- **`lib/store.ts`** — Zustand store holding the current session's `energyLevel` (`low | medium | high`). Set after daily check-in, consumed by the Tasks tab to filter/organize tasks.
- **`lib/aiAgent.ts`** — Calls Claude API (`claude-3-5-sonnet-20241022`) to generate per-task tips filtered by user energy. Has a 30-minute in-memory cache keyed by energy level; falls back to static tips if the API key is missing or the request fails.

### Supabase tables

| Table | Purpose |
|---|---|
| `tasks` | User tasks: `subject`, `title`, `due_date`, `energy_required` (`light/medium/heavy`), `is_completed`, `is_from_canvas` |
| `checkins` | Daily energy check-ins: `energy_level`, `date`, `user_id` |
| `flare_recoveries` | Recovery wizard submissions: `days_lost`, `energy_level`, `hours_available`, `user_id` |

### Energy model

Tasks have a `energy_required` field (`light/medium/heavy`). Users report their daily energy (`low/medium/high`). The mapping:
- `low` energy → can only do `light` tasks
- `medium` energy → `light` + `medium` tasks
- `high` energy → all tasks

`detectEnergy()` in `lib/aiAgent.ts` (also duplicated in `settings.tsx`) auto-classifies task energy from title keywords.

### Canvas integration

Settings screen connects to a Canvas LMS instance via user-supplied API token + domain (stored in AsyncStorage). It calls `GET /api/v1/users/self/todo` to fetch upcoming assignments and imports them as tasks with auto-detected energy levels that the user can adjust before saving.

### Styling

All colors are defined in `constants/colors.ts` as `Colors` (backgrounds, text, borders) and `EnergyColors` (per-energy-level dot/background/text colors). All styling uses React Native `StyleSheet.create` — no external styling library.
