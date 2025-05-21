import Header from "@/components/header";
import Footer from "@/components/footer";
import CreateCoinForm from "@/components/coin/CreateCoinForm";
import { Sparkles } from "lucide-react";

export default function CreateCoinPage() {
  return (
    <main className="relative w-full min-h-screen flex flex-col items-center justify-between mx-auto">
      <Header />

      <div className="px-4 py-2 w-[100px] absolute top-[100px] left-4 flex items-center gap-2 bg-gray-900 text-gray-300 rounded-lg cursor-pointer" onClick={() => window.history.back()}>
      ↩ Back
      </div>
      <section className="w-full max-w-2xl pb-20 flex-1 flex flex-col items-center justify-center text-center">
        <h1 className="mt-10 text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2 mb-3">
          <Sparkles size={32} /> Create&nbsp;Your Meme&nbsp;Coin
        </h1>
        <p className="text-muted-foreground max-w-md mb-10">
          Name it yourself or let AI spark the fun — once you&apos;re ready, we&apos;ll handle the chain work and drop your token on Sui, contract and all.
          {/* Deploy a brand-new token on&nbsp;Sui in just a few clicks. Fill in the
          details, hit <em>Mint</em>, and grab your contract address. */}
        </p>

        <CreateCoinForm />
      </section>

      <Footer />
    </main>
  );
}