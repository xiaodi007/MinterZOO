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
  totalBalance: bigint;
  verified: boolean;
}

/** 单条拆分任务 */
interface SplitTask {
  id: number;
  coin: CoinMeta;
  amountEach: string; // human
  pieces: number;
}

/* ------------------------------------------------------------------ */
/* page                                                               */
/* ------------------------------------------------------------------ */

export default function SplitTokenPage() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  /* ----------------------------- state ------------------------------ */
  const [coins, setCoins] = useState<CoinMeta[]>([]);
  const [filter, setFilter] = useState<"verified" | "unverified" | "all">(
    "verified",
  );
  const [search, setSearch] = useState("");

  /** 当前编辑区 */
  const [selected, setSelected] = useState<CoinMeta | undefined>();
  const [pieces, setPieces] = useState(1);
  const [amount, setAmount] = useState("");

  /** 任务列表 */
  const [tasks, setTasks] = useState<SplitTask[]>([]);

  const [gasPrice, setGasPrice] = useState<bigint>(0n);

  /* ----------------------------- fetch coins ------------------------ */
  const fetchCoins = useCallback(async () => {
    if (!account?.address) return;
    const balances = await client.getAllBalances({ owner: account.address });

    const metas = await Promise.all(
      balances.map(async (b) => {
        const meta = await client.getCoinMetadata({ coinType: b.coinType });
        return {
          coinType: b.coinType,
          symbol: meta.symbol ?? "UNK",
          name: meta.name ?? b.coinType.split("::").pop()!,
          decimals: meta.decimals ?? 9,
          iconUrl: meta.iconUrl ?? undefined,
          totalBalance: BigInt(b.totalBalance),
          verified:
            !!meta.iconUrl || !!meta.name || !!meta.symbol || meta.decimals > 0,
        } satisfies CoinMeta;
      }),
    );
    setCoins(metas);
  }, [account?.address, client]);

  /* ----------------------------- fetch gas -------------------------- */
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

  /* ----------------------------- derived ---------------------------- */
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

  /** 当前余额 / 剩余金额  */
  const remainderInfo = useMemo(() => {
    if (!selected || !amount) return { ok: false, remainder: "-" };

    const baseEach = BigInt(
      Math.round(Number(amount) * 10 ** selected.decimals + Number.EPSILON),
    );
    const totalBase = baseEach * BigInt(pieces);
    const balance = selected.totalBalance;

    const ok = balance >= totalBase;
    const remainderBase = ok ? balance - totalBase : 0n;
    const remainder = ok
      ? (Number(remainderBase) / 10 ** selected.decimals).toLocaleString()
      : "Insufficient";
    return { ok, remainder };
  }, [selected, amount, pieces]);

  const estimatedGasSui = useMemo(() => {
    if (gasPrice === 0n) return "—";
    return (Number(BigInt(GAS_BUDGET) * gasPrice) / 1e9).toFixed(4);
  }, [gasPrice]);

  const canAdd =
    selected &&
    amount &&
    Number(amount) > 0 &&
    pieces > 0 &&
    remainderInfo.ok;

  const canSend = tasks.length > 0;

  /* ----------------------------- helpers ---------------------------- */
  const resetEditor = () => {
    setSelected(undefined);
    setPieces(1);
    setAmount("");
  };

  const addTask = () => {
    if (!canAdd || !selected) return;
    setTasks((prev) => [
      ...prev,
      {
        id: Date.now(),
        coin: selected,
        amountEach: amount,
        pieces,
      },
    ]);
    resetEditor();
  };

  const removeTask = (id: number) =>
    setTasks((prev) => prev.filter((t) => t.id !== id));

  /* ----------------------------- send tx ---------------------------- */
  const handleSend = async () => {
    if (!account?.address || tasks.length === 0) return;

    const tx = new Transaction();
    tx.setSender(account.address);
    tx.setGasBudget(GAS_BUDGET);

    // 分组同 coinType，避免多次取 UTXO
    const group: Record<string, SplitTask[]> = {};
    tasks.forEach((t) => {
      if (!group[t.coin.coinType]) group[t.coin.coinType] = [];
      group[t.coin.coinType].push(t);
    });

    for (const [coinType, list] of Object.entries(group)) {
      // 拿第一枚 coin 对象
      const { data } = await client.getCoins({
        owner: account.address,
        coinType,
        limit: 1,
      });
      if (data.length === 0) {
        toast({ title: "Insufficient balance", description: coinType });
        return;
      }
      const sourceId = data[0].coinObjectId;

      list.forEach((task) => {
        const baseEach = BigInt(
          Math.round(
            Number(task.amountEach) * 10 ** task.coin.decimals +
              Number.EPSILON,
          ),
        );
        const amounts = Array(task.pieces).fill(baseEach);
        const newCoins = tx.splitCoins(tx.object(sourceId), 
          amounts,
        );
         tx.transferObjects([newCoins], tx.pure.address(account.address));
        // 不 transfer，保留本地址；为了不返回数组处理复杂，这里直接忽略 newCoins
      });
    }

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: () => {
          toast({ title: "✅ Split succeeded" });
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
      <h1 className="text-3xl font-semibold mb-6">Split Tokens</h1>

      {/* ───── Selector & editor ───── */}
      <Card className="p-6 mb-8 bg-slate-800/50 border border-slate-600 space-y-6">
        {/* token selector */}
        <section>
          <label className="block font-medium mb-2">Select token</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between h-11"
              >
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
                <Button
                  variant="outline"
                  size="icon"
                  onClick={fetchCoins}
                  aria-label="refresh"
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

              <div className="h-64 overflow-y-auto space-y-1 pr-1">
                {filteredCoins.map((c) => (
                  <div
                    key={c.coinType}
                    onClick={() => {
                      setSelected(c);
                      setPieces(1);
                      setAmount("");
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
                      <div className="font-medium leading-none">
                        {c.symbol}
                      </div>
                      <div className="text-xs opacity-70">{c.name}</div>
                    </div>
                    <div className="text-right">
                      <div>
                        {(
                          Number(c.totalBalance) / 10 ** c.decimals
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
                              "_blank",
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
        </section>

        {/* pieces count */}
        <section>
          <label className="block font-medium mb-2">Pieces</label>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              disabled={pieces === 1}
              onClick={() => setPieces((p) => Math.max(1, p - 1))}
            >
              <Minus size={14} />
            </Button>
            <span className="w-8 text-center">{pieces}</span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPieces((p) => p + 1)}
            >
              <Plus size={14} />
            </Button>
          </div>
        </section>

        {/* amount each */}
        <section>
          <label className="block font-medium mb-2">Amount each</label>
          <Input
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </section>

        {/* remainder */}
        <section>
          <label className="block font-medium mb-2">Remainder</label>
          <Input
            disabled
            className={
              remainderInfo.ok ? "" : "border-destructive text-destructive"
            }
            value={remainderInfo.remainder}
          />
        </section>

        <Button
          className="w-full"
          disabled={!canAdd}
          onClick={addTask}
        >
          Add
        </Button>
      </Card>

      {/* ───── task list ───── */}
      {tasks.length > 0 && (
        <section className="space-y-3 mb-10">
          {tasks.map((t) => (
            <Card
              key={t.id}
              className="p-4 flex items-center justify-between bg-slate-800/40 border border-slate-700"
            >
              <div>
                <div className="font-medium">
                  {t.coin.symbol} × {t.pieces} → {t.amountEach} each
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
