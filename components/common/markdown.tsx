import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

/** Safe markdown (no raw HTML) with editorial typography. */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        "text-[15px] leading-relaxed text-ink/90 [&_a]:text-accent [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-accent [&_blockquote]:pl-3 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-semibold [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5",
        className,
      )}
    >
      <ReactMarkdown skipHtml>{children}</ReactMarkdown>
    </div>
  );
}
