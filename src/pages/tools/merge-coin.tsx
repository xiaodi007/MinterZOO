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
  Minus,
  Plus,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { Transaction } from "@mysten/sui/transactions";
import Header from "@/components/header";
import Footer from "@/components/footer";

/* ------------------------------------------------------------------ */
/* constants & types                                                  */
/* ------------------------------------------------------------------ */

const GAS_BUDGET = 2_000_000_000;

interface CoinMeta {
  coinType: string;
  symbol: string;
  name: string;
  decimals: number;
  iconUrl?: string;
  objectCount: number;
  verified: boolean;
}

interface MergeTask {
  id: number;
  coin: CoinMeta;
  sources: number;      // how many coin objects to merge (excluding target)
  mergeAll: boolean;
}

/* ------------------------------------------------------------------ */
/* page                                                               */
/* ------------------------------------------------------------------ */

export default function MergeTokensPage() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  /* ---------------------------- state ------------------------------ */
  const [coins, setCoins] = useState<CoinMeta[]>([]);
  const [filter, setFilter] = useState<"verified" | "unverified" | "all">(
    "verified",
  );
  const [search, setSearch] = useState("");

  // editor
  const [selected, setSelected] = useState<CoinMeta | undefined>();
  const [sources, setSources] = useState(1);
  const [mergeAll, setMergeAll] = useState(false);

  // tasks
  const [tasks, setTasks] = useState<MergeTask[]>([]);
  const [gasPrice, setGasPrice] = useState<bigint>(BigInt(0));

  /* ------------------------ fetch balances ------------------------- */
const fetchCoins = useCallback(async () => {
  if (!account?.address) return;

  const balances = await client.getAllBalances({ owner: account.address });

  const metas = await Promise.all(
    balances.map(async (b) => {
      // 🚩 逐页拉满 getCoins
      let cursor: string | null | undefined = undefined;
      let count = 0;

      do {
        const page = await client.getCoins({
          owner: account.address,
          coinType: b.coinType,
          cursor,
          limit: 50,            // page size，可自行调大
        });
        count += page.data.length;
        cursor = page.nextCursor;
      } while (cursor);

      const meta = await client.getCoinMetadata({ coinType: b.coinType });

      return {
  coinType: b.coinType,
  symbol:  meta?.symbol   ?? "UNK",
  name:    meta?.name     ?? b.coinType.split("::").pop()!,
  decimals:meta?.decimals ?? 9,
  iconUrl: meta?.iconUrl  ?? undefined,
  verified:
    !!meta?.iconUrl || !!meta?.name || !!meta?.symbol || !!meta?.decimals,
      } as CoinMeta;
    }),
  );

  setCoins(metas);
}, [account?.address, client]);


  /* ------------------------ fetch gas price ------------------------ */
  const fetchGasPrice = useCallback(async () => {
    try {
      setGasPrice(BigInt(await client.getReferenceGasPrice()));
    } catch {}
  }, [client]);

  useEffect(() => {
    fetchCoins();
  }, [fetchCoins]);

  useEffect(() => {
    fetchGasPrice();
    const t = setInterval(fetchGasPrice, 60_000);
    return () => clearInterval(t);
  }, [fetchGasPrice]);

  /* --------------------------- derived ----------------------------- */
  const filteredCoins = useMemo(() => {
    let list = coins;
    if (filter !== "all") {
      list = list.filter((c) =>
        filter === "verified" ? c.verified : !c.verified,
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.symbol.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.coinType.toLowerCase().includes(q),
      );
    }
    return list;
  }, [coins, filter, search]);

  const estimatedGasSui = useMemo(() => {
    if (gasPrice === BigInt(0)) return "—";
    return (Number(BigInt(GAS_BUDGET) * gasPrice) / 1e9).toFixed(4);
  }, [gasPrice]);

  const canAdd =
    selected &&
    (mergeAll
      ? selected.objectCount > 1
      : sources > 0 && sources < selected.objectCount);

  const canSend = tasks.length > 0;

  /* ----------------------------- helpers --------------------------- */
  const resetEditor = () => {
    setSelected(undefined);
    setSources(1);
    setMergeAll(false);
  };

  const addTask = () => {
    if (!canAdd || !selected) return;
    setTasks((prev) => [
      ...prev,
      {
        id: Date.now(),
        coin: selected,
        sources: mergeAll ? selected.objectCount - 1 : sources,
        mergeAll,
      },
    ]);
    resetEditor();
  };

  const removeTask = (id: number) =>
    setTasks((prev) => prev.filter((t) => t.id !== id));

  /* ----------------------------- send tx --------------------------- */
  const handleSend = async () => {
    if (!account?.address || tasks.length === 0) return;

    const tx = new Transaction();
    tx.setSender(account.address);
    tx.setGasBudget(GAS_BUDGET);

 for (const task of tasks) {
  const required = task.sources + 1;            // 目标 + 来源
  const ids: string[] = [];
  let cursor: string | null | undefined = undefined;

  while (ids.length < required) {
    const page = await client.getCoins({
      owner: account.address,
      coinType: task.coin.coinType,
      cursor,
      limit: 50,
    });
    ids.push(...page.data.map((c) => c.coinObjectId));
    if (!page.hasNextPage) break;
    cursor = page.nextCursor;
  }

  if (ids.length < required) {
    toast({
      title: "Not enough coin objects",
      description: `${task.coin.symbol}`,
    });
    return;
  }

  const [targetId, ...sourceIds] = ids.slice(0, required);

  tx.mergeCoins(
    tx.object(targetId),
    sourceIds.map((id) => tx.object(id)),
  );
}


    signAndExecute(
      { transaction: tx },
      {
        onSuccess: () => {
          toast({ title: "✅ Merge succeeded" });
          setTasks([]);
          fetchCoins();
        },
        onError: (e) => toast({ title: "❌ Error", description: e.message }),
      },
    );
  };

  /* ------------------------------------------------------------------ */
  /* render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <main className="max-w-6xl mx-auto py-8 px-4 text-sm text-white">
      <Header />
      <h1 className="text-3xl font-semibold mb-6">Merge Tokens</h1>

      {/* ───── Editor ───── */}
      <Card className="p-6 mb-8 bg-slate-800/50 border border-slate-600 space-y-6">
        {/* token selector */}
        <section>
          <label className="block font-medium mb-2">Token</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between h-11">
                {selected ? (
                  <span className="flex items-center gap-2">
                    {selected.iconUrl ? (
                      <img
                        src={selected.iconUrl}
                        className="w-5 h-5 rounded-full"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-slate-600" />
                    )}
                    {selected.symbol}
                  </span>
                ) : (
                  "Choose token"
                )}
                <ChevronDown size={16} className="ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[380px] p-4 bg-slate-800 border-slate-700 space-y-3">
              {/* search */}
              <div className="flex items-center gap-2">
                <Input
                  className="flex-1"
                  placeholder="Search tokens"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Button variant="outline" size="icon" onClick={fetchCoins}>
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

              <div className="h-64 overflow-y-auto pr-1 space-y-1">
                {filteredCoins.map((c) => (
                  <div
                    key={c.coinType}
                    onClick={() => {
                      setSelected(c);
                      setSources(1);
                      setMergeAll(false);
                    }}
                    className="flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-slate-700/60"
                  >
                    {c.iconUrl ? (
                      <img
                        src={c.iconUrl}
                        className="w-7 h-7 rounded-full"
                        alt={c.symbol}
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-slate-600" />
                    )}

                    <div className="flex-1">
                      <div className="font-medium leading-none">{c.symbol}</div>
                      <div className="text-xs opacity-70">{c.name}</div>
                    </div>

                    <div className="text-right text-sm">
                      {c.objectCount} objects
                    </div>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </section>

        {/* number selector */}
        {selected && (
          <section>
            <label className="block font-medium mb-2">Sources to merge</label>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                disabled={sources === 1 || mergeAll}
                onClick={() => setSources((s) => Math.max(1, s - 1))}
              >
                <Minus size={14} />
              </Button>
              <span className="w-8 text-center">{mergeAll ? "All" : sources}</span>
              <Button
                variant="outline"
                size="icon"
                disabled={mergeAll || sources >= selected.objectCount - 1}
                onClick={() =>
                  setSources((s) =>
                    Math.min(selected.objectCount - 1, s + 1),
                  )
                }
              >
                <Plus size={14} />
              </Button>

              <Button
                size="sm"
                variant={mergeAll ? "default" : "outline"}
                className="ml-auto"
                onClick={() => setMergeAll((v) => !v)}
              >
                Merge all
              </Button>
            </div>
          </section>
        )}

        <Button className="w-full" disabled={!canAdd} onClick={addTask}>
          Add
        </Button>
      </Card>

      {/* ───── Task list ───── */}
      {tasks.length > 0 && (
        <section className="space-y-3 mb-10">
          {tasks.map((t) => (
            <Card
              key={t.id}
              className="p-4 flex items-center justify-between bg-slate-800/40 border border-slate-700"
            >
              <div>
                <div className="font-medium">
                  {t.coin.symbol} — merge{" "}
                  {t.mergeAll ? "all" : `${t.sources}`} object
                  {t.mergeAll || t.sources > 1 ? "s" : ""}
                </div>
                <div className="text-xs opacity-70">
                  {t.coin.coinType.slice(0, 6)}…{t.coin.coinType.slice(-4)}
                </div>
              </div>
              <Trash2
                size={16}
                className="cursor-pointer opacity-70 hover:opacity-100"
                onClick={() => removeTask(t.id)}
              />
            </Card>
          ))}
        </section>
      )}

      {/* ───── footer actions ───── */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-1">
          <span className="opacity-70">Gas estimate:</span>
          <img src="/images/sui.svg" className="w-4 h-4" />
          <span>{estimatedGasSui}</span>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setTasks([]);
              resetEditor();
            }}
            className="min-w-[96px]"
          >
            Clear
          </Button>
          <Button
            disabled={!canSend}
            onClick={handleSend}
            className="min-w-[120px]"
          >
            Send
          </Button>
        </div>
      </section>

      <Footer />
    </main>
  );
}
