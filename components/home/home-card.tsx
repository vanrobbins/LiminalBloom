// The frame every Home card shares (0.7.0.6 spec section 4): a section named by its h2,
// a decorative icon beside the title, and, where a full list exists elsewhere, a "see all"
// icon link that names the page and how many rows are left out ("All planograms, 3 more").

import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useId } from "react";

import { Button } from "@/components/ui/button";

type HomeCardProps = {
  title: string;
  icon: LucideIcon;
  /** `page` is the lower-case name of where the full list lives; `more` is how many rows the card leaves out. */
  seeAll?: { href: string; page: string; more: number };
  /** Lets a wide card span both columns on a tablet. */
  className?: string;
  children: React.ReactNode;
};

export function HomeCard({ title, icon: Icon, seeAll, className = "", children }: HomeCardProps) {
  const headingId = useId();
  const label = seeAll ? `All ${seeAll.page}${seeAll.more > 0 ? `, ${seeAll.more} more` : ""}` : undefined;

  return (
    <section aria-labelledby={headingId} className={`rounded-lg border border-line-subtle bg-raised p-4 ${className}`.trim()}>
      <div className="mb-2 flex min-h-11 items-center gap-2">
        <Icon aria-hidden="true" strokeWidth={1.75} className="size-5 shrink-0 text-ink-muted" />
        <h2 id={headingId} className="min-w-0 flex-1 text-base font-semibold text-ink">
          {title}
        </h2>
        {seeAll ? (
          <Button icon variant="secondary" asChild>
            <Link href={seeAll.href} aria-label={label}>
              <ChevronRight aria-hidden="true" strokeWidth={1.75} className="size-5" />
            </Link>
          </Button>
        ) : null}
      </div>
      {children}
    </section>
  );
}
