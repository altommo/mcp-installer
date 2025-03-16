#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { spawnPromise } from "spawn-rx";
import * as crypto from "crypto";

const server = new Server(
  {
    name: "mcp-installer",
    version: "0.6.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "install_repo_mcp_server",
        description: "Install an MCP server via npx or uvx for n8n integration",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "The package name of the MCP server",
            },
            args: {
              type: "array",
              items: { type: "string" },
              description: "The arguments to pass along",
            },
            env: {
              type: "array",
              items: { type: "string" },
              description: "The environment variables to set, delimited by =",
            },
          },
          required: ["name"],
        },
      },
      {
        name: "install_local_mcp_server",
        description:
          "Install an MCP server whose code is cloned locally on your computer for n8n integration",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description:
                "The path to the MCP server code cloned on your computer",
            },
            args: {
              type: "array",
              items: { type: "string" },
              description: "The arguments to pass along",
            },
            env: {
              type: "array",
              items: { type: "string" },
              description: "The environment variables to set, delimited by =",
            },
          },
          required: ["path"],
        },
      },
    ],
  };
});

async function hasNodeJs() {
  try {
    await spawnPromise("node", ["--version"]);
    return true;
  } catch (e) {
    return false;
  }
}

async function hasUvx() {
  try {
    await spawnPromise("uvx", ["--version"]);
    return true;
  } catch (e) {
    return false;
  }
}

async function isNpmPackage(name: string) {
  try {
    await spawnPromise("npm", ["view", name, "version"]);
    return true;
  } catch (e) {
    return false;
  }
}

// Generate a unique credential ID
function generateCredentialId(): string {
  return crypto.randomBytes(8).toString('hex');
}

// Generate n8n credential configuration
function generateN8nCredential(
  serverName: string, 
  command: string, 
  args: string[], 
  env?: string[]
): {
  credential: any;
  listToolsNode: any;
  executeToolNode: any;
} {
  // Clean up the server name for credential naming
  const cleanServerName = serverName.replace(/^@/, '').replace(/\//, '-');
  
  // Create environment object
  const envObj = (env ?? []).reduce((acc: Record<string, string>, val: string) => {
    const [key, value] = val.split("=");
    acc[key] = value;
    return acc;
  }, {});
  
  // Generate unique IDs
  const credentialId = generateCredentialId();
  const nodeId1 = crypto.randomBytes(16).toString('hex');
  const nodeId2 = crypto.randomBytes(16).toString('hex');
  const instanceId = crypto.randomBytes(32).toString('hex');
  
  // Create credential object
  const credential = {
    id: credentialId,
    name: `${cleanServerName} MCP`,
    data: {
      command: command,
      args: args || [],
      env: envObj
    },
    type: "mcpClientApi"
  };
  
  // Create example MCP List Tools node
  const listToolsNode: any = {
    nodes: [
      {
        parameters: {},
        type: "n8n-nodes-mcp.mcpClientTool",
        typeVersion: 1,
        position: [580, 700],
        id: nodeId1,
        name: `MCP Client ${cleanServerName} Tools`,
        credentials: {
          mcpClientApi: {
            id: credentialId,
            name: credential.name
          }
        }
      }
    ],
    connections: {},
    pinData: {},
    meta: {
      templateCredsSetupCompleted: true,
      instanceId: instanceId
    }
  };
  
  // Default to first connection being empty array
  listToolsNode.connections[`MCP Client ${cleanServerName} Tools`] = {
    ai_tool: [[]]
  };
  
  // Create example MCP Execute Tool node
  const executeToolNode: any = {
    nodes: [
      {
        parameters: {
          operation: "executeTool",
          toolName: "={{ $fromAI(\"tool\",\"Set this with specific tool name\") }}",
          toolParameters: "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Tool_Parameters', ``, 'json') }}"
        },
        type: "n8n-nodes-mcp.mcpClientTool",
        typeVersion: 1,
        position: [620, 740],
        id: nodeId2,
        name: `${cleanServerName} Tools Execute`,
        credentials: {
          mcpClientApi: {
            id: credentialId,
            name: credential.name
          }
        }
      }
    ],
    connections: {},
    pinData: {},
    meta: {
      templateCredsSetupCompleted: true,
      instanceId: instanceId
    }
  };
  
  // Default to first connection being empty array
  executeToolNode.connections[`${cleanServerName} Tools Execute`] = {
    ai_tool: [[]]
  };
  
  return {
    credential,
    listToolsNode,
    executeToolNode
  };
}

// Save credential config to a file
function saveConfigToFile(configObj: any, serverName: string): string {
  const homeDir = os.homedir();
  const configDir = path.join(homeDir, '.n8n-mcp-configs');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  // Clean up server name for filename
  const cleanServerName = serverName.replace(/[@/]/g, '-');
  const configPath = path.join(configDir, `${cleanServerName}-config.json`);
  
  // Write config to file
  fs.writeFileSync(configPath, JSON.stringify(configObj, null, 2));
  
  return configPath;
}

async function attemptNodeInstall(
  directory: string
): Promise<Record<string, string>> {
  await spawnPromise("npm", ["install"], { cwd: directory });

  // Run down package.json looking for bins
  const pkg = JSON.parse(
    fs.readFileSync(path.join(directory, "package.json"), "utf-8")
  );

  if (pkg.bin) {
    return Object.keys(pkg.bin).reduce((acc, key) => {
      acc[key] = path.resolve(directory, pkg.bin[key]);
      return acc;
    }, {} as Record<string, string>);
  }

  if (pkg.main) {
    return { [pkg.name]: path.resolve(directory, pkg.main) };
  }

  return {};
}

async function installRepoMcpServer(
  name: string,
  args?: string[],
  env?: string[]
) {
  if (!(await hasNodeJs())) {
    return {
      content: [
        {
          type: "text",
          text: `Node.js is not installed, please install it!`,
        },
      ],
      isError: true,
    };
  }

  try {
    let command: string, installCommand: string, installArgs: string[];
    
    if (await isNpmPackage(name)) {
      console.log(`Installing ${name} via npm...`);
      command = "npx";
      installCommand = "npm";
      installArgs = ["install", "-g", name];
    } else {
      if (!(await hasUvx())) {
        return {
          content: [
            {
              type: "text",
              text: `Python uv is not installed, please install it! Tell users to go to https://docs.astral.sh/uv`,
            },
          ],
          isError: true,
        };
      }
      
      console.log(`Installing ${name} via uvx...`);
      command = "uvx";
      installCommand = "uv";
      installArgs = ["pip", "install", name];
    }

    // Install the package
    console.log(`Running: ${installCommand} ${installArgs.join(' ')}`);
    await spawnPromise(installCommand, installArgs);
    
    // Also install n8n-nodes-mcp if not installed
    try {
      await spawnPromise("npm", ["list", "-g", "n8n-nodes-mcp"]);
    } catch (e) {
      console.log("Installing n8n-nodes-mcp...");
      await spawnPromise("npm", ["install", "-g", "n8n-nodes-mcp"]);
    }
    
    // Generate n8n credential configuration
    const configObj = generateN8nCredential(
      name,
      command,
      [name, ...(args ?? [])],
      env
    );
    
    // Save configuration to file
    const configPath = saveConfigToFile(configObj, name);
    
    // Format the output for better console display
    const credentialOutput = JSON.stringify(configObj.credential, null, 2);
    const listToolsOutput = JSON.stringify(configObj.listToolsNode, null, 2);
    const executeToolOutput = JSON.stringify(configObj.executeToolNode, null, 2);

    return {
      content: [
        {
          type: "text",
          text: `
MCP server ${name} installed successfully for n8n integration!

1. Add this credential in n8n:
${credentialOutput}

2. Use this JSON for List Tools workflow:
${listToolsOutput}

3. Use this JSON for Execute Tool workflow:
${executeToolOutput}

Configuration saved to: ${configPath}

To use this MCP server in n8n:
1. Create a new credential in n8n of type "MCP Client API"
2. Use the configuration above
3. Create workflows using the MCP Client Tool node
`,
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: `Error installing ${name}: ${err}`,
        },
      ],
      isError: true,
    };
  }
}

async function installLocalMcpServer(
  dirPath: string,
  args?: string[],
  env?: string[]
) {
  if (!fs.existsSync(dirPath)) {
    return {
      content: [
        {
          type: "text",
          text: `Path ${dirPath} does not exist locally!`,
        },
      ],
      isError: true,
    };
  }

  if (fs.existsSync(path.join(dirPath, "package.json"))) {
    try {
      // Also install n8n-nodes-mcp if not installed
      try {
        await spawnPromise("npm", ["list", "-g", "n8n-nodes-mcp"]);
      } catch (e) {
        console.log("Installing n8n-nodes-mcp...");
        await spawnPromise("npm", ["install", "-g", "n8n-nodes-mcp"]);
      }
      
      // Read package.json to get the name
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(dirPath, "package.json"), "utf-8")
      );
      
      const serverName = packageJson.name || path.basename(dirPath);
      
      // Install dependencies
      console.log(`Installing dependencies for ${dirPath}...`);
      await spawnPromise("npm", ["install"], { cwd: dirPath });
      
      // Determine the binary path
      let command = "node";
      let binArgs: string[] = [];
      
      if (packageJson.bin) {
        // For npm package with binary
        const binName = Object.keys(packageJson.bin)[0];
        const binPath = path.resolve(dirPath, packageJson.bin[binName]);
        binArgs = [binPath, ...(args ?? [])];
      } else if (packageJson.main) {
        // For npm package with main entry
        const mainPath = path.resolve(dirPath, packageJson.main);
        binArgs = [mainPath, ...(args ?? [])];
      } else {
        // Fallback
        binArgs = [path.join(dirPath, "index.js"), ...(args ?? [])];
      }
      
      // Generate n8n credential configuration
      const configObj = generateN8nCredential(
        serverName,
        command,
        binArgs,
        env
      );
      
      // Save configuration to file
      const configPath = saveConfigToFile(configObj, serverName);
      
      // Format the output for better console display
      const credentialOutput = JSON.stringify(configObj.credential, null, 2);
      const listToolsOutput = JSON.stringify(configObj.listToolsNode, null, 2);
      const executeToolOutput = JSON.stringify(configObj.executeToolNode, null, 2);

      return {
        content: [
          {
            type: "text",
            text: `
Local MCP server ${serverName} installed successfully for n8n integration!

1. Add this credential in n8n:
${credentialOutput}

2. Use this JSON for List Tools workflow:
${listToolsOutput}

3. Use this JSON for Execute Tool workflow:
${executeToolOutput}

Configuration saved to: ${configPath}

To use this MCP server in n8n:
1. Create a new credential in n8n of type "MCP Client API"
2. Use the configuration above
3. Create workflows using the MCP Client Tool node
`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error installing local MCP server: ${err}`,
          },
        ],
        isError: true,
      };
    }
  }

  return {
    content: [
      {
        type: "text",
        text: `Can't figure out how to install ${dirPath}. No package.json found.`,
      },
    ],
    isError: true,
  };
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    if (request.params.name === "install_repo_mcp_server") {
      const { name, args, env } = request.params.arguments as {
        name: string;
        args?: string[];
        env?: string[];
      };

      return await installRepoMcpServer(name, args, env);
    }

    if (request.params.name === "install_local_mcp_server") {
      const dirPath = request.params.arguments!.path as string;
      const { args, env } = request.params.arguments as {
        args?: string[];
        env?: string[];
      };

      return await installLocalMcpServer(dirPath, args, env);
    }

    throw new Error(`Unknown tool: ${request.params.name}`);
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: `Error setting up package: ${err}`,
        },
      ],
      isError: true,
    };
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

runServer().catch(console.error);
