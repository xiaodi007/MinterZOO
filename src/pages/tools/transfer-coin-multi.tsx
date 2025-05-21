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
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import {
  ChevronDown,
  Copy,
  ExternalLink,
  Plus,
  RefreshCcw,
  UploadCloud,
  X,
} from "lucide-react";
import { Transaction } from "@mysten/sui/transactions";
import Papa from "papaparse";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { formatNumericInput } from "@/lib/utils";
import {
  fetchAllCoinsByType,
  getTotalBalanceBigInt,
  formatAmount,
} from "./utils";
/* ------------------------------------------------------------------ */
/* constants & types                                                  */
/* ------------------------------------------------------------------ */

const GAS_BUDGET = 500_000_000;

interface CoinMeta {
  coinType: string;
  symbol: string;
  name: string;
  decimals: number;
  iconUrl?: string;
  totalBalance: bigint;
  verified: boolean;
}

interface RecipientRow {
  id: number;
  address: string;
  amount: string; // human
}

/* ------------------------------------------------------------------ */
/* page                                                               */
/* ------------------------------------------------------------------ */

export default function TransferTokensMulti() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  /* ------------------------------- state ------------------------------ */
  const CSV_INPUT_ID = "csv-input-multi-transfer";
  const [token, setToken] = useState<CoinMeta | undefined>();
  const [rows, setRows] = useState<RecipientRow[]>([
    { id: Date.now(), address: "", amount: "" },
  ]);
  const [coins, setCoins] = useState<CoinMeta[]>([]);
  const [filter, setFilter] = useState<"verified" | "unverified" | "all">(
    "verified"
  );
  const [search, setSearch] = useState("");
  const [equalSplit, setEqualSplit] = useState(false);
  const [totalAmount, setTotalAmount] = useState(""); // used only when equalSplit
  const [gasPrice, setGasPrice] = useState<bigint>(BigInt(0));

  /* ------------------------------ fetch coins ------------------------- */

  const fetchCoins = useCallback(async () => {
    if (!account?.address) return;
    const balances = await client.getAllBalances({ owner: account.address });

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

  /* ------------------------------ fetch gas -------------------------- */

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

  /* ------------------------------ derived ---------------------------- */

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
    return (Number(BigInt(GAS_BUDGET) * gasPrice) / 1e9).toFixed(4);
  }, [gasPrice]);

  const canSend = useMemo(() => {
    if (!token) return false;
    if (equalSplit) {
      return (
        totalAmount &&
        rows.every((r) => r.address) &&
        Number(totalAmount) > 0 &&
        rows.length > 0
      );
    }
    return (
      rows.every((r) => r.address && r.amount && Number(r.amount) > 0) &&
      rows.length > 0
    );
  }, [token, rows, equalSplit, totalAmount]);

  /* ---------------------------- row helpers -------------------------- */

  const updateRow = (id: number, patch: Partial<RecipientRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const addRow = () =>
    setRows((prev) => [...prev, { id: Date.now(), address: "", amount: "" }]);

  const removeRow = (id: number) =>
    setRows((prev) => prev.filter((r) => r.id !== id));

  /* ---------------------------- CSV import --------------------------- */

  const handleCSV = (file: File) => {
    Papa.parse(file, {
      complete(res) {
        const newRows: RecipientRow[] = [];
        res.data.forEach((row: any) => {
          if (Array.isArray(row) && row.length >= 2) {
            const [addr, amt] = row;
            if (typeof addr === "string" && typeof amt !== "undefined") {
              newRows.push({
                id: Date.now() + Math.random(),
                address: addr.trim(),
                amount: String(amt).trim(),
              });
            }
          }
        });
        if (newRows.length === 0) {
          toast({ title: "Invalid CSV file" });
          return;
        }
        setRows((prev) => [...prev, ...newRows]);
        toast({
          title: "Imported",
          description: `${newRows.length} rows added`,
        });
      },
    });
  };

  /* ---------------------------- transfer ----------------------------- */

  const handleSend = async () => {
    if (!account?.address || !token || !canSend) return;

    // fetch first coin object
    // const { data } = await client.getCoins({
    //   owner: account.address,
    //   coinType: token.coinType,
    //   limit: 1,
    // });
    const data = await fetchAllCoinsByType(
      client,
      account.address,
      token.coinType
    );

    const totalBalance = getTotalBalanceBigInt(data);

    if (totalBalance === BigInt(0)) {
      toast({ title: "Insufficient balance" });
      return;
    }
    const sourceId = data[0].coinObjectId;

    const tx = new Transaction();
    tx.setSender(account.address);
    tx.setGasBudget(GAS_BUDGET);

    if (data.length >= 2) {
      let allList = data.slice(1).map((coin) => coin.coinObjectId);

      tx.mergeCoins(sourceId, allList);
    }

    /* split & transfer */
    if (equalSplit) {
      const totalBase = BigInt(
        Math.round(Number(totalAmount) * 10 ** token.decimals + Number.EPSILON)
      );
      if (totalBalance < totalBase) {
        toast({
          title: "Insufficient balance",
          description:
            `Current balance: ${formatAmount(totalBalance, token.decimals)}\n` +
            `Required: ${formatAmount(totalBase, token.decimals)}\n` +
            `Shortfall: ${formatAmount(
              totalBase - totalBalance,
              token.decimals
            )}`,
        });
        return;
      }
      const amountEach = totalBase / BigInt(rows.length);
      const remainder = totalBase - amountEach * BigInt(rows.length);

      rows.forEach((r, idx) => {
        const base = idx === 0 ? amountEach + remainder : amountEach; // handle remainder
        const [coinSplit] = tx.splitCoins(tx.object(sourceId), [base]);
        tx.transferObjects([coinSplit], tx.pure.address(r.address));
      });
    } else {
      let sum = BigInt(0);
      const splits: { amount: bigint; address: string }[] = [];

      for (const r of rows) {
        const base = BigInt(
          Math.round(Number(r.amount) * 10 ** token.decimals + Number.EPSILON)
        );
        sum += base;
        splits.push({ amount: base, address: r.address });
      }

      if (totalBalance < sum) {
        toast({
          title: "Insufficient balance",
          description:
            `Current balance: ${formatAmount(totalBalance, token.decimals)}\n` +
            `Required: ${formatAmount(sum, token.decimals)}\n` +
            `Shortfall: ${formatAmount(sum - totalBalance, token.decimals)}`,
        });
        return;
      }

      splits.forEach((s) => {
        const [coinSplit] = tx.splitCoins(tx.object(sourceId), [s.amount]);
        tx.transferObjects([coinSplit], tx.pure.address(s.address));
      });
    }

    /* sign & execute */
    signAndExecute(
      { transaction: tx },
      {
        onSuccess: () => {
          toast({ title: "✅ Transaction sent" });
          setRows([{ id: Date.now(), address: "", amount: "" }]);
          setTotalAmount("");
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
        <h1 className="text-3xl font-semibold mb-6">
          Transfer Tokens <span className="opacity-70">(multi-recipient)</span>
        </h1>

        {/* token selector */}
        <section className="mb-6">
          <label className="font-medium block mb-2">Token to transfer</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                {token ? (
                  <span className="flex items-center gap-2">
                    {token.iconUrl ? (
                      <img
                        src={token.iconUrl}
                        className="w-5 h-5 rounded-full"
                        alt={token.symbol}
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-slate-600" />
                    )}
                    {token.symbol}
                  </span>
                ) : (
                  "Select token"
                )}
                <ChevronDown size={16} className="ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[380px] p-4 space-y-3 bg-slate-800 border-slate-700">
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
                    onClick={() => setToken(c)}
                    className="flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-slate-700/60"
                  >
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
                      <div className="font-medium leading-none">{c.symbol}</div>
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
        </section>

        {/* recipient rows */}
        <section className="space-y-6 mb-2">
          {rows.map((r, idx) => (
            <Card
              key={r.id}
              className="p-4 bg-slate-800/50 backdrop-blur border border-slate-600 space-y-3 relative"
            >
              {rows.length > 1 && (
                <X
                  size={16}
                  className="absolute top-3 right-3 cursor-pointer opacity-70 hover:opacity-100"
                  onClick={() => removeRow(r.id)}
                />
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  className="flex-1"
                  placeholder={`Recipient ${idx + 1} address`}
                  value={r.address}
                  onChange={(e) =>
                    updateRow(r.id, { address: e.target.value.trim() })
                  }
                />

                {!equalSplit && (
                  <Input
                    placeholder="Amount"
                    className="sm:w-40"
                    value={r.amount}
                    onChange={(e) =>
                      updateRow(r.id, {
                        amount: formatNumericInput(e.target.value),
                      })
                    }
                  />
                )}
              </div>

              {idx === rows.length - 1 && (
                <Button variant="link" size="sm" onClick={addRow}>
                  <Plus size={14} className="mr-1" /> Add another recipient
                </Button>
              )}
            </Card>
          ))}
        </section>

        {/* equal split */}
        <section className="h-[40px] mb-6 flex items-center gap-3">
          <Switch
            checked={equalSplit}
            className={`w-11 h-6 rounded-full relative transition-colors ${
              equalSplit ? "bg-[#818cf8]" : "bg-gray-300"
            }`}
            onCheckedChange={(v) => {
              setEqualSplit(v);
              setRows((prev) =>
                prev.map((r) => ({ ...r, amount: v ? "" : r.amount }))
              );
            }}
          />
          <span>Equal split</span>

          {equalSplit && (
            <Input
              className="w-40 ml-4"
              placeholder="Total amount"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
            />
          )}
        </section>

        {/* CSV upload */}
        <section className="mb-8">
          <label className="block mb-2 font-medium">Upload CSV</label>
          <input
            id={CSV_INPUT_ID}
            type="file"
            accept=".csv,text/csv"
            className="sr-only" // ⬅️ Tailwind 的无障碍隐藏写法，保留触发
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleCSV(file);
              e.target.value = "";
            }}
          />
          <label htmlFor={CSV_INPUT_ID} className="inline-block">
            <Button variant="outline">
              <UploadCloud size={16} className="mr-1" />
              Choose file
            </Button>
          </label>

          <Button
            variant="secondary"
            onClick={() => {
              // 1) 生成示例内容
              const header = ["address", "amount"].join(",") + "\n";
              const sample = [
                ["0xabc...1234", "100.5"],
                ["0xdef...5678", "200"],
              ]
                .map((row) => row.join(","))
                .join("\n");

              // 2) 创建 Blob & 触发下载
              const blob = new Blob([header + sample], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "multi-transfer-template.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Download template
          </Button>
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
              onClick={() => {
                setRows([{ id: Date.now(), address: "", amount: "" }]);
                setTotalAmount("");
              }}
              className="min-w-[96px]"
            >
              Clear
            </Button>
            <Button
              onClick={handleSend}
              disabled={!canSend}
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
