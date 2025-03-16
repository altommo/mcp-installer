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
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

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
            packageName: {
              type: "string",
              description: "The package name of the MCP server (alternative parameter name)",
            },
            repository: {
              type: "string",
              description: "The package name of the MCP server (alternative parameter name)",
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
            integration: {
              type: "string",
              description: "Integration type (n8n)",
              enum: ["n8n"]
            },
            n8n_integration: {
              type: "boolean",
              description: "Whether to set up n8n integration",
            },
            debug: {
              type: "boolean",
              description: "Show debug information",
              default: false
            }
          },
          required: [],
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
            integration: {
              type: "string",
              description: "Integration type (n8n)",
              enum: ["n8n"]
            },
            n8n_integration: {
              type: "boolean",
              description: "Whether to set up n8n integration",
            },
            debug: {
              type: "boolean",
              description: "Show debug information",
              default: false
            }
          },
          required: ["path"],
        },
      },
      {
        name: "debug_python_installation",
        description: "Debug Python installation",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
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

// Check for available Python package managers with full diagnostics
async function checkPythonPackageManagers(debug = false): Promise<{ 
  installed: boolean; 
  command: string;
  diagnostics: string;
}> {
  let diagnostics = "Python package manager diagnostics:\n";
  
  // Check for various commands
  const commands = ["uvx", "uv", "pip", "pip3", "python -m uv", "python3 -m uv"];
  
  for (const cmd of commands) {
    try {
      // For commands with spaces, we need to use exec
      if (cmd.includes(" ")) {
        const result = await execAsync(`${cmd} --version`);
        diagnostics += `✓ ${cmd}: Found (${result.stdout.trim()})\n`;
        // If we found a valid command and haven't set one yet, use this one
        if (cmd === "python -m uv" || cmd === "python3 -m uv") {
          return { installed: true, command: cmd, diagnostics };
        }
      } else {
        const result = await spawnPromise(cmd, ["--version"]);
        diagnostics += `✓ ${cmd}: Found (${result.toString().trim()})\n`;
        // If it's uvx or uv, return immediately as these are preferred
        if (cmd === "uvx" || cmd === "uv") {
          return { installed: true, command: cmd, diagnostics };
        }
      }
    } catch (e) {
      diagnostics += `✗ ${cmd}: Not found or error (${e})\n`;
    }
  }
  
  // Check PATH environment
  diagnostics += `\nPATH environment: ${process.env.PATH}\n`;
  
  // Check Python version
  try {
    const pythonVersion = await execAsync("python --version");
    diagnostics += `Python version: ${pythonVersion.stdout.trim()}\n`;
  } catch (e) {
    diagnostics += `Python not found or error\n`;
  }
  
  try {
    const python3Version = await execAsync("python3 --version");
    diagnostics += `Python3 version: ${python3Version.stdout.trim()}\n`;
  } catch (e) {
    diagnostics += `Python3 not found or error\n`;
  }
  
  // Check if we can run Python and import uv
  try {
    await execAsync("python -c 'import uv; print(\"uv is installed\")'");
    diagnostics += "Python can import uv module\n";
    return { installed: true, command: "python -m uv", diagnostics };
  } catch (e) {
    diagnostics += "Python cannot import uv module\n";
  }
  
  // If we get here, we didn't find a valid Python package manager
  return { installed: false, command: "", diagnostics };
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

async function installRepoMcpServer(
  name: string,
  args?: string[],
  env?: string[],
  debug = false
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
    let command: string;
    
    if (await isNpmPackage(name)) {
      console.log(`Installing ${name} via npm...`);
      command = "npx";
      
      try {
        // Try to install locally first to avoid permission issues
        await spawnPromise("npm", ["install", name]);
      } catch (e) {
        console.log("Local installation failed, trying global installation...");
        await spawnPromise("npm", ["install", "-g", name]);
      }
    } else {
      // Check for Python package manager (uv or uvx)
      const pythonManagerResult = await checkPythonPackageManagers(debug);
      
      if (debug) {
        console.log(pythonManagerResult.diagnostics);
      }
      
      if (!pythonManagerResult.installed) {
        return {
          content: [
            {
              type: "text",
              text: `Python package manager (uv/uvx/pip) is not installed or could not be found. 
Please install uv: https://docs.astral.sh/uv/

Diagnostics:
${pythonManagerResult.diagnostics}`,
            },
          ],
          isError: true,
        };
      }
      
      console.log(`Installing ${name} via ${pythonManagerResult.command}...`);
      command = pythonManagerResult.command;
      
      try {
        if (pythonManagerResult.command === "uvx") {
          await spawnPromise("uvx", ["pip", "install", name]);
        } else if (pythonManagerResult.command === "uv") {
          await spawnPromise("uv", ["pip", "install", name]);
        } else if (pythonManagerResult.command.includes("python")) {
          await execAsync(`${pythonManagerResult.command} pip install ${name}`);
        } else {
          await spawnPromise(pythonManagerResult.command, ["install", name]);
        }
      } catch (e) {
        console.log("User installation failed, trying system installation...");
        if (pythonManagerResult.command === "uvx") {
          await spawnPromise("uvx", ["pip", "install", "--system", name]);
        } else if (pythonManagerResult.command === "uv") {
          await spawnPromise("uv", ["pip", "install", "--system", name]);
        } else if (pythonManagerResult.command.includes("python")) {
          await execAsync(`${pythonManagerResult.command} pip install ${name} --user`);
        } else {
          await spawnPromise(pythonManagerResult.command, ["install", "--user", name]);
        }
      }
    }
    
    // Also install n8n-nodes-mcp if not installed
    try {
      await spawnPromise("npm", ["list", "-g", "n8n-nodes-mcp"]);
    } catch (e) {
      console.log("Installing n8n-nodes-mcp...");
      try {
        await spawnPromise("npm", ["install", "n8n-nodes-mcp"]);
      } catch (localErr) {
        console.log("Local installation failed, trying global installation...");
        await spawnPromise("npm", ["install", "-g", "n8n-nodes-mcp"]);
      }
    }
    
    // Generate n8n credential configuration
    const configObj = generateN8nCredential(
      name,
      command,
      [name, ...(args ?? [])],
      env
    );
    
    // Save configuration to file
    let configPath;
    try {
      configPath = saveConfigToFile(configObj, name);
    } catch (e) {
      console.error("Error saving configuration file:", e);
      configPath = "Could not save configuration file";
    }
    
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
        try {
          await spawnPromise("npm", ["install", "n8n-nodes-mcp"]);
        } catch (localErr) {
          console.log("Local installation failed, trying global installation...");
          await spawnPromise("npm", ["install", "-g", "n8n-nodes-mcp"]);
        }
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
      let configPath;
      try {
        configPath = saveConfigToFile(configObj, serverName);
      } catch (e) {
        console.error("Error saving configuration file:", e);
        configPath = "Could not save configuration file";
      }
      
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

async function debugPythonInstallation() {
  const pythonManagerResult = await checkPythonPackageManagers(true);
  
  return {
    content: [
      {
        type: "text",
        text: `Python Package Manager Debug Information:

${pythonManagerResult.diagnostics}

Python package manager found: ${pythonManagerResult.installed ? "Yes" : "No"}
Command to use: ${pythonManagerResult.command || "None found"}

System information:
- OS: ${os.platform()} ${os.release()}
- Node.js: ${process.version}
- Architecture: ${os.arch()}
- User: ${os.userInfo().username}
- Home directory: ${os.homedir()}
- Current directory: ${process.cwd()}

Environment variables:
${Object.entries(process.env)
  .filter(([key]) => ['PATH', 'PYTHONPATH', 'VIRTUAL_ENV', 'HOME', 'USER'].includes(key))
  .map(([key, value]) => `- ${key}: ${value}`)
  .join('\n')}
`,
      },
    ],
  };
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    if (request.params.name === "install_repo_mcp_server") {
      // Support multiple parameter names
      const name = 
        (request.params.arguments?.name as string) || 
        (request.params.arguments?.packageName as string) ||
        (request.params.arguments?.repository as string);
      
      if (!name) {
        return {
          content: [
            {
              type: "text",
              text: "Error: Package name is required. Please provide 'name', 'packageName', or 'repository' parameter.",
            },
          ],
          isError: true,
        };
      }
      
      const { args, env, debug } = request.params.arguments as {
        args?: string[];
        env?: string[];
        debug?: boolean;
      };

      return await installRepoMcpServer(name, args, env, debug);
    }

    if (request.params.name === "install_local_mcp_server") {
      const dirPath = request.params.arguments!.path as string;
      const { args, env } = request.params.arguments as {
        args?: string[];
        env?: string[];
      };

      return await installLocalMcpServer(dirPath, args, env);
    }
    
    if (request.params.name === "debug_python_installation") {
      return await debugPythonInstallation();
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
