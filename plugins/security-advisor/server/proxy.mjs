// Node's built-in fetch ignores HTTPS_PROXY unless NODE_USE_ENV_PROXY=1 (Node 22.21+ and 24+).
// Behind a proxy, rerun this process once with it set. stdio is inherited, so an MCP client
// talking to the server over stdin and stdout sees no difference.

import { spawnSync } from "node:child_process";

export function rerunWithProxySupport() {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const [major, minor] = process.versions.node.split(".").map(Number);
  const supported = major >= 24 || (major === 22 && minor >= 21) || major === 23;
  if (!proxy || !supported || process.env.NODE_USE_ENV_PROXY) return;
  const child = spawnSync(
    process.execPath,
    ["--disable-warning=UNDICI-EHPA", ...process.execArgv, ...process.argv.slice(1)],
    { stdio: "inherit", env: { ...process.env, NODE_USE_ENV_PROXY: "1" } },
  );
  process.exit(child.status ?? 1);
}
