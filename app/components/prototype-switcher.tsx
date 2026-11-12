// PROTOTYPE — throwaway. Floating variant switcher for UI prototypes.
// Lives on the `prototype/notification-ui` branch only; never merge to main.
import { useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PrototypeVariant {
  key: string;
  name: string;
}

export function PrototypeSwitcher({
  variants,
  current,
  onChange,
  children,
}: {
  variants: PrototypeVariant[];
  current: string;
  onChange: (key: string) => void;
  children?: React.ReactNode;
}) {
  const index = Math.max(
    0,
    variants.findIndex((v) => v.key === current)
  );
  const step = (delta: number) =>
    onChange(variants[(index + delta + variants.length) % variants.length].key);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable ||
          t.closest(".monaco-editor"))
      )
        return;
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-1 rounded-full border-2 border-dashed border-fuchsia-500 bg-zinc-950 px-2 py-1 text-sm text-white shadow-2xl">
      <span className="px-2 text-[10px] font-bold uppercase tracking-widest text-fuchsia-400">
        Prototype
      </span>
      <button
        onClick={() => step(-1)}
        className="rounded-full p-1 hover:bg-white/10"
        title="Previous variant (←)"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-52 text-center font-medium">
        {variants[index].key} ({variants[index].name})
      </span>
      <button
        onClick={() => step(1)}
        className="rounded-full p-1 hover:bg-white/10"
        title="Next variant (→)"
      >
        <ChevronRight className="size-4" />
      </button>
      {children && (
        <div className="ml-1 flex items-center gap-1 border-l border-white/20 pl-2">
          {children}
        </div>
      )}
    </div>
  );
}
