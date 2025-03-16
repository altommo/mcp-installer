# mcp-installer - A MCP Server to install MCP Servers (with n8n support)

This server is a server that installs other MCP servers for you. Install it, and you can ask Claude to install MCP servers hosted in npm or PyPi for you. It also provides special support for installing and configuring n8n servers.

Requires `npx` and `uv` to be installed for node and Python servers respectively.

![image](https://github.com/user-attachments/assets/d082e614-b4bc-485c-a7c5-f80680348793)

### How to install:

Put this into your `claude_desktop_config.json` (either at `~/Library/Application Support/Claude` on macOS or `C:\Users\NAME\AppData\Roaming\Claude` on Windows):

```json
  "mcpServers": {
    "mcp-installer": {
      "command": "npx",
      "args": [
        "@anaisbetts/mcp-installer"
      ]
    }
  }
```

### Example prompts

> Hey Claude, install the MCP server named mcp-server-fetch

> Hey Claude, install the @modelcontextprotocol/server-filesystem package as an MCP server. Use ['/Users/anibetts/Desktop'] for the arguments

> Hi Claude, please install the MCP server at /Users/anibetts/code/mcp-youtube, I'm too lazy to do it myself.

> Install the server @modelcontextprotocol/server-github. Set the environment variable GITHUB_PERSONAL_ACCESS_TOKEN to '1234567890'

### n8n Integration

This fork adds special support for n8n:

> Install and configure n8n as an MCP server. Generate credentials for my API endpoints

> Set up an n8n server with the packages: 'n8n-nodes-clickup, n8n-nodes-aws'

The installer will:

1. Install n8n and additional requested packages
2. Configure n8n as an MCP server
3. Generate credentials for API access
4. Provide console output with configuration details
