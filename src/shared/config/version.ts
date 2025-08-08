/**
 * Current version of the Azure DevOps MCP server.
 * Keep this in sync with package.json by reading the version at runtime.
 *
 * Uses createRequire to avoid ESM JSON import assertion issues across Node versions.
 */
// Require JSON directly to support CommonJS outputs without import assertions
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../../../package.json') as { version: string };

export const VERSION = pkg.version;
