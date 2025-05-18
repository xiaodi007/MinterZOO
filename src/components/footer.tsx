import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * 🎉 Playful footer for MinterZOO hack-project
 */
export default function Footer() {
  const phrases = [
    "Mint, Meow, Repeat! 🐱",
    "Unleash your inner Zookeeper 🦁",
    "Powered by caffeine ☕ & chaos 🤪",
    "Got milk? We’ve got memecoins 🍼",
  ];
  const [msg, setMsg] = useState(phrases[0]);

  // rotate tagline every 6 s
  useEffect(() => {
    const id = setInterval(() => {
      setMsg((m) => {
        const i = (phrases.indexOf(m) + 1) % phrases.length;
        return phrases[i];
      });
    }, 6000);
    return () => clearInterval(id);
  }, []);

  return (
    <footer className="w-full flex flex-col items-center gap-3 py-6 text-sm bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-indigo-500/20 border-t border-white/10 backdrop-blur-md">
      {/* animated emoji line */}
      <div className="select-none animate-pulse text-lg">
        🐵 🐶 🐱 🐸 🐼 🐯 🐰
      </div>

      {/* rotating tagline */}
      <p className="italic opacity-80 text-center px-4">{msg}</p>

      {/* playful links */}
      <div className="flex gap-4 pt-1">
        <Link href="https://github.com/your-repo" className="hover:underline underline-offset-4">
          GitHub
        </Link>
        <span className="opacity-30 select-none">•</span>
        <Link href="/roadmap" className="hover:underline underline-offset-4">
          Roadmap
        </Link>
        <span className="opacity-30 select-none">•</span>
        <Link href="/bug-bounty" className="hover:underline underline-offset-4">
          Bug Bounty 🐛
        </Link>
      </div>

      <span className="opacity-50 text-xs">© {new Date().getFullYear()} MinterZOO – built during the Sui Hackathon</span>
    </footer>
  );
}