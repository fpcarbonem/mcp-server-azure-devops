# ℹ️ NOTE: This is a fork of the original Azure DevOps MCP Server

# Azure DevOps MCP Server

A Model Context Protocol (MCP) server implementation for Azure DevOps, allowing AI assistants to interact with Azure DevOps APIs through a standardized protocol.

## Overview

This server implements the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) for Azure DevOps, enabling AI assistants like Claude to interact with Azure DevOps resources securely. The server acts as a bridge between AI models and Azure DevOps APIs, providing a standardized way to:

- Access and manage projects, work items, repositories, and more
- Create and update work items, branches, and pull requests
- Execute common DevOps workflows through natural language
- Access repository content via standardized resource URIs
- Safely authenticate and interact with Azure DevOps resources

## Server Structure

The server is structured around the Model Context Protocol (MCP) for communicating with AI assistants. It provides tools for interacting with Azure DevOps resources including:

- Projects
- Work Items
- Repositories
- Pull Requests
- Branches
- Pipelines

### Core Components

- **AzureDevOpsServer**: Main server class that initializes the MCP server and registers tools
- **Feature Modules**: Organized by feature area (work-items, projects, repositories, etc.)
- **Request Handlers**: Each feature module provides request identification and handling functions
- **Tool Handlers**: Modular functions for each Azure DevOps operation
- **Configuration**: Environment-based configuration for organization URL, PAT, etc.

The server uses a feature-based architecture where each feature area (like work-items, projects, repositories) is encapsulated in its own module. This makes the codebase more maintainable and easier to extend with new features.

## Getting Started

### Prerequisites

- Node.js **18+** (LTS recommended; required for this package)
- npm or yarn
- Azure DevOps account with appropriate access
- Authentication credentials (see [Authentication Guide](docs/authentication.md) for details):
  - Personal Access Token (PAT), or
  - Azure Identity credentials, or
  - Azure CLI login

### Install from npm

Published as [`@fpcarbonem/mcp-server-azure-devops`](https://www.npmjs.com/package/@fpcarbonem/mcp-server-azure-devops).

- **Recommended (no global install):** use `npx -y @fpcarbonem/mcp-server-azure-devops` in your MCP config (see below). `npx` downloads the package when needed.
- **Global CLI:** `npm install -g @fpcarbonem/mcp-server-azure-devops`, then use command `mcp-server-azure-devops` instead of `npx` in your MCP server `command` / `args`.

Maintainers: ensure `npm run build` has been run before `npm publish` (a `prepublishOnly` script runs the build automatically).

### MCP client configuration by platform

Covers **Windows**, **macOS**, **Linux**, and **Windows + WSL**. The server is plain Node.js and runs the same on every OS. What changes is **how your MCP host starts the process** and **where Node, `az`, and credentials live** (Windows vs WSL vs macOS/Linux).

#### macOS and Linux

- Use `"command": "npx"` with the `args` shown in the examples below (or `pnpm dlx` / `yarn dlx` if you standardize on those; keep the package name in the args list).
- Install **Node.js 18+** the usual way (installer, Homebrew, nvm, fnm, or your distro’s packages). Confirm `npx -v` in the same environment you use for development.
- For **`azure-identity`** or **`azure-cli`**, run `az login` in a terminal on **that same OS and user account** so `DefaultAzureCredential` can see Azure CLI credentials when the IDE launches the MCP server.

#### Windows (Node installed on Windows)

- Start with `"command": "npx"` like the samples below. If the MCP client fails with **“npx is not recognized”** (or similar), use **`npx.cmd`** instead, or the full path reported by PowerShell: `Get-Command npx | Select-Object -ExpandProperty Source`.
- Install [Node.js for Windows](https://nodejs.org/) (LTS) so `npx` is on your user `PATH` for GUI apps (Cursor, Claude Desktop). A terminal-only `PATH` is sometimes not inherited by the IDE—reinstall/repair Node and tick “Add to PATH” if needed.
- **Do not** set MCP `command` to `mcp-server-azure-devops` unless that name is on **Windows** `PATH` (for example after `npm install -g`). The supported default is still **`npx`** with the package name in `args`.
- **Azure CLI / `azure-cli` auth:** install [Azure CLI for Windows](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) and run `az login` in PowerShell under the **same Windows user** that runs the MCP client.

#### Windows using WSL (Node runs inside Linux)

Use this when Node/npm only exist in WSL, or you want the server to run in Linux while the IDE stays on Windows.

1. Install **Node.js 18+ inside WSL** (nvm, fnm, or distro packages). Open your distro and verify `node -v` and `npx -v`.
2. Prefer **`bash -lc`** so login profiles load (nvm/fnm paths).
3. **Forward environment variables from Windows into WSL** with [`WSLENV`](https://learn.microsoft.com/en-us/windows/wsl/interop#share-environment-variables-between-windows-and-wsl-with-wslenv) so secrets stay in the MCP `env` block instead of a long quoted shell string.

**Recommended (WSL + `WSLENV`, PAT in MCP `env`):**

```json
{
  "mcpServers": {
    "azureDevOps": {
      "command": "wsl.exe",
      "args": ["bash", "-lc", "npx -y @fpcarbonem/mcp-server-azure-devops"],
      "env": {
        "AZURE_DEVOPS_AUTH_METHOD": "pat",
        "AZURE_DEVOPS_ORG_URL": "https://dev.azure.com/your-organization",
        "AZURE_DEVOPS_PAT": "<YOUR_PAT>",
        "AZURE_DEVOPS_DEFAULT_PROJECT": "your-project-name",
        "WSLENV": "AZURE_DEVOPS_AUTH_METHOD/u:AZURE_DEVOPS_ORG_URL/u:AZURE_DEVOPS_PAT/u:AZURE_DEVOPS_DEFAULT_PROJECT/u"
      }
    }
  }
}
```

The `/u` flag converts values to Unix form when needed. Add more keys to both `env` and `WSLENV` if you use extra variables (for example `AZURE_DEVOPS_API_VERSION`).

**Non-default WSL distro:** add `-d` and the distro name after `wsl.exe`, for example:

```json
"args": ["-d", "Ubuntu", "bash", "-lc", "npx -y @fpcarbonem/mcp-server-azure-devops"]
```

**Azure Identity / Azure CLI in WSL:** run `az login` **inside that same WSL distro** so `DefaultAzureCredential` can use `AzureCliCredential` there.

**Alternative (single shell line, PAT embedded in the string):** you can export variables inline in the `bash -lc '...'` string, but that duplicates secrets next to shell quoting; prefer `WSLENV` above.

### Usage with Claude Desktop/Cursor AI

Add one of the following configurations to your MCP configuration. These examples use `"command": "npx"`; on **Windows**, switch to `npx.cmd` if `npx` is not found (see [platform notes](#mcp-client-configuration-by-platform)). On **WSL**, prefer the `wsl.exe` + `WSLENV` layout in that same section.

#### Azure Identity Authentication

Be sure you are logged in to Azure CLI with `az login` then add the following:

```json
{
  "mcpServers": {
    "azureDevOps": {
      "command": "npx",
      "args": ["-y", "@fpcarbonem/mcp-server-azure-devops"],
      "env": {
        "AZURE_DEVOPS_ORG_URL": "https://dev.azure.com/your-organization",
        "AZURE_DEVOPS_AUTH_METHOD": "azure-identity",
        "AZURE_DEVOPS_DEFAULT_PROJECT": "your-project-name"
      }
    }
  }
}
```

#### Personal Access Token (PAT) Authentication

```json
{
  "mcpServers": {
    "azureDevOps": {
      "command": "npx",
      "args": ["-y", "@fpcarbonem/mcp-server-azure-devops"],
      "env": {
        "AZURE_DEVOPS_ORG_URL": "https://dev.azure.com/your-organization",
        "AZURE_DEVOPS_AUTH_METHOD": "pat",
        "AZURE_DEVOPS_PAT": "<YOUR_PAT>",
        "AZURE_DEVOPS_DEFAULT_PROJECT": "your-project-name"
      }
    }
  }
}
```

#### MCP config file locations (reference)

- **Cursor:** MCP is configured in the editor (for example project `.cursor/mcp.json` or Cursor **Settings → MCP**, depending on your Cursor version).
- **Claude Desktop (Windows):** `%AppData%\Claude\claude_desktop_config.json`
- **Claude Desktop (macOS):** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Claude Desktop (Linux):** `~/.config/Claude/claude_desktop_config.json`

For detailed configuration instructions and more authentication options, see the [Authentication Guide](docs/authentication.md).

## Authentication Methods

This server supports multiple authentication methods for connecting to Azure DevOps APIs. For detailed setup instructions, configuration examples, and troubleshooting tips, see the [Authentication Guide](docs/authentication.md).

### Supported Authentication Methods

1. **Personal Access Token (PAT)** - Simple token-based authentication
2. **Azure Identity (DefaultAzureCredential)** - Flexible authentication using the Azure Identity SDK
3. **Azure CLI** - Authentication using your Azure CLI login

Example configuration files for each authentication method are available in the [examples directory](docs/examples/).

## Environment Variables

For a complete list of environment variables and their descriptions, see the [Authentication Guide](docs/authentication.md#configuration-reference).

Key environment variables include:

| Variable                       | Description                                                                        | Required                     | Default          |
| ------------------------------ | ---------------------------------------------------------------------------------- | ---------------------------- | ---------------- |
| `AZURE_DEVOPS_AUTH_METHOD`     | Authentication method (`pat`, `azure-identity`, or `azure-cli`) - case-insensitive | No                           | `azure-identity` |
| `AZURE_DEVOPS_ORG_URL`         | Full URL to your Azure DevOps organization                                         | Yes                          | -                |
| `AZURE_DEVOPS_PAT`             | Personal Access Token (for PAT auth)                                               | Only with PAT auth           | -                |
| `AZURE_DEVOPS_DEFAULT_PROJECT` | Default project if none specified                                                  | No                           | -                |
| `AZURE_DEVOPS_API_VERSION`     | API version to use                                                                 | No                           | Latest           |
| `AZURE_TENANT_ID`              | Azure AD tenant ID (for service principals)                                        | Only with service principals | -                |
| `AZURE_CLIENT_ID`              | Azure AD application ID (for service principals)                                   | Only with service principals | -                |
| `AZURE_CLIENT_SECRET`          | Azure AD client secret (for service principals)                                    | Only with service principals | -                |
| `LOG_LEVEL`                    | Logging level (debug, info, warn, error)                                           | No                           | info             |

## Troubleshooting Authentication

For detailed troubleshooting information for each authentication method, see the [Authentication Guide](docs/authentication.md#troubleshooting-authentication-issues).

Common issues include:

- Invalid or expired credentials
- Insufficient permissions
- Network connectivity problems
- Configuration errors

## Authentication Implementation Details

For technical details about how authentication is implemented in the Azure DevOps MCP server, see the [Authentication Guide](docs/authentication.md) and the source code under `src/shared/auth`.

## Available Tools

The Azure DevOps MCP server provides a variety of tools for interacting with Azure DevOps resources. For detailed documentation on each tool, please refer to the corresponding documentation.

### User Tools

- `get_me`: Get details of the authenticated user (id, displayName, email)

### Organization Tools

- `list_organizations`: List all accessible organizations

### Project Tools

- `list_projects`: List all projects in an organization
- `get_project`: Get details of a specific project
- `get_project_details`: Get comprehensive details of a project including process, work item types, and teams

### Repository Tools

- `list_repositories`: List all repositories in a project
- `get_repository`: Get details of a specific repository
- `get_repository_details`: Get detailed information about a repository including statistics and refs
- `get_file_content`: Get content of a file or directory from a repository

### Work Item Tools

- `get_work_item`: Retrieve a work item by ID
- `create_work_item`: Create a new work item
- `update_work_item`: Update an existing work item
- `list_work_items`: List work items in a project
- `manage_work_item_link`: Add, remove, or update links between work items

### Search Tools

- `search_code`: Search for code across repositories in a project
- `search_wiki`: Search for content across wiki pages in a project
- `search_work_items`: Search for work items across projects in Azure DevOps

### Pipelines Tools

- `list_pipelines`: List pipelines in a project
- `get_pipeline`: Get details of a specific pipeline
- `trigger_pipeline`: Trigger a pipeline run with customizable parameters

### Wiki Tools

- `get_wikis`: List all wikis in a project
- `get_wiki_page`: Get content of a specific wiki page as plain text

### Pull Request Tools

- [`create_pull_request`](docs/tools/pull-requests.md#create_pull_request) - Create a new pull request
- [`list_pull_requests`](docs/tools/pull-requests.md#list_pull_requests) - List pull requests in a repository
- [`add_pull_request_comment`](docs/tools/pull-requests.md#add_pull_request_comment) - Add a comment to a pull request
- [`get_pull_request_comments`](docs/tools/pull-requests.md#get_pull_request_comments) - Get comments from a pull request
- [`update_pull_request`](docs/tools/pull-requests.md#update_pull_request) - Update an existing pull request (title, description, status, draft state, reviewers, work items)

For comprehensive documentation on all tools, see the [Tools Documentation](docs/tools/).

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=fpcarbonem/mcp-server-azure-devops&type=Date)](https://www.star-history.com/#fpcarbonem/mcp-server-azure-devops&Date)

## License

MIT
