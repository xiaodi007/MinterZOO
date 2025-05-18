import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Transaction } from "@mysten/sui/transactions";
import Header from "@/components/header";
import Footer from "@/components/footer";
import ObjectSelectCard from "@/components/tools/ObjectSelectCard";

interface ObjectCardData {
  objectId: string;
  name: string;
  type: string;
  image_url?: string;
  description?: string;
}

export default function TransferObjectPage() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const [recipient, setRecipient] = useState("");
  const [objects, setObjects] = useState<ObjectCardData[]>([]);
  const [selectedObj, setSelectedObj] = useState<ObjectCardData | null>(null);

  useEffect(() => {
    if (!account?.address) return;

    const fetchAllObjects = async () => {
      let cursor: string | null | undefined = undefined;
      let all: ObjectCardData[] = [];
      let hasNextPage = true;

      while (hasNextPage) {
        const res = await client.getOwnedObjects({
          owner: account.address,
          options: { showContent: true, showDisplay: true },
          cursor,
        });

        const page: ObjectCardData[] = res.data.map((item) => {
          const typeStr = item.data?.content?.type || "";
          const typeShort = typeStr.split("::").pop() || "Unknown";
          const display = item.data?.display || {};

          return {
            objectId: item.data?.objectId || "",
            name: display.data?.name || typeShort,
            description: display.data?.description || "",
            image_url: display.data?.image_url || undefined,
            type: typeShort,
          };
        });

        all.push(...page);
        hasNextPage = res.hasNextPage;
        cursor = res.nextCursor;
      }

      setObjects(all);
    };

    fetchAllObjects();
  }, [account?.address]);

  const handleTransfer = async () => {
    if (!account?.address || !recipient || !selectedObj?.objectId) return;

    const tx = new Transaction();
    tx.setSender(account.address);
    tx.setGasBudget(1_000_000_000);
    tx.transferObjects([tx.object(selectedObj.objectId)], tx.pure.address(recipient));

    signAndExecuteTransaction(
      { transaction: tx },
      {
        onSuccess: () => {
          alert("✅ Transfer success");
          setSelectedObj(null);
        },
        onError: (err) => alert("❌ Error: " + err.message),
      }
    );
  };

  return (
    <main className="max-w-4xl mx-auto py-6 px-4">
      <Header />

      <h1 className="text-2xl font-bold mb-4">Transfer Object</h1>

      <div className="space-y-6">
        <div>
          <label className="block font-medium mb-1">Recipient Address</label>
          <Input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Enter Sui address"
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Select Object</label>
          <ObjectSelectCard
            data={objects}
            selected={selectedObj}
            onSelect={setSelectedObj}
          />
        </div>

        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={() => setSelectedObj(null)}>Clear</Button>
          <Button onClick={handleTransfer} disabled={!recipient || !selectedObj}>
            Send
          </Button>
        </div>
      </div>

      <Footer />
    </main>
  );
}