// Lets plain Node 24 run the seed's TypeScript: Node strips the types itself;
// these hooks resolve the "@/" alias and extensionless imports the way
// tsconfig.json does. No dependency (DECISIONS 10-04).
import { register } from "node:module";

register("./ts-paths-hooks.mjs", import.meta.url);
