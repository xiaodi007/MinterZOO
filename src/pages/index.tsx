import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import Header from "@/components/header";
import Footer from "@/components/footer";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SendHorizonal, Wrench } from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

export default function Home() {
  return (
    <main
      className={cn(
        "relative w-full min-h-svh h-full max-w-360 flex flex-col items-center justify-between mx-auto py-5 px-4",
        inter.className
      )}
    >
      <Header />

      <section className="flex-1 w-full flex flex-col items-center justify-center text-center gap-6">
        <h1 className="text-5xl md:text-6xl font-extrabold leading-tight bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
          Welcome to <span className="whitespace-nowrap">MinterZOO 🦄</span>
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Mint your own meme coin on Sui in seconds, then wrangle it with a
          playful toolbox — split, merge, airdrop or incinerate dust. All in one
          place.
        </p>

        <div className="grid w-full max-w-3xl grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
          <HomeCard
            href="/create-coin"
            title="Create Meme Coin"
            subtitle="Launch a token in a few clicks."
            icon={<SendHorizonal size={24} />}
            cta="Start creating"
            variant="default"
          />
          <HomeCard
            href="/tools"
            title="Asset Toolbox"
            subtitle="Transfer, merge, split or burn coins."
            icon={<Wrench size={24} />}
            cta="Open toolbox"
            variant="outline"
          />
        </div>
      </section>

      <Footer />
    </main>
  );
}

function HomeCard({
  href,
  title,
  subtitle,
  icon,
  cta,
  variant,
}: {
  href: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  cta: string;
  variant: "default" | "outline";
}) {
  return (
    <Link href={href} className="group">
      <Card className="h-full bg-gradient-to-br from-slate-800/60 to-slate-800/40 border-slate-700/60 transition-all hover:shadow-xl group-hover:-translate-y-[3px]">
        <CardContent className="p-8 flex flex-col justify-between gap-6 h-full">
          <div className="flex items-center gap-3 text-2xl font-semibold">
            {icon}
            <span>{title}</span>
          </div>
          <p className="text-muted-foreground text-sm flex-1">{subtitle}</p>
          <Button variant={variant} className="self-center w-fit px-6">
            {cta}
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
}
