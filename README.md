# Vartmaan AI

Vartmaan is an assignment-desk intake system for newsrooms. It brings stories from WhatsApp, Outlook, and the Reporter app into one inbox, keeps each reporter's slug and footage together, and leaves the final decision with a person on the desk.

This repository contains the public product site for Vartmaan AI, built with Next.js and designed for static deployment on Cloudflare Pages.

## Site map

- `/` — the Vartmaan editorial homepage and paper-to-screen introduction
- `/how-it-works` — the four-step workflow: Received, Matched, Reviewed, Fed
- `/proof` — product evidence and sample inbox/footage surfaces
- `/contact` — contact page for the assignment desk

The homepage keeps the newspaper-inspired visual language: newsprint texture, restrained red accents, editorial typography, and the original paper-rolling introduction.

## Run locally

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To create the production export:

```bash
npm run build
```

The static output is generated in `out/`.

## Cloudflare Pages

This project is configured with `output: 'export'` in `next.config.mjs`.

For a Git-connected Cloudflare Pages project use:

- Build command: `npm run build`
- Build output directory: `out`
- Node version: `20`

Or deploy from the terminal after authenticating Wrangler:

```bash
npx wrangler login
npx wrangler pages deploy out --project-name vartmaan-ai
```

## Project structure

```text
app/                         Next.js routes and shared site styles
public/vartmaan/             Vartmaan homepage, assets, screens, and animation files
next.config.mjs              Static export configuration
```

The legacy Vartmaan page is intentionally kept under `public/vartmaan/` because its paper animation and editorial interactions are authored as a self-contained static experience and embedded by the Next.js homepage.

## Content note

All product screens and stories shown on this site are sample data for demonstration. No real newsroom feed is connected. Sample phone numbers are blurred.

## Brand

Vartmaan AI is made with Dorefin AI.
