import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import {
  ChevronDown,
  Copy,
  ExternalLink,
  Plus,
  RefreshCcw,
  X,
} from "lucide-react";
import { Transaction } from "@mysten/sui/transactions";
import { CoinStruct } from "@mysten/sui/client";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { formatNumericInput } from "@/lib/utils";

import {
  fetchAllCoinsByType,
  getTotalBalanceBigInt,
  formatAmount,
} from "@/utils/utils";
/* ------------------------------------------------------------------ */
/* Helpers & types                                                    */
/* ------------------------------------------------------------------ */

const GAS_BUDGET = 500_000_000; // conservative for multi‐transfer

interface CoinMeta {
  coinType: string;
  symbol: string;
  name: string;
  decimals: number;
  iconUrl?: string;
  totalBalance: bigint; // in base units
  verified: boolean;
}

interface Row {
  id: number;
  coin?: CoinMeta;
  amount: string; // human-readable
}

/* ------------------------------------------------------------------ */
/* Main page                                                          */
/* ------------------------------------------------------------------ */

export default function TransferTokensPage() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const [rows, setRows] = useState<Row[]>([{ id: Date.now(), amount: "" }]);
  const [recipient, setRecipient] = useState("");
  const [coins, setCoins] = useState<CoinMeta[]>([]);
  const [filter, setFilter] = useState<"verified" | "unverified" | "all">(
    "verified"
  );
  const [search, setSearch] = useState("");
  const [gasPrice, setGasPrice] = useState<bigint>(BigInt(0));

  /* ----------------------------- fetch coins ----------------------------- */

  const fetchCoins = useCallback(async () => {
    if (!account?.address) return;

    // 1. 所有余额
    const balances = await client.getAllBalances({ owner: account.address });

    // 2. 并行获取 metadata
    const metas = await Promise.all(
      balances.map(async (b) => {
        const meta = await client.getCoinMetadata({ coinType: b.coinType });
        return {
          coinType: b.coinType,
          symbol: meta?.symbol ?? "UNK",
          name: meta?.name ?? b.coinType.split("::").pop()!,
          decimals: meta?.decimals ?? 9,
          iconUrl: meta?.iconUrl ?? undefined,
          totalBalance: BigInt(b.totalBalance),
          verified: !!meta?.iconUrl || !!meta?.name || !!meta?.symbol,
        } satisfies CoinMeta;
      })
    );

    setCoins(metas);
  }, [account?.address, client]);

  /* ----------------------------- fetch gas ------------------------------ */

  const fetchGasPrice = useCallback(async () => {
    try {
      setGasPrice(BigInt(await client.getReferenceGasPrice()));
    } catch {
      /* ignore */
    }
  }, [client]);

  useEffect(() => {
    fetchCoins();
  }, [fetchCoins]);

  useEffect(() => {
    fetchGasPrice();
    const t = setInterval(fetchGasPrice, 60_000);
    return () => clearInterval(t);
  }, [fetchGasPrice]);

  /* ----------------------------- derived -------------------------------- */

  const filteredCoins = useMemo(() => {
    let list = coins;
    if (filter !== "all") {
      list = list.filter((c) =>
        filter === "verified" ? c.verified : !c.verified
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.symbol.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.coinType.toLowerCase().includes(q)
      );
    }
    return list;
  }, [coins, filter, search]);

  const estimatedGasSui = useMemo(() => {
    if (gasPrice === BigInt(0)) return "—";
    const sui = Number(BigInt(GAS_BUDGET) * gasPrice) / 1e9;
    return sui.toFixed(4);
  }, [gasPrice]);

  const canSend =
    recipient &&
    rows.every((r) => r.coin && r.amount && Number(r.amount) > 0) &&
    rows.length > 0;

  /* ------------------------- Row helpers -------------------------------- */

  const updateRow = (id: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const addRow = () =>
    setRows((prev) => [...prev, { id: Date.now(), amount: "" }]);

  const removeRow = (id: number) =>
    setRows((prev) => prev.filter((r) => r.id !== id));

  /* ------------------------- transfer logic ----------------------------- */

  const handleSend = async () => {
    if (!account?.address || !canSend) return;

    // pre-fetch coin objects we’ll need
    const coinObjects: Record<string, { coins: CoinStruct[]; total: bigint }> =
      {};
    for (const { coin, amount } of rows) {
      if (!coin || coinObjects[coin.coinType]) continue;

      const coins = await fetchAllCoinsByType(
        client,
        account.address,
        coin.coinType
      );
      const total = getTotalBalanceBigInt(coins);
      const base = BigInt(
        Math.round(Number(amount) * 10 ** coin.decimals + Number.EPSILON)
      );

      if (total < base) {
        toast({
          title: "Insufficient balance",
          description:
            `Coin: ${coin.symbol} (${coin.coinType})\n` +
            `Required: ${base}\nAvailable: ${total}\nShortfall: ${
              base - total
            }`,
        });
        return;
      }

      coinObjects[coin.coinType] = { coins, total };
    }

    /* -------- build tx -------- */
    const tx = new Transaction();
    tx.setSender(account.address);
    tx.setGasBudget(GAS_BUDGET);

    for (const coinType in coinObjects) {
      const coins = coinObjects[coinType].coins;
      if (coins.length > 1) {
        const sourceId = coins[0].coinObjectId;
        const mergeList = coins.slice(1).map((c) => c.coinObjectId);
        tx.mergeCoins(sourceId, mergeList);
      }
    }

    rows.forEach(({ coin, amount }) => {
      if (!coin || !amount) return;

      const base = BigInt(
        Math.round(Number(amount) * 10 ** coin.decimals + Number.EPSILON)
      );

      const coins = coinObjects[coin.coinType].coins;
      const sourceId =
        coin.coinType === "0x2::sui::SUI"
          ? tx.gas
          : tx.object(coins[0].coinObjectId); // 已 merge 到第一个

      const [newCoin] = tx.splitCoins(sourceId, [base]);
      tx.transferObjects([newCoin], tx.pure.address(recipient));
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: () => {
          toast({ title: "✅ Transaction sent" });
          setRows([{ id: Date.now(), amount: "" }]);
          fetchCoins();
        },
        onError: (e) => toast({ title: "❌ Error", description: e.message }),
      }
    );
  };

  /* ------------------------------------------------------------------ */
  /* render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <main className="relative w-full min-h-screen mx-auto flex flex-col">
      <Header />

      <section className="w-full max-w-6xl mx-auto py-8 px-4 flex-1">
        <h1 className="text-3xl font-semibold mb-6">Transfer Tokens</h1>

        {/* recipient */}
        <section className="mb-8">
          <label className="font-medium block mb-2">Recipient address</label>
          <Input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x..."
          />
        </section>

        {/* rows */}
        <section className="space-y-6 mb-8">
          {rows.map((row, idx) => (
            <Card
              key={row.id}
              className="p-4 bg-slate-800/50 backdrop-blur border border-slate-600 space-y-4 relative"
            >
              {rows.length > 1 && (
                <X
                  size={16}
                  className="absolute top-3 right-3 cursor-pointer opacity-70 hover:opacity-100"
                  onClick={() => removeRow(row.id)}
                />
              )}

              {/* selector + amount */}
              <div className="flex flex-col sm:flex-row gap-4">
                {/* token selector */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full sm:w-48 justify-between"
                    >
                      {row.coin ? row.coin.symbol : "Select token"}
                      <ChevronDown size={16} className="ml-2" />
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent className="w-[380px] p-4 space-y-3 bg-slate-800 border-slate-700">
                    {/* search */}
                    <div className="flex items-center gap-2">
                      <Input
                        className="flex-1"
                        placeholder="Search tokens"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={fetchCoins}
                      >
                        <RefreshCcw size={16} />
                      </Button>
                    </div>

                    {/* tabs */}
                    <Tabs
                      value={filter}
                      onValueChange={(v) => setFilter(v as any)}
                      className="mb-2"
                    >
                      <TabsList>
                        <TabsTrigger value="verified">Verified</TabsTrigger>
                        <TabsTrigger value="unverified">Unverified</TabsTrigger>
                        <TabsTrigger value="all">All</TabsTrigger>
                      </TabsList>
                    </Tabs>

                    {/* list */}
                    <div className="h-64 overflow-y-auto pr-1 space-y-1">
                      {filteredCoins.map((c) => (
                        <div
                          key={c.coinType}
                          onClick={() => {
                            updateRow(row.id, { coin: c });
                          }}
                          className="flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-slate-700/60"
                        >
                          {/* icon */}
                          {c.iconUrl ? (
                            <img
                              src={c.iconUrl}
                              alt={c.symbol}
                              className="w-7 h-7 rounded-full"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-slate-600" />
                          )}

                          <div className="flex-1">
                            <div className="font-medium leading-none">
                              {c.symbol}
                            </div>
                            <div className="text-xs opacity-70">{c.name}</div>
                          </div>

                          <div className="text-right">
                            <div>
                              {(
                                Number(c.totalBalance) /
                                10 ** c.decimals
                              ).toLocaleString()}
                            </div>
                            <div className="text-xs opacity-50 flex items-center gap-1">
                              {c.coinType.slice(0, 4)}…{c.coinType.slice(-4)}
                              <Copy
                                size={12}
                                className="cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(c.coinType);
                                  toast({ title: "Copied" });
                                }}
                              />
                              <ExternalLink
                                size={12}
                                className="opacity-70 hover:opacity-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(
                                    `https://suivision.xyz/coin/${c.coinType}`,
                                    "_blank"
                                  );
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* amount input */}
                <div className="flex-1 flex gap-2">
                  <Input
                    value={row.amount}
                    type="number"
                    onChange={(e) =>
                      updateRow(row.id, {
                        amount: formatNumericInput(e.target.value),
                      })
                    }
                    placeholder="0.0"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (!row.coin) return;
                      updateRow(row.id, {
                        amount: (
                          Number(row.coin.totalBalance) /
                          10 ** row.coin.decimals
                        ).toString(),
                      });
                    }}
                  >
                    MAX
                  </Button>
                </div>
              </div>

              {idx === rows.length - 1 && (
                <Button
                  variant="link"
                  size="sm"
                  className="mt-2"
                  onClick={addRow}
                >
                  <Plus size={14} className="mr-1" />
                  Add another token
                </Button>
              )}
            </Card>
          ))}
        </section>

        {/* footer actions */}
        <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-1">
            <span className="opacity-70">Gas estimate:</span>
            <img src="/images/sui.svg" className="w-4 h-4" />
            <span>{estimatedGasSui}</span>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setRows([{ id: Date.now(), amount: "" }])}
              className="min-w-[96px]"
            >
              Clear
            </Button>
            <Button
              disabled={!canSend}
              onClick={handleSend}
              className="min-w-[120px] bg-[#818cf8]"
            >
              Send
            </Button>
          </div>
        </section>
      </section>
      <Footer />
    </main>
  );
}
