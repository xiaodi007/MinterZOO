import { cn } from "@/lib/utils";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  ArrowRight,
  SendHorizonal,
  Split,
  Merge,
  Trash2,
  Sparkles,
  FileText,
} from "lucide-react";

export default function ToolsPage() {
  return (
    <main
      className={cn(
        "relative w-full min-h-svh flex flex-col items-center justify-between max-w-6xl mx-auto px-4 py-12"
      )}
    >
      <Header />

      <section className="flex-1 w-full flex flex-col items-center">
        <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent mb-3">
          🧰 Asset&nbsp;Toolbox
        </h1>
        <p className="text-muted-foreground text-center max-w-2xl mb-12">
          Move, split, merge or incinerate your Sui assets. Pick a tool →
        </p>

        <ToolSection title="💸 Transfer">
          <ToolCard
            href="/tools/transfer-object"
            label="Transfer Objects"
            icon={<SendHorizonal size={20} />}
          />
          <ToolCard
            href="/tools/transfer-coin"
            label="Transfer Tokens"
            icon={<SendHorizonal size={20} />}
          />
          <ToolCard
            href="/tools/transfer-coin-multi"
            label="Multi-Recipient"
            icon={<SendHorizonal size={20} />}
          />
        </ToolSection>

        <ToolSection title="🔧 Manage">
          <ToolCard
            href="/tools/split-coin"
            label="Split Tokens"
            icon={<Split size={20} />}
          />
          <ToolCard
            href="/tools/merge-coin"
            label="Merge Tokens"
            icon={<Merge size={20} />}
          />
          <ToolCard
            href="/tools/delete-object"
            label="Delete Objects"
            icon={<Trash2 size={20} />}
          />
          <ToolCard
            href="/tools/burn-dust"
            label="Burn Dust"
            icon={<Sparkles size={20} />}
          />
        </ToolSection>

        <ToolSection title="📝 Misc">
          <ToolCard
            href="/tools/memo"
            label="Memo"
            icon={<FileText size={20} />}
          />
        </ToolSection>
      </section>

      <Footer />
    </main>
  );
}

/* ── helpers ───────────────────────────────────────────── */

function ToolSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full mb-16">
      <h2 className="text-2xl font-semibold mb-6">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
        {children}
      </div>
    </div>
  );
}

function ToolCard({
  label,
  href,
  icon,
}: {
  label: string;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} className="group">
      <Card className="h-full bg-gradient-to-br from-slate-800/60 to-slate-800/40 border border-slate-700/60 transition-transform duration-200 shadow-lg hover:-translate-y-1 hover:shadow-xl">
        <CardContent className="p-6 flex flex-col justify-between h-full gap-5">
          <div className="flex items-center gap-3 text-lg font-medium">
            {icon}
            <span>{label}</span>
          </div>

          <Button
            variant="secondary"
            size="sm"
            className="self-start gap-1 group-hover:translate-x-0.5 transition-transform"
          >
            Open
            <ArrowRight size={14} />
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
}
