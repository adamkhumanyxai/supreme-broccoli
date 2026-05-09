import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Sparkles,
  Banknote,
  BarChart3,
  Users,
  Crown,
  Newspaper,
  Swords,
  Compass,
  Target,
  MessageCircleQuestion,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Sparkles,
  Banknote,
  BarChart3,
  Users,
  Crown,
  Newspaper,
  Swords,
  Compass,
  Target,
  MessageCircleQuestion,
};

export function DossierSection({
  id,
  title,
  icon,
  content,
}: {
  id: string;
  title: string;
  icon: string;
  content: string;
}) {
  const Icon = ICONS[icon] ?? Sparkles;
  return (
    <section id={id} className="editorial-card scroll-mt-20 p-6 md:p-8">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="font-serif text-2xl text-foreground">{title}</h2>
      </div>
      <div className="prose prose-invert prose-zinc max-w-none prose-p:leading-relaxed prose-li:my-1 prose-headings:font-serif prose-strong:text-foreground">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || "_No content._"}</ReactMarkdown>
      </div>
    </section>
  );
}
