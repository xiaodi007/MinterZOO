import { Copy, ExternalLink } from "lucide-react";

export interface CoinPreviewProps {
  iconUrl?: string;
  coinAddress?: string;
  creatorAddress?: string;
  marketCap?: number;
}

export default function CoinPreview({
  iconUrl,
  coinAddress = "0x0000...0000",
  creatorAddress = "0x0000...0000",
  marketCap = 0,
}: CoinPreviewProps) {
  return (
    <div className="border border-gray-700 p-6 rounded-xl bg-card w-full max-w-sm text-white">
      <h2 className="text-lg font-bold mb-4">Visual Demo</h2>
      <div className="flex flex-col items-center space-y-4">
        <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-yellow-400">
          {iconUrl ? (
            <img src={iconUrl} alt="coin icon" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm text-gray-500 bg-gray-800">
              No Image
            </div>
          )}
        </div>

        <div className="text-sm text-gray-400 text-center">
          {coinAddress}
          <div className="flex justify-center space-x-2 mt-1">
            <button
              className="hover:text-white"
              onClick={() => navigator.clipboard.writeText(coinAddress)}
            >
              <Copy size={14} />
            </button>
            <a
              href={`https://suiexplorer.com/object/${coinAddress}?network=testnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white"
            >
              <ExternalLink size={14} />
            </a>
          </div>
        </div>

        <div className="text-sm">
          Created by{" "}
          <a
            href={`https://suiexplorer.com/address/${creatorAddress}?network=testnet`}
            target="_blank"
            className="text-cyan-400 hover:underline"
          >
            {creatorAddress}
          </a>
        </div>

        <div className="text-sm text-muted-foreground">
          Market Cap: ${marketCap.toFixed(2)} (0%)
        </div>
      </div>
    </div>
  );
}
