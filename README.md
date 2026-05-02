# Final-Project-SOL (LocalDAO)

Neighborhood investment platform where local communities create DAOs, verify members, propose investments, vote with USDC stakes, and distribute yield on-chain—with a React/Vite frontend, optional Node backend for chat email notifications, and Solidity contracts (Foundry).

---

## Table of contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Features](#features)
4. [Tech stack](#tech-stack)
5. [Repository layout](#repository-layout)
6. [Environment variables](#environment-variables)
7. [Local development](#local-development)
8. [Backend API & workers](#backend-api--workers)
9. [DAO chat (Messages)](#dao-chat-messages)
10. [Smart contracts](#smart-contracts)
11. [Deployment notes](#deployment-notes)
12. [Troubleshooting](#troubleshooting)

---

## Overview

**Goal:** Help communities pool capital and decide on local investments together.

**On-chain flow (high level):**

1. Founder creates a DAO via **LocalDAOFactory**.
2. Admins add members and verify **KYC** (hash-based on-chain).
3. Admins create **investment proposals**.
4. Verified members **vote** (upvotes stake USDC; downvotes are free).
5. Eligible proposals are **activated**; funds and status follow **LocalDAO** rules.
6. Yield is **deposited** and **claimed** (or stake withdrawn per rules).

**Off-chain additions in this repo:** profile avatars (IPFS + local storage), per-DAO **chat** (Supabase or browser fallback), **email alerts** via Gmail and an optional **RabbitMQ** worker pipeline, and **in-app notification** hints (bell + proposals/yields).

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Vite SPA)                        │
│  Privy auth · Viem reads/writes · IPFS (Pinata) · optional chat  │
└───────────────┬───────────────────────────────┬─────────────────┘
                │ RPC                            │ HTTP
                ▼                                ▼
┌───────────────────────┐            ┌──────────────────────────────┐
│   EVM chain (e.g.     │            │  Express API (backend/)     │
│   Lisk Sepolia)       │            │  Prisma (SQLite) · Gmail    │
│   Factory + DAOs      │            │  Optional RabbitMQ workers  │
└───────────────────────┘            └──────────────────────────────┘
                │                                │
                │                                ▼
                │                      ┌──────────────────┐
                │                      │ Supabase (opt.)  │
                │                      │ dao_chat_messages│
                └──────────────────────┴──────────────────┘
```

- **Frontend** talks to the chain through **Viem** and to **your backend** with `VITE_BACKEND_URL` (see `utils/backendUrl.ts`).
- **Chat persistence:** if `VITE_SUPABASE_URL` and key are set, messages go to Supabase; otherwise they use **localStorage** for that browser (good for demos, not multi-device sync).
- **Backend** is optional for core on-chain flows but **recommended** for Gmail-linked **chat email notifications** and queued delivery.

---

## Features

### On-chain (UI + contracts)

- **Landing** and **Privy** login (embedded / linked Ethereum wallet).
- **Dashboard:** TVL, yields, active DAOs, proposals needing attention.
- **Create DAO:** metadata, location, governance, membership, **logo upload (IPFS / Pinata)**.
- **Discover** and **Neighborhoods (investments):** list/filter proposals; create proposals (founder/admin).
- **Voting:** verified members only; staked upvotes; deadline-aware.
- **KYC / Admin:** members, roles, activate/close investments, yield ops, pause, etc.
- **Wallet** and **Yields:** balances, claim, deposit yield, withdraw stake where allowed.
- **Contract helpers:** `utils/localDaoContracts.ts`, chain config in `utils/contract.ts`.

### Messaging & notifications

- **Messages** view: one room per active DAO; realtime updates (Supabase Realtime websocket or `BroadcastChannel` + `storage` fallback).
- **Chat images:** uploads go to **Pinata**; message row can store `attachment_url` in Supabase. If that column is missing, the app **falls back** to storing the gateway URL in `content` and **hydrates** it on read so the UI still renders an **image**, not raw link text.
- **Notification bell (AppShell):** combines **unread chat** (from others, vs. your “last seen” map in `localStorage`), **open proposals**, and **claimable yields**; opens the right screen (Messages can jump to a DAO via `MESSAGES_NAV_DAO_STORAGE_KEY`).
- **Email:** users can connect **Gmail** and subscribe per DAO; new message webhook fans out jobs (sync or RabbitMQ).

### Profile & identity

- **Profile photo:** uploaded to IPFS; **URL stored per wallet** in `localStorage` (`utils/profileAvatar.ts`); shown in **sidebar**, **header**, and as **avatars next to chat bubbles** (your photo + others if this device has saved their URL).
- **Display names:** Gmail / Google / other OAuth names via `utils/userDisplay.ts`; wallet shown **masked** in the shell.

### Backend services

- **Express 5** REST API (`backend/src/index.ts`).
- **Prisma + SQLite** by default (`User`, `Notification`, `EmailPreference`, `ChatSubscription`).
- **Gmail OAuth** for inbox linking; **nodemailer** paths for outbound alerts.
- **RabbitMQ** (optional): webhook publishes jobs; **workers** consume chat dispatch + email delivery with retries / DLQ-style handling (see `backend/src/messaging/` and `docker-compose.rabbitmq.yml`).

---

## Tech stack

| Area | Technologies |
|------|----------------|
| Frontend | React 19, TypeScript, Vite 6, Tailwind 4, Privy, Viem, Ethers (where used), Lucide, React Toastify |
| Backend | Node, Express 5, Prisma, SQLite, Google APIs / Nodemailer, amqplib, Viem |
| Contracts | Solidity 0.8.20, Foundry, OpenZeppelin, EIP-1167 clones |
| Storage / infra | Pinata (IPFS), optional Supabase (Postgres API + Realtime) |

---

## Repository layout

```text
.
├── App.tsx
├── index.tsx
├── vite.config.ts
├── tsconfig.json              # Frontend-only TS project (backend excluded)
├── vite-env.d.ts              # VITE_* typings for TypeScript
├── .env.example               # Root env template (do not commit real secrets)
├── components/
├── layouts/                   # AppShell: nav, notifications, profile chip
├── views/                     # Dashboard, Messages, Profile, Yields, etc.
├── utils/                     # contract, daoChat, ipfs, userDisplay, profileAvatar, …
├── supabase-scripts/          # e.g. add-chat-attachment_url.sql
├── backend/
│   ├── package.json
│   ├── prisma/schema.prisma
│   ├── docker-compose.rabbitmq.yml
│   └── src/
│       ├── index.ts
│       ├── worker.bootstrap.ts
│       ├── routes/            # auth, chat
│       ├── services/          # gmail, chat-notification.processor, …
│       ├── messaging/         # RabbitMQ topology, publishers, consumers
│       └── db/prisma.ts
├── contract/                  # Foundry project (src, test, script)
└── public/
```

---

## Environment variables

Create **`/.env`** from **`.env.example`**. Treat **secrets** as sensitive: use placeholders in `.env.example` in git and real values only locally or in your host’s secret store.

### Frontend (`/.env`)

| Variable | Purpose |
|---------|---------|
| `VITE_PRIVY_APP_ID` | **Required.** Privy application ID. |
| `VITE_CHAIN_ID`, `VITE_CHAIN_NAME`, `VITE_RPC_URL`, `VITE_EXPLORER_URL` | Chain + explorer (defaults exist in `utils/contract.ts` if unset). |
| `VITE_EXPLORER_URLS`, `VITE_FUJI_EXPLORER_URLS` | Optional multi-explorer CSV for `utils/explorer.ts`. |
| `VITE_FACTORY_ADDRESS`, `VITE_USDC_ADDRESS` | Deployed factory and USDC (or mock) on target chain. |
| `VITE_BACKEND_URL` | API origin for chat webhooks & prefs (default `http://localhost:3001` in code if unset). |
| `VITE_PINATA_JWT` | **Logo, profile photo, chat image** uploads via Pinata. |
| `VITE_IPFS_UPLOAD_TIMEOUT_MS` | Optional upload timeout (ms). |
| `VITE_SUPABASE_URL` | Optional; enables hosted chat sync + Realtime. |
| `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase client key (`daoChat.ts` accepts either). |

### Backend (`/backend/.env`)

Copy from **`backend/.env.example`**:

| Variable | Purpose |
|---------|---------|
| `DATABASE_URL` | Prisma datasource (default SQLite file path). |
| `PORT` | API port (default `3001`). |
| `FRONTEND_URL` | CORS / email link base. |
| `GMAIL_*` | OAuth client + redirect; **mailer** refresh token or app password for sending. |
| `RABBITMQ_URL` | If set, chat webhook queues jobs; run **`npm run worker`**. |
| `RABBITMQ_HEARTBEAT`, `RABBIT_PREFETCH`, `RABBIT_MAX_JOB_ATTEMPTS` | Tuning for consumers. |

---

## Local development

### Frontend

```bash
npm install
cp .env.example .env   # then edit
npm run dev              # http://localhost:3000 (see vite.config.ts)
npm run build
npm run preview
```

Typecheck the **frontend-only** TS project:

```bash
npx tsc --noEmit
```

### Backend

```bash
cd backend
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev    # creates/updates SQLite schema if configured
npm run dev               # API
```

Optional **RabbitMQ** (Docker):

```bash
cd backend
docker compose -f docker-compose.rabbitmq.yml up -d
# set RABBITMQ_URL=amqp://guest:guest@localhost:5672 in backend/.env
npm run worker            # separate terminal — or npm run dev:worker
```

### Health check

`GET http://localhost:3001/api/health` — reports Gmail outbound config and RabbitMQ reachability snapshot.

---

## Backend API & workers

**Mounted routes:**

- **`/api/auth`** — Gmail connect/callback/preferences (see `routes/auth.routes.ts`).
- **`/api/chat`** — subscribe, list subscriptions by wallet, **webhook** `POST /api/chat/webhook/new-message` (fan-out notifications + optional queue).

**Webhook behavior:**

1. Validates payload (`daoAddress`, optional `daoName`, message preview, sender, timestamp).
2. If **`RABBITMQ_URL`** is configured and publish succeeds → **HTTP 202** and workers process persisted notifications + email jobs.
3. Else → synchronous pipeline in `chat-notification.processor.ts` (in-app notification rows + SMTP when configured).

Workers: `backend/src/worker.bootstrap.ts` (consumers under `messaging/consumers/`).

---

## DAO chat (Messages)

- **Transport label:** `getDaoChatTransportLabel()` → `supabase-realtime` vs `local-fallback`.
- **Supabase table:** `dao_chat_messages` — columns include `room_key`, `sender_wallet`, `sender_label`, `content`, `created_at`, and **`attachment_url`** if you ran:

  `supabase-scripts/add-chat-attachment-url.sql`

- **Without `attachment_url`:** inserts still succeed (URL merged into `content`); **`hydrateChatImageAttachment`** in `utils/daoChat.ts` restores `attachmentUrl` for images in the UI.
- **Loads:** REST select tries `attachment_url` first and **retries** without that column if PostgREST errors (so older DBs don’t break message loading).

---

## Smart contracts

Located under **`contract/`**.

```bash
cd contract
forge build
forge test
forge fmt
```

Deploy (after `PRIVATE_KEY` and RPC):

```bash
forge script script/DeployLocalDAO.s.sol:DeployLocalDAO --rpc-url <RPC_URL> --broadcast
```

Then set **`VITE_FACTORY_ADDRESS`** and **`VITE_USDC_ADDRESS`** in the frontend `.env`.

See **LocalDAOFactory** / **LocalDAO** sections in the earlier part of this README for responsibilities and main functions (unchanged contract design).

---

## Deployment notes

- **Frontend:** static build from `npm run build`; configure all `VITE_*` on the host (Vercel, Netlify, etc.). `VITE_BACKEND_URL` must point to your **production API** over HTTPS when the site is HTTPS.
- **Backend:** run `npm run build && npm run start`; set `FRONTEND_URL`, DB URL, Gmail, and optionally `RABBITMQ_URL`; run **`start:worker`** as a separate process if using the queue.
- **Supabase:** enable RLS policies appropriate for your threat model; the app uses the **anon** key from the browser for chat—tighten policies and consider a server proxy for production hardening.
- **Never commit** live Privy secrets, Pinata JWTs, or Supabase service keys to git.

---

## Troubleshooting

| Symptom | Things to check |
|--------|------------------|
| “Missing Privy App ID” | `VITE_PRIVY_APP_ID` in `.env`; restart dev server. |
| Transactions fail / wrong chain | Wallet network vs `VITE_CHAIN_ID` / RPC; factory & USDC on same chain. |
| Chat fails to load | Supabase URL/key; REST errors; run attachment SQL migration; browser console + Network tab on `/rest/v1/dao_chat_messages`. |
| Chat shows URL not image | Old rows: hydration should fix on read; ensure Pinata gateway URL pattern is https and contains `/ipfs/` or recognized host. |
| No emails on new message | Subscriptions + user `email`; Gmail tokens / `GMAIL_FROM_EMAIL`; workers if queued; **`/api/health`**. |
| Workers idle | `RABBITMQ_URL`; Docker compose running; **`npm run worker`** started. |
| TypeScript OOM | Root `tsconfig` excludes **`backend`**; run backend `tsc` inside **`backend/`**. |

---

## Useful commands (quick reference)

```bash
npm install && npm run dev          # Frontend
npm run build && npm run preview    # Frontend production preview
npx tsc --noEmit                    # Frontend TS check

cd backend && npm install && npm run dev
cd backend && npm run worker

cd contract && forge build && forge test
```

---

## License / attribution

Project structure and contracts follow the Neighborhood / LocalDAO product goals described above; adjust **LICENSE** if you add one. For production use, complete a security review of contracts, secrets handling, and Supabase policies.
