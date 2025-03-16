# n8n MCP Installer

This script installs MCP (Model Context Protocol) servers and generates the necessary configuration for use with n8n. Unlike the main MCP installer, this script focuses exclusively on the n8n integration without any Claude desktop configuration.

## Features

- Installs MCP server packages from npm
- Ensures n8n-nodes-mcp is installed
- Generates credential configuration for n8n
- Creates example workflow nodes for testing
- Saves configuration locally for reference

## Requirements

- Node.js
- npm
- n8n installed locally or on a server

## Installation

```bash
# Clone the repository
git clone https://github.com/altommo/mcp-installer.git
cd mcp-installer

# Make the script executable
chmod +x n8n-mcp-installer.js

# Install dependencies
npm install spawn-rx
```

## Usage

```bash
# Basic usage
./n8n-mcp-installer.js [package-name]

# Example
./n8n-mcp-installer.js @modelcontextprotocol/server-github
```

## Output

The script outputs:

1. **n8n Credential Configuration** - JSON configuration to add as an "MCP Client API" credential in n8n
2. **List Tools Workflow** - JSON for a workflow node that lists all available tools from the MCP server
3. **Execute Tool Workflow** - JSON for a workflow node that executes a specific tool from the MCP server

All configurations are also saved to `~/.n8n-mcp-configs/` for reference.

## Using with n8n

1. Install the n8n-nodes-mcp package if not already installed:
   ```bash
   npm install -g n8n-nodes-mcp
   ```

2. Start or restart n8n:
   ```bash
   n8n start
   ```

3. In the n8n interface:
   - Go to Settings > Credentials
   - Create a new "MCP Client API" credential using the output from the installer
   - Create a new workflow with an "MCP Client Tool" node
   - Configure it with your credential
   - Run the workflow to verify it connects to the MCP server

## Example n8n Workflow

1. **Create a Credential**:
   - Name: Github MCP
   - Command: npx
   - Arguments: [@modelcontextprotocol/server-github]
   - Environment Variables: GITHUB_PERSONAL_ACCESS_TOKEN=[your-token]

2. **Add an MCP Client Tool node**:
   - Select the credential you created
   - Initially, it will fetch and list all available tools

3. **Create another MCP Client Tool node for execution**:
   - Select "Execute Tool" in the Operation field
   - Choose the tool you want to execute
   - Fill in the required parameters

## Troubleshooting

- If you encounter installation errors, check that you have the necessary permissions
- For credential errors in n8n, verify that the package name is correct
- If the MCP server won't connect, check that it was installed correctly and is accessible to n8n

## License

MIT
