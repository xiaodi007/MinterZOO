import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { useContext } from "react";
import { ConnectModal } from "@mysten/dapp-kit";
import ConnectMenu from "./ui/connectMenu";
import "@mysten/dapp-kit/dist/index.css";
import { AppContext } from "@/context/AppContext";
import { Link as LinkIcon } from "lucide-react";

/**
 * 😸 Playful top-bar for MinterZOO
 * – Shrinks on scroll (optional future tweak)
 * – Frosted glass backdrop
 */
export default function Header() {
  const { walletAddress, suiName } = useContext(AppContext);

  return (
    <header
      className="w-full sticky top-0 z-50 backdrop-blur-md border-b border-white/10 bg-slate-900/60"
      style={{ WebkitBackdropFilter: "blur(12px)" }}>
      <div className="max-w-7xl mx-auto h-20 px-4 flex items-center justify-between">
        {/* logo & brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <Image
            src="/images/logo.png" // make sure the asset exists
            alt="MinterZOO logo"
            width={40}
            height={40}
            priority
          />
          <span className="text-2xl lg:text-3xl font-extrabold leading-none bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent group-hover:opacity-90 transition-opacity">
            MinterZOO
          </span>
        </Link>

        {/* wallet connect */}
        {walletAddress ? (
          <ConnectMenu walletAddress={walletAddress} suiName={suiName} />
        ) : (
          <ConnectModal
            trigger={
              <button
                className="rounded-xl bg-white/10 hover:bg-white/20 transition-colors px-5 py-3 flex items-center gap-2"
                disabled={!!walletAddress}
              >
                <span className="text-sm font-medium">Connect Wallet</span>
                <LinkIcon size={17} className="text-white" />
              </button>
            }
          />
        )}
      </div>
    </header>
  );
}
