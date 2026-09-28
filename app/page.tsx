// The home page. Next.js turns any `page.tsx` file into a route --
// this one sits at app/page.tsx, so it is the site root: "/".
// Save this file while `npm run dev` is running and the browser updates itself.

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#F7F2EA] px-6 dark:bg-[#16120F]">
      <div className="flex flex-col items-start gap-4">
        <span className="text-4xl" aria-hidden="true">
          &#10052;
        </span>
        <h1 className="text-5xl font-semibold tracking-tight text-[#231D18] dark:text-[#F7F2EA]">
          liminal bloom
        </h1>
        <p className="max-w-md text-lg text-[#231D18]/70 dark:text-[#F7F2EA]/70">
          A mobile-first visual merchandising platform for retail store teams.
        </p>
        <p className="mt-4 rounded border border-[#E8B93A] px-3 py-1 text-sm text-[#6E5210] dark:text-[#E8B93A]">
          Week 1 &middot; foundation
        </p>
      </div>
    </main>
  );
}
