import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Copy } from "lucide-react";
import { Transaction } from "@mysten/sui/transactions";
import Header from "@/components/header";
import Footer from "@/components/footer";

/* ------------------------------------------------------------------ */
/* constants                                                          */
/* ------------------------------------------------------------------ */

const GAS_BUDGET = 1; // 1B gas units ≈ 0.01 SUI at 10 mist gas-price

/* ------------------------------------------------------------------ */
/* types                                                              */
/* ------------------------------------------------------------------ */

interface OwnedObject {
  objectId: string;
  name: string;
  type: string;
  verified: boolean;
  image_url?: string;
  description?: string;
}

/* ------------------------------------------------------------------ */
/* component                                                          */
/* ------------------------------------------------------------------ */

export default function TransferObjectPage() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const [recipient, setRecipient] = useState<string>("");
  const [objects, setObjects] = useState<OwnedObject[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState<string>("");
  const [filter, setFilter] = useState<"verified" | "unverified" | "all">(
    "verified",
  );
  const [gasPrice, setGasPrice] = useState<bigint>(0n); // mist / gas-unit

  /* ------------------------------------------------------------------ */
  /* fetch user objects                                                 */
  /* ------------------------------------------------------------------ */

  const fetchObjects = useCallback(async () => {
    if (!account?.address) return;

    let cursor: string | null | undefined = undefined;
    let all: OwnedObject[] = [];
    let hasNextPage = true;

    while (hasNextPage) {
      const res = await client.getOwnedObjects({
        owner: account.address,
        filter: {
          MatchNone: [
            {
              StructType:
                "0x0000000000000000000000000000000000000000000000000000000000000002::coin::Coin",
            },
          ],
        },
        options: { showContent: true, showDisplay: true },
        cursor,
      });

      const page: OwnedObject[] = res.data.map((item) => {
        const display = item.data?.display ?? {};
        const verified =
          !!display.data?.name ||
          !!display.data?.image_url ||
          !!display.data?.description;

        const typeStr = item.data?.content?.type ?? "";
        const typeShort =
          typeStr.split("<", 1)[0].split("::").pop() ?? "Unknown";

        return {
          objectId: item.data?.objectId ?? "",
          name: display.data?.name ?? typeShort,
          description: display.data?.description ?? "",
          image_url: display.data?.image_url,
          type: typeShort,
          verified,
        };
      });

      all.push(...page);
      hasNextPage = res.hasNextPage;
      cursor = res.nextCursor;
    }

    setObjects(all);
  }, [account?.address, client]);

  /* ------------------------------------------------------------------ */
  /* fetch reference gas price                                          */
  /* ------------------------------------------------------------------ */

  const fetchGasPrice = useCallback(async () => {
    try {
      const price = await client.getReferenceGasPrice(); // mist / gas-unit
      setGasPrice(BigInt(price));
    } catch {
      /* ignore */
    }
  }, [client]);

  /* ------------------------------------------------------------------ */
  /* side-effects                                                       */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    fetchObjects();
  }, [fetchObjects]);

  useEffect(() => {
    fetchGasPrice();
    const id = setInterval(fetchGasPrice, 60_000); // refresh every 60 s
    return () => clearInterval(id);
  }, [fetchGasPrice]);

  /* ------------------------------------------------------------------ */
  /* derived data                                                       */
  /* ------------------------------------------------------------------ */

  const filtered = useMemo(() => {
    let list = objects;

    if (filter !== "all") {
      list = list.filter((o) => (filter === "verified" ? o.verified : !o.verified));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.objectId.toLowerCase().includes(q) ||
          o.description?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [objects, filter, search]);

  const estimatedGasSui = useMemo(() => {
    if (gasPrice === 0n) return "—";
    // (gasBudget * gasPrice) mist → SUI
    const mist = BigInt(GAS_BUDGET) * gasPrice;
    const sui = Number(mist) / 1e9;
    return sui.toFixed(9);
  }, [gasPrice]);

  /* ------------------------------------------------------------------ */
  /* actions                                                            */
  /* ------------------------------------------------------------------ */

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id).then(() => {
      toast({ title: "Copied", description: id });
    });
  };

  const handleTransfer = async () => {
    if (!account?.address || !recipient || selectedIds.length === 0) return;

    const tx = new Transaction();
    tx.setSender(account.address);
    tx.setGasBudget(GAS_BUDGET);
    tx.transferObjects(
      selectedIds.map((id) => tx.object(id)),
      tx.pure.address(recipient),
    );

    signAndExecuteTransaction(
      { transaction: tx },
      {
        onSuccess: () => {
          toast({ title: "✅ Transfer succeeded" });
          setSelectedIds([]);
          fetchObjects(); // refresh list
        },
        onError: (err) =>
          toast({ title: "❌ Error", description: err.message }),
      },
    );
  };

  /* ------------------------------------------------------------------ */
  /* render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <main className="max-w-6xl mx-auto py-8 px-4 text-sm text-white">
      <Header />

      <h1 className="text-3xl font-semibold mb-6">Transfer Objects</h1>

      {/* recipient */}
      <section className="mb-6">
        <label className="font-medium block mb-2">Recipient address</label>
        <Input
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="0x..."
        />
      </section>

      {/* search + tabs */}
      <section className="flex flex-col gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Input
            className="flex-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search objects"
          />
          <Button
            variant="outline"
            size="icon"
            aria-label="Refresh"
            onClick={() => fetchObjects()}
          >
            ⟳
          </Button>
        </div>

        <Tabs
          value={filter}
          onValueChange={(v) => setFilter(v as any)}
          className="self-start"
        >
          <TabsList>
            <TabsTrigger value="verified">Verified</TabsTrigger>
            <TabsTrigger value="unverified">Unverified</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
      </section>

      {/* list */}
      <section className="h-[420px] overflow-y-auto mb-8 pr-1">
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground mt-10">
            No matching objects
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filtered.map((obj) => (
              <Card
                key={obj.objectId}
                className={`relative p-4 border bg-gradient-to-b from-slate-800/50 to-slate-700/50 backdrop-blur
                transition-shadow hover:shadow-lg cursor-pointer
                ${selectedIds.includes(obj.objectId) ? "border-cyan-400" : "border-slate-600"}`}
                onClick={() => toggleSelect(obj.objectId)}
              >
                {/* copy icon */}
                <Copy
                  size={16}
                  className="absolute top-3 right-3 opacity-70 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(obj.objectId);
                  }}
                />

                <div className="text-xs uppercase tracking-wide text-cyan-400">
                  {obj.type}
                </div>
                <div className="font-medium truncate">{obj.name}</div>
                <div className="text-muted-foreground text-[10px] mb-2">
                  {obj.objectId.slice(0, 6)}…{obj.objectId.slice(-4)}
                </div>

                {obj.image_url ? (
                  <img
                    src={obj.image_url}
                    className="w-full h-24 object-cover rounded mb-2"
                    alt={obj.name}
                  />
                ) : (
                  <div className="w-full h-24 bg-slate-600/40 rounded mb-2 flex items-center justify-center text-xs text-slate-400">
                    No preview
                  </div>
                )}

                {obj.description && (
                  <p className="line-clamp-2 text-muted-foreground text-xs">
                    {obj.description}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* footer actions */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* gas */}
        <div className="flex items-center gap-1">
          <span className="opacity-70">Gas estimate:</span>
          <img src="/images/sui.svg" alt="sui" className="w-4 h-4" />
          <span>{estimatedGasSui}</span>
        </div>

        {/* buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setSelectedIds([])}
            className="min-w-[96px]"
          >
            Clear
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!recipient || selectedIds.length === 0}
            className="min-w-[120px]"
          >
            Send
            {selectedIds.length > 0 && ` (${selectedIds.length})`}
          </Button>
        </div>
      </section>

      <Footer />
    </main>
  );
}
