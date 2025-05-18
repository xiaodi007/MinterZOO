import {
  useCurrentAccount,
  useSuiClient,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Info, Trash2 } from "lucide-react";
import { Transaction } from "@mysten/sui/transactions";
import Header from "@/components/header";
import Footer from "@/components/footer";

/* ------------------------------------------------------------------ */
/* constants                                                          */
/* ------------------------------------------------------------------ */

const GAS_BUDGET = 1_000_000_000;
const MAX_BATCH = 1024; // destroy up to 1024 zero-balance Coin objects

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

type ZeroCoin = {
  objectId: string;
  coinType: string;
  symbol: string;
  icon?: string;
};

function formatSymbol(coinType: string) {
  return coinType.split("::").pop() ?? "COIN";
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function DestroyZeroCoins() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const [zeroCoins, setZeroCoins] = useState<ZeroCoin[]>([]);
  const [gasPrice, setGasPrice] = useState<bigint>(BigInt(0));

  /* -------------------- fetch zero-balance coins -------------------- */
const scanWallet = useCallback(async () => {
  if (!account?.address) return;

  const zeroList: ZeroCoin[] = [];

  // 1) 快速拿到所有 coinType 及总余额
  const balances = await client.getAllBalances({ owner: account.address });

  for (const b of balances) {
    // 防止超出批处理上限
    if (zeroList.length >= MAX_BATCH) break;

    // ------------- 针对该 coinType 分页遍历 coin objects -------------
    let cursor: string | null | undefined = undefined;
    do {
      const page = await client.getCoins({
        owner: account.address,
        coinType: b.coinType,
        cursor,
        limit: 50,
      });

      // ① 如果 totalBalance 为 0 —— 整页直接收
      // ② 如果 >0      —— 逐条判断 balance 是否为 0
      for (const c of page.data) {
        if (b.totalBalance === "0" || BigInt(c.balance) === BigInt(0)) {
          zeroList.push({
            objectId: c.coinObjectId,
            coinType: c.coinType,
            symbol: formatSymbol(c.coinType),
          });
          if (zeroList.length >= MAX_BATCH) break;
        }
      }

      cursor = page.hasNextPage ? page.nextCursor : null;
    } while (cursor && zeroList.length < MAX_BATCH);
  }

  setZeroCoins(zeroList);
}, [account?.address, client]);

  /* -------------------- gas price & storage rebate ------------------ */
  useEffect(() => {
    client.getReferenceGasPrice().then((p) => setGasPrice(BigInt(p)));
  }, [client]);

  const estRebateSui = useMemo(() => {
    // 每个 coin object 销毁返还  storage_rebate ≈ 110_000_000 mist  (当前 mainnet)
    const mist = BigInt(zeroCoins.length) * BigInt(110_000_000);
    return (Number(mist) / 1e9).toFixed(6);
  }, [zeroCoins]);

const groupedZero = useMemo(() => {
  const map = new Map<string, { coinType: string; symbol: string; icon?: string; count: number }>();

  zeroCoins.forEach((c) => {
    const entry = map.get(c.coinType);
    if (entry) {
      entry.count += 1;
    } else {
      map.set(c.coinType, { ...c, count: 1 });
    }
  });

  // 转成数组方便渲染 & 排序（按 count 倒序）
  return [...map.values()].sort((a, b) => b.count - a.count);
}, [zeroCoins]);

  /* -------------------- tx ------------------------------------------ */
  const handleDestroy = async () => {
    if (!account?.address || zeroCoins.length === 0) return;

    const tx = new Transaction();
    tx.setSender(account.address);
    tx.setGasBudget(GAS_BUDGET);
    // tx.deleteObjects(zeroCoins.map((c) => tx.object(c.objectId)));


    signAndExecute(
      { transaction: tx },
      {
        onSuccess: () => {
          toast({ title: `🗑️ Destroyed ${zeroCoins.length} coins` });
          setZeroCoins([]);
          scanWallet();
        },
        onError: (e) => toast({ title: "❌ Error", description: e.message }),
      },
    );
  };

  /* -------------------- effects ------------------------------------- */
  useEffect(() => {
    scanWallet();
  }, [scanWallet]);

  /* -------------------- render -------------------------------------- */
  return (
    <main className="max-w-5xl mx-auto py-8 px-4">
      <Header />

      <Card className="bg-slate-800/60 border border-slate-700 p-6 space-y-6">
        <div className="flex justify-between items-start">
          <h2 className="text-xl font-semibold">Destroy Zero Coins</h2>
          <Trash2 className="text-red-400" />
        </div>

        <p className="text-sm mb-2">
          {zeroCoins.length > 0
            ? `Found ${zeroCoins.length} zero-balance coin objects`
            : "No zero-balance coin objects detected"}
        </p>

        {/* list */}
{groupedZero.length > 0 && (
  <div className="h-64 overflow-y-auto border border-slate-600 rounded p-3 space-y-2">
    {groupedZero.map((g) => (
      <div
        key={g.coinType}
        className="flex items-center gap-3 bg-slate-700/40 px-3 py-[6px] rounded"
      >
        {/* icon */}
        {g.icon ? (
          <img src={g.icon} className="w-5 h-5 rounded-full" alt={g.symbol} />
        ) : (
          <div className="w-5 h-5 rounded-full bg-slate-600" />
        )}

        {/* symbol */}
        <span className="flex-1 font-medium">{g.symbol}</span>

        {/* count badge */}
        <span className="text-xs bg-slate-600/70 rounded-full px-2 py-[1px]">
          {g.count}
        </span>
      </div>
    ))}
  </div>
)}

        {/* rebate */}
        {zeroCoins.length > 0 && (
          <div className="text-sm mt-2">
            Estimated rebate:{" "}
            <span className="font-medium text-cyan-400">{estRebateSui} SUI</span>
          </div>
        )}

        {/* info banner */}
        <div className="flex items-start gap-2 bg-slate-700/50 p-3 rounded text-sm">
          <Info size={16} className="mt-[2px] text-cyan-300 shrink-0" />
          <span>
            This tool will delete up to <strong>1024</strong> zero-balance coin
            objects in your wallet. You’ll receive the storage rebate in SUI.
          </span>
        </div>

        <Button
          className="w-full"
          onClick={handleDestroy}
          disabled={zeroCoins.length === 0}
        >
          Destroy {zeroCoins.length > 0 && `(${zeroCoins.length})`}
        </Button>
      </Card>

      {/* footer */}
      <div className="mt-6 flex items-center gap-2 text-sm opacity-70">
        Gas estimate: <img src="/images/sui.svg" className="w-4 h-4" />
        {gasPrice ? (Number(BigInt(GAS_BUDGET) * gasPrice) / 1e9).toFixed(4) : "—"}
      </div>

      <Footer />
    </main>
  );
}
