const workspaceRoot = new URL("../../", import.meta.url);
const workspacePackages = [
  "artifacts/api-server",
  "artifacts/mockup-sandbox",
  "artifacts/sospirato-ventas",
  "lib/api-client-react",
  "lib/api-spec",
  "lib/api-zod",
  "lib/db",
  "scripts",
];

async function removeWithoutFollowingLinks(target: URL): Promise<void> {
  let info: Deno.FileInfo;
  try {
    info = await Deno.lstat(target);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return;
    throw error;
  }

  if (info.isSymlink) {
    await Deno.remove(target);
    return;
  }

  if (info.isDirectory) {
    const directory = new URL(
      target.href.endsWith("/") ? target.href : `${target.href}/`,
    );
    for await (const entry of Deno.readDir(directory)) {
      await removeWithoutFollowingLinks(
        new URL(encodeURIComponent(entry.name), directory),
      );
    }
  }

  await Deno.remove(target);
}

for (const packagePath of workspacePackages) {
  const packageDirectory = new URL(`${packagePath}/`, workspaceRoot);
  const modulesDirectory = new URL("node_modules/", packageDirectory);
  console.log(`Removing ${packagePath}/node_modules`);
  await removeWithoutFollowingLinks(modulesDirectory);
}
