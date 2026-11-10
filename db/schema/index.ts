// The database schema: TypeScript descriptions of the tables.
//
// These files are the source of truth. You never write CREATE TABLE by hand --
// drizzle-kit reads them, compares it to the real database, and writes the
// SQL needed to make the database match.
//
// Tables are defined as they appear in docs/projectOutline.md section 7.

// Split by area; this index re-exports every table, so `@/db/schema` imports
// stay the same and db/index.ts hands Drizzle the whole set.

export * from "./products";
export * from "./keys";
export * from "./map";
export * from "./fixtures";
export * from "./library";
export * from "./planograms";
export * from "./settings";
