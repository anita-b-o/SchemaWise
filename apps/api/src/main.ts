import { startServer } from "./http/server.js";

startServer().catch((error: unknown) => {
  console.error("SchemaWise API failed to start.", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
});
