import Header from "@/components/header";
import Footer from "@/components/footer";
import CreateCoinForm from "@/components/coin/CreateCoinForm";
import { Sparkles } from "lucide-react";

export default function CreateCoinPage() {
  return (
    <main className="relative w-full min-h-screen flex flex-col items-center justify-between mx-auto px-4 py-8">
      <Header />

      <section className="w-full max-w-2xl flex-1 flex flex-col items-center justify-center text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2 mb-3">
          <Sparkles size={32} /> Create&nbsp;Your Meme&nbsp;Coin
        </h1>
        <p className="text-muted-foreground max-w-md mb-10">
          Deploy a brand-new token on&nbsp;Sui in just a few clicks. Fill in the
          details, hit <em>Mint</em>, and grab your contract address.
        </p>

        <CreateCoinForm />
      </section>

      <Footer />
    </main>
  );
}