// "Liminal Bloom replied." on /welcome and /paused, where there is no avatar menu to carry the dot (spec 0.7.1
// 9.2). Nothing when there is nothing new. No toast (R2): it is part of the page.

import { MessageCircleReply } from "lucide-react";
import Link from "next/link";

export function ReplyBanner({ replies }: { replies: number }) {
  if (replies <= 0) return null;
  return (
    <p data-reply-banner className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded border border-line bg-info-tint p-3 text-info">
      <MessageCircleReply aria-hidden="true" strokeWidth={1.75} className="size-5 shrink-0" />
      <span>Liminal Bloom replied.</span>
      <Link href="/help" className="inline-flex min-h-11 items-center font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
        Read {replies === 1 ? "the reply" : "the replies"}
      </Link>
    </p>
  );
}
