# MinterZOO 🦄

A playful **meme‑coin launchpad & asset toolbox** for the Sui blockchain. Mint a token in seconds, then transfer, split, merge — or incinerate your dust — all from a single, polished UI.

---

## 🚀 Pitch & Demo

* **Pitch:** [MinterZOO Pitch](https://docs.google.com/presentation/d/1L3olJYof2Hauzi2W4O4X9RIdrccl6Cdr)
* **Demo:** [MinterZOO Demo](https://youtu.be/lbW7e4p4ziI)

---

## ✨ Features

| Module                | Highlights                                                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Meme‑Coin Creator** | • AI‐assisted name/ticker/description<br>• Optional on‑chain avatar upload<br>• Auto‑mints initial supply & drops TreasuryCap |
| **Transfer Tools**    | • Object transfer<br>• Token transfer (single & multi‑recipient)<br>• Real‑time gas estimate                                  |
| **Manage Tools**      | • Split tokens into N pieces<br>• Merge token objects (with pagination)<br>• Delete objects<br>• Burn zero‑balance dust       |
| **Misc**              | Memo pad, animated header/footer, dark‑mode‑first design                                                                      |

---

## 🏗 Tech Stack

* **Next.js 14** • React server components
* **Tailwind CSS** + shadcn/ui
* **@mysten/dapp-kit** – wallet connect & tx signing
* **Sui TypeScript SDK** – on‑chain calls, dry‑runs
* **Move bytecode template** – on‑the‑fly coin module compilation
* **Vercel / Netlify** ready out‑of‑the‑box

---

## 🚀 Quick Start

```bash
# 1 · Clone
$ git clone https://github.com/your-org/minterzoo && cd minterzoo

# 2 · Install deps (pnpm / npm / yarn)
$ pnpm i

# 3 · Copy env & set RPC + faucet if needed
$ cp .env.example .env.local

# 4 · Run dev server
$ pnpm dev   # http://localhost:3000
```

> **Tip:** Use `pnpm run sui:devnet` to spin up a local Sui test validator (optional).

---

## 🐳 Scripts

```json
"dev"         : "next dev",
"build"       : "next build",
"start"       : "next start",
"lint"        : "next lint",
"sui:devnet" : "sui-test-validator --rpc-port 9000"
```

---