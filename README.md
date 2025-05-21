# MinterZOO 🦄

A playful **meme‑coin launchpad & asset toolbox** for the Sui blockchain. Mint a token in seconds, then transfer, split, merge — or incinerate your dust — all from a single, polished UI.

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

* **Next.js 14** • React server components
* **Tailwind CSS** + shadcn/ui
* **@mysten/dapp‑kit** – wallet connect & tx signing
* **Sui TypeScript SDK** – on‑chain calls, dry‑runs
* **Move bytecode template** – on‑the‑fly coin module compilation
* **Vercel / Netlify** ready out‑of‑the‑box

---

## 🚀 Quick Start

```bash
# 1 · Clone
$ git clone https://github.com/your‑org/minterzoo && cd minterzoo

# 2 · Install deps (pnpm / npm / yarn)
$ pnpm i

# 3 · Copy env & set RPC + faucet if needed
$ cp .env.example .env.local

# 4 · Run dev server
$ pnpm dev   # http://localhost:3000
```

> **Tip:** Use `pnpm run sui:devnet` to spin up a local Sui test validator (optional).

---

## 🔧 Environment Variables

| Key                      | Purpose        | Example                               |
| ------------------------ | -------------- | ------------------------------------- |
| `NEXT_PUBLIC_SUI_RPC`    | RPC endpoint   | `https://fullnode.testnet.sui.io:443` |
| `NEXT_PUBLIC_FAUCET_URL` | Testnet faucet | `https://faucet.testnet.sui.io/gas`   |

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

## 🖼 Screenshots

| Create Coin                     | Toolbox                        |
| ------------------------------- | ------------------------------ |
| ![](docs/screenshot-create.png) | ![](docs/screenshot-tools.png) |

---

## 🛣 Roadmap

* [ ] Confetti + share‑to‑X once coin is minted
* [ ] Ledger / Trezor hardware‑wallet support
* [ ] Multi‑lang i18n (EN / ZH / ES)
* [ ] DAO launch module

Have a feature idea? [Open an issue](https://github.com/your‑org/minterzoo/issues)!

---

## 🤝 Contributing

1. `git checkout -b feat/my‑feature`
2. Commit your changes + tests
3. `git push origin feat/my‑feature`
4. Open a pull request

We follow Conventional Commits & run `pnpm test` on CI.

---

## 📝 License

MIT © 2025 MinterZOO contributors

---

## 🙏 Acknowledgements

* [Mysten Labs](https://github.com/MystenLabs) for the Sui SDK & dapp‑kit
* [shadcn/ui](https://ui.shadcn.com) for the wonderful component library
* [Walrus storage](https://walrus.cloud) for on‑chain blob hosting
