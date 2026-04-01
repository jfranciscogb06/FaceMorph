# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project
FaceMorph — AI-powered facial analysis and looksmaxxing web app.

## Stack
- Next.js 15 App Router, TypeScript, Tailwind CSS
- Claude API (claude-sonnet-4-6) via `/app/api/analyze/route.ts`
- face-api.js for browser-side landmark detection and canvas overlays
- No database — stateless per-request analysis

## Dev
- `npm run dev` — start dev server on localhost:3000
- `npm run build` — production build
- `npm run lint` — ESLint

## API Key
Set `ANTHROPIC_API_KEY` in `.env.local`

## Flow
Gender → Ethnicity → Photo Upload → Analyzing (calls Claude) → Results Dashboard

## Architecture
- All step state lives in `app/analyze/page.tsx` as a single `AppState`
- `FaceOverlay` component uses face-api.js dynamically (client-only) to draw measurement lines on canvas
- `app/api/analyze/route.ts` sends image + gender/ethnicity to Claude, returns structured JSON
- Results show: score ring, breakdown grid, strengths/improvements, feature cards, recommendations
