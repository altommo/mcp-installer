# mcp-installer - A MCP Server to install MCP Servers (with n8n support)

This server is a server that installs other MCP servers for you. Install it, and you can ask Claude to install MCP servers hosted in npm or PyPi for you. It also provides special support for n8n integration.

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

This fork adds special support for integrating MCP servers with n8n:

```
Install hyperbrowser-mcp MCP server for n8n integration

Install the MCP server @modelcontextprotocol/server-filesystem for n8n with arguments ['/path/to/directory']

Install the local MCP server at /path/to/local/mcp-server for n8n integration with credential name "My Custom MCP Server"
```

The installer will:

1. Install the MCP server in the appropriate location for n8n access
2. Install n8n-nodes-mcp if not already installed
3. Generate n8n credential configuration in the format needed for the MCP Client node
4. Output two example n8n workflow nodes:
   - A "List Tools" node that lists all tools from the MCP server
   - An "Execute Tool" node that can execute any tool from the server
5. Save configuration to a file in `.mcp-n8n-configs/` for future reference

#### Usage in n8n:

1. After installing an MCP server with this tool, copy the credential configuration from the output
2. In n8n, create a new credential of type "MCP Client API" and paste the copied configuration
3. Create a new workflow and add a "MCP Client Tool" node
4. Configure the node to use the credential you created
5. Choose either to list available tools or execute a specific tool

The credential format will look something like:

```json
{
  "id": "uniqueId",
  "name": "Server Name MCP",
  "data": {
    "command": "npx",
    "args": ["package-name"],
    "env": {}
  },
  "type": "mcpClientApi"
}
```

#### Example Workflow Nodes

The installer generates two sample workflow nodes that you can import into n8n:

1. **List Tools Node**: Lists all available tools from the MCP server
```json
{
  "nodes": [
    {
      "parameters": {},
      "type": "n8n-nodes-mcp.mcpClientTool",
      "typeVersion": 1,
      "position": [580, 700],
      "credentials": {
        "mcpClientApi": {
          "id": "credentialId",
          "name": "Server MCP"
        }
      }
    }
  ],
  "connections": {
    "MCP Client Server Tools": {
      "ai_tool": [[]]
    }
  }
}
```

2. **Execute Tool Node**: Executes a specific tool from the MCP server
```json
{
  "nodes": [
    {
      "parameters": {
        "operation": "executeTool",
        "toolName": "={{ $fromAI(\"tool\",\"Set this with specific tool name\") }}",
        "toolParameters": "={{ $fromAI('Tool_Parameters', '', 'json') }}"
      },
      "type": "n8n-nodes-mcp.mcpClientTool",
      "typeVersion": 1,
      "position": [620, 740],
      "credentials": {
        "mcpClientApi": {
          "id": "credentialId",
          "name": "Server MCP"
        }
      }
    }
  ],
  "connections": {
    "Server Tools Execute": {
      "ai_tool": [[]]
    }
  }
}
```

### Requirements

To use the n8n integration:

1. n8n must be installed on your system (`npm install -g n8n`)
2. The n8n-nodes-mcp package must be installed (`npm install -g n8n-nodes-mcp`)
3. The MCP server you're installing must be accessible to n8n

For more information about using MCP servers with n8n, see the [n8n-nodes-mcp documentation](https://github.com/nerding-io/n8n-nodes-mcp).
