import { ChildProcess } from "node:child_process";
import { build, createServer, preview } from "vite";

// esbuild calls ref()/unref() on its service process. Deno owns the event loop
// directly, so those Node reference-count operations must not control exit.
ChildProcess.prototype.unref = function () {
  return this;
};
ChildProcess.prototype.ref = function () {
  return this;
};

const [command = "dev"] = Deno.args;
const configFile = "vite.config.ts";

if (command === "build") {
  await build({ configFile });
  Deno.exit(0);
}

if (command === "preview") {
  const server = await preview({ configFile });
  server.printUrls();
  Deno.addSignalListener("SIGINT", () => {
    server.httpServer.close();
    Deno.exit(0);
  });
  await new Promise<void>((resolve) => {
    server.httpServer.once("close", resolve);
  });
  Deno.exit(0);
}

const server = await createServer({ configFile });
await server.listen();
server.printUrls();
Deno.addSignalListener("SIGINT", () => {
  void server.close().finally(() => Deno.exit(0));
});
