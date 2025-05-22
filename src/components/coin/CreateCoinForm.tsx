import {
  useCurrentAccount,
  useSuiClient,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { useEffect, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Transaction } from "@mysten/sui/transactions";
import { normalizeSuiObjectId } from "@mysten/sui/utils";
import initMoveByteCodeTemplate from "@mysten/move-bytecode-template";
import { generateBytecode } from "@/lib/create-coin-utils";
import { toast } from "@/hooks/use-toast";
import { Sparkles, Loader2,UploadCloud } from "lucide-react";


async function getTreasuryCapObjects(client, packageIds) {
  const objects = await Promise.all(
    packageIds.map((p) =>
      client.getObject({ id: p.reference.objectId, options: { showType: true } })
    )
  );
  return objects
    .filter((o) => o.data.type.includes("TreasuryCap"))
    .map((o) => ({
      objectId: o.data.objectId,
      type: o.data.type.match(/TreasuryCap<([^>]+)>/)[1],
    }));
}

export default function CreateCoinForm() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  /* -------------- form state ---------------- */
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string>();
  const [decimals, setDecimals] = useState(9);
  const [mintAmount, setMintAmount] = useState(10_000_000_000);
  const [isMetaDataMutable, setIsMetaDataMutable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("“A sleepy sloth that rules DeFi”");
  const [imagePrompt, setImagePrompt] = useState("");

  /* -------------- preview avatar ------------ */
  useEffect(() => {
    if (!avatar) return;
    const reader = new FileReader();
    reader.onloadend = () => setIconPreview(reader.result as string);
    reader.readAsDataURL(avatar);
  }, [avatar]);

  /* -------------- AI helper ----------------- */
  const generateWithAI = async () => {
    if (!aiPrompt.trim()) return;
    toast({ title: "Summoning AI…" });
    const res = await fetch("/api/meme-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: aiPrompt }),
    });
    const json = await res.json();
    setName(json.name || name);
    setSymbol(json.symbol || symbol);
    setDescription(json.description || description);
    setImagePrompt(json.imagePrompt || "");
  };

  /* -------------- submit -------------------- */
  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!account) return toast({ title: "Connect wallet first" });
      setLoading(true);

      /* —— original chain logic kept exactly the same —— */
      try {
        let iconUrl = "";
        if (avatar) {
          const r = await fetch(
            "https://walrus-publisher.thcloud.dev/v1/blobs?epochs=10",
            { method: "PUT", body: avatar }
          );
          const j = await r.json();
          iconUrl = `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${j.newlyCreated?.blobObject?.blobId || j.alreadyCertified?.blobId
            }`;
        }

        const coinMeta = {
          name,
          symbol,
          description,
          iconUrl,
          decimals,
          mintAmout: mintAmount,
          coinType: "simpleCoin",
          isDropTreasury: true,
          isMetaDataMut: isMetaDataMutable,
        };

        await initMoveByteCodeTemplate("/pkg/move_bytecode_template_bg.wasm");
        const bytecode = await generateBytecode(coinMeta);
        const tx = new Transaction();
        tx.setGasBudget(1_000_000_000);
        const [upgradeCap] = tx.publish({
          modules: [[...bytecode]],
          dependencies: [normalizeSuiObjectId("0x1"), normalizeSuiObjectId("0x2")],
        });
        tx.transferObjects([upgradeCap], account.address);
        tx.setSender(account.address);

        const dry = await client.dryRunTransactionBlock({
          transactionBlock: await tx.build({ client }),
        });
        if (dry.effects.status.status === "failure") throw new Error(dry.effects.status.error);

        signAndExecuteTransaction({ transaction: tx }, {
          onSuccess: async (txRes) => {
            const finalRes = await client.waitForTransaction({
              digest: txRes.digest,
              options: { showEffects: true },
            });

            if (coinMeta.mintAmout > 0) {
              const supply = BigInt(coinMeta.mintAmout) * BigInt(10) ** BigInt(coinMeta.decimals);
              const treasuryCaps = await getTreasuryCapObjects(client, finalRes.effects!.created);
              if (!treasuryCaps.length) throw new Error("TreasuryCap not found");

              const tx2 = new Transaction();
              tx2.setGasBudget(1_000_000_000);
              tx2.moveCall({
                target: "0x2::coin::mint_and_transfer",
                typeArguments: [treasuryCaps[0].type],
                arguments: [
                  tx2.object(treasuryCaps[0].objectId),
                  tx2.pure.u64(supply.toString()),
                  tx2.pure.address(account.address),
                ],
              });
              tx2.setSender(account.address);
              signAndExecuteTransaction({ transaction: tx2 });
            }
            toast({ title: "✅ Coin created & minted" });
            setLoading(false);
          },
          onError: (err) => {
            toast({ title: "❌ Failed", description: err.message });
            setLoading(false);
          },
        });
      } catch (err) {
        toast({ title: "Error", description: (err as Error).message });
        setLoading(false);
      }
    },
    [account, avatar, name, symbol, description, decimals, mintAmount, isMetaDataMutable, aiPrompt]
  );

  /* -------------- UI ----------------------- */
  return (
    <form
      onSubmit={onSubmit}
      className="w-full space-y-10 text-left"
    >
      {/* headline */}
      {/* <div className="text-center space-y-3">
        <h1 className="text-4xl font-extrabold bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent inline-flex items-center gap-2">
          <Sparkles size={28} /> Mint&nbsp;Your Meme&nbsp;Coin
        </h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Fill in the details or let AI suggest something fun. We’ll handle the
          on‑chain magic.
        </p>
      </div> */}

      <div className="px-4 py-3 flex bg-gray-800 text-gray-300 rounded-md">
        ✨ Don&apos;t feel like typing?
        <div className="pl-2 text-[#818cf8] cursor-pointer hover:text-[#f472b6]" onClick={generateWithAI}>AI fill the form {'>'}</div>
      </div>

      {/* AI prompt */}
      <section className="space-y-4">
        <div className="font-medium text-gray-300">Meme prompt / idea</div>
        <Textarea
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          rows={3}
          placeholder="A sleepy sloth that rules DeFi…"
        />
        {/* <Button type="button" onClick={generateWithAI} variant="secondary">
          ✨ AI – fill the form
        </Button> */}
      </section>

      {/* basics */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <div className="font-medium text-gray-300">Project name</div>
          <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Please enter a name"/>
        </div>
        <div className="space-y-2">
          <div className="font-medium text-gray-300">Ticker</div>
          <Input value={symbol} onChange={(e) => setSymbol(e.target.value)} required />
        </div>
        <div className="md:col-span-2 space-y-3">
          <div className="font-medium text-gray-300">Description</div>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
      </section>

      {/* media & meta */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <div className="font-medium text-gray-300">Avatar image</div>
          {/* <Input type="file" accept="image/*" onChange={(e) => setAvatar(e.target.files?.[0] || null)} />
          <label className="block mb-2 font-medium">Upload CSV</label> */}
          <input
            id='dasfdsf'
            type="file"
            accept="image/*"
            className="opacity-0 absolute w-[180px] h-[40px] cursor-pointer" // 隐藏但占据空间且可点击
            onChange={(e) => setAvatar(e.target.files?.[0] || null)}
          />
          <label htmlFor='dasfdsf' className="inline-block cursor-pointer w-[180px]">
            <Button variant="outline">
              <UploadCloud size={16} className="mr-1" />
              Choose file
            </Button>
          </label>

          
          {imagePrompt && <p className="text-xs text-muted-foreground">AI prompt: {imagePrompt}</p>}
          {iconPreview && (
            <img src={iconPreview} alt="preview" className="w-20 h-20 object-cover rounded mt-2" />
          )}
        </div>
        <div className="flex flex-col gap-6">
          <div className="space-y-2">
            <div className="flex items-center font-medium text-gray-300">Decimals
              <div className="ml-2 flex items-center gap-2 mt-auto">
                <Switch id="metaSwitch" checked={isMetaDataMutable} onCheckedChange={setIsMetaDataMutable}
                  className={`w-11 h-6 rounded-full relative transition-colors ${isMetaDataMutable ? 'bg-[#818cf8]' : 'bg-gray-300'}`} />
                <label htmlFor="metaSwitch" className="text-sm font-medium text-gray-400 select-none">
                  (Metadata mutable)
                </label>
              </div>
            </div>
            <Input type="number" min={0} max={18} value={decimals} onChange={(e) => setDecimals(Number(e.target.value))} />
          </div>
        </div>
      </section>

      {/* supply */}
      <section className="space-y-2">
        <div className="font-medium text-gray-300">Initial supply</div>
        <Input type="number" min={0} value={mintAmount} onChange={(e) => setMintAmount(Number(e.target.value))} />
      </section>

      {/* submit */}
      <Button type="submit" variant="outline" disabled={loading || !account} className="w-full h-12 bg-[#818cf8] text-base gap-2">
        {loading && <Loader2 size={18} className="animate-spin" />}
        {loading ? "Deploying…" : "🚀 Deploy my coin"}
      </Button>
    </form>
  );
}
