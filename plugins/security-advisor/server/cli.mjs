#!/usr/bin/env node
// The advisor's tools from a terminal, for testing and for scripts.
//
//   node server/cli.mjs list
//   node server/cli.mjs sheet patching [--brief]
//   node server/cli.mjs search "phishing-resistant MFA for admins"
//   node server/cli.mjs triage CVE-2024-3400 [--fix-released 2024-04-14]
//
// --source <url or dist folder> (or SECURITY_ADVISOR_SOURCE) reads sheets from somewhere other
// than the published site, such as a local `npm run build:html`.

import { createLibrary } from "./library.mjs";
import { rerunWithProxySupport } from "./proxy.mjs";

rerunWithProxySupport();

const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const [, value] = args.splice(i, 2);
  return value;
};
const source = option("--source");
const fixReleased = option("--fix-released");
const brief = args.includes("--brief") && Boolean(args.splice(args.indexOf("--brief"), 1));
const [command, ...rest] = args;
const lib = createLibrary(source ? { source } : {});

const commands = {
  list: () => lib.listSheets(),
  sheet: () => lib.getSheet(rest.join(" "), { brief }),
  search: () => lib.search(rest.join(" ")),
  triage: () => lib.triage(rest[0], fixReleased),
};

if (!commands[command]) {
  console.error("Usage: cli.mjs list | sheet <slug> [--brief] | search <words> | triage <CVE-ID> [--fix-released DATE] [--source URL|DIR]");
  process.exit(2);
}
try {
  console.log(await commands[command]());
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
