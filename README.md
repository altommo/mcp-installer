# mcp-installer - A MCP Server to install MCP Servers for n8n

This server installs MCP servers from npm or PyPi packages specifically for n8n integration. It handles installation and generates the necessary credential configurations for using MCP servers with n8n workflows.

Requires `npx` and `uv` to be installed for node and Python servers respectively.

## Installation

Put this into your MCP client configuration:

```json
{
  "mcpServers": {
    "mcp-installer": {
      "command": "npx",
      "args": [
        "@anaisbetts/mcp-installer"
      ]
    }
  }
}
```

## Example prompts

> Install the MCP server named mcp-server-fetch for n8n integration

> Install the @modelcontextprotocol/server-github package as an MCP server for n8n integration. Set the environment variable GITHUB_PERSONAL_ACCESS_TOKEN to '1234567890'

> Install the local MCP server at /path/to/mcp-server for n8n integration

## Features

This installer focuses exclusively on n8n integration:

1. Installs MCP servers from npm or PyPi packages
2. Ensures n8n-nodes-mcp is installed if not already present
3. Generates credential configuration in n8n-compatible format
4. Creates example workflow nodes for "List Tools" and "Execute Tool" operations
5. Saves configuration to a local file for reference

## Output

After installing an MCP server, you'll receive:

1. **n8n Credential Configuration** - JSON to add as a credential in n8n
2. **List Tools Workflow** - JSON for a workflow node to list all available tools
3. **Execute Tool Workflow** - JSON for a workflow node to execute a specific tool

## Using in n8n

1. Make sure you have the n8n-nodes-mcp package installed:
   ```bash
   npm install -g n8n-nodes-mcp
   ```

2. In the n8n interface:
   - Go to Settings > Credentials
   - Create a new "MCP Client API" credential using the output from the installer
   - Create workflows using the MCP Client Tool node

## Example Workflow

Here's how to use an MCP server in n8n:

1. Create a credential using the JSON output from the installer
2. Create a workflow with an MCP Client Tool node
3. Configure the node to use your credential
4. First fetch the list of available tools
5. Then create another node to execute a specific tool

All configuration details are saved to `~/.n8n-mcp-configs/` for future reference.
