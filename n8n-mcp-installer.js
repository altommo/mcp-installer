#!/usr/bin/env node

import * as crypto from 'crypto';
import { spawnPromise } from 'spawn-rx';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

// Main function to install MCP server for n8n
async function installMcpServerForN8n(packageName) {
  try {
    // Check if package exists on npm
    console.log(`Checking if ${packageName} exists on npm...`);
    const isNpmPackage = await checkIfNpmPackage(packageName);
    
    if (isNpmPackage) {
      console.log(`Installing ${packageName} via npm...`);
      await spawnPromise('npm', ['install', '-g', packageName]);
      
      // Also ensure n8n-nodes-mcp is installed
      try {
        console.log('Checking if n8n-nodes-mcp is installed...');
        await spawnPromise('npm', ['list', '-g', 'n8n-nodes-mcp']);
      } catch (e) {
        console.log('Installing n8n-nodes-mcp...');
        await spawnPromise('npm', ['install', '-g', 'n8n-nodes-mcp']);
      }
      
      // Generate credentials
      const credentials = generateN8nCredentials(packageName);
      
      // Output credentials
      console.log('\n=== n8n MCP Server Integration ===');
      console.log(`\nPackage ${packageName} installed successfully!`);
      console.log('\n1. Add this credential in n8n:');
      console.log(JSON.stringify(credentials.credential, null, 2));
      
      console.log('\n2. Use this JSON for List Tools workflow:');
      console.log(JSON.stringify(credentials.listNode, null, 2));
      
      console.log('\n3. Use this JSON for Execute Tool workflow:');
      console.log(JSON.stringify(credentials.executeNode, null, 2));
      
      // Save to file for reference
      const configPath = saveConfigToFile(credentials, packageName);
      console.log(`\nConfiguration saved to: ${configPath}`);
      
      return {
        success: true,
        message: `MCP server ${packageName} installed successfully for n8n`,
        credentials
      };
    } else {
      // Check if it's a Python package
      console.log('Not found on npm, checking for Python package...');
      // We would implement Python/uvx checks here if needed
      
      return {
        success: false,
        message: `Package ${packageName} was not found. Please check the name and try again.`
      };
    }
  } catch (error) {
    console.error('Installation error:', error);
    return {
      success: false,
      message: `Error installing ${packageName}: ${error.message}`
    };
  }
}

// Check if a package exists on npm
async function checkIfNpmPackage(name) {
  try {
    await spawnPromise('npm', ['view', name, 'version']);
    return true;
  } catch (e) {
    return false;
  }
}

// Generate credentials for n8n
function generateN8nCredentials(packageName) {
  // Clean up package name for display
  const cleanName = packageName.replace(/^@/, '').replace(/\//, '-');
  
  // Generate unique ID
  const credentialId = crypto.randomBytes(8).toString('hex');
  const nodeId1 = crypto.randomBytes(16).toString('hex');
  const nodeId2 = crypto.randomBytes(16).toString('hex');
  const instanceId = crypto.randomBytes(32).toString('hex');
  
  // Create credential
  const credential = {
    id: credentialId,
    name: `${cleanName} MCP`,
    data: {
      command: 'npx',
      args: [packageName],
      env: {}
    },
    type: 'mcpClientApi'
  };
  
  // Create List Tools node
  const listNode = {
    nodes: [
      {
        parameters: {},
        type: 'n8n-nodes-mcp.mcpClientTool',
        typeVersion: 1,
        position: [580, 700],
        id: nodeId1,
        name: `MCP Client ${cleanName} Tools`,
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
  
  // Add connections
  listNode.connections[`MCP Client ${cleanName} Tools`] = {
    ai_tool: [[]]
  };
  
  // Create Execute Tool node
  const executeNode = {
    nodes: [
      {
        parameters: {
          operation: 'executeTool',
          toolName: "={{ $fromAI(\"tool\",\"Set this with specific tool name\") }}",
          toolParameters: "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Tool_Parameters', ``, 'json') }}"
        },
        type: 'n8n-nodes-mcp.mcpClientTool',
        typeVersion: 1,
        position: [620, 740],
        id: nodeId2,
        name: `${cleanName} Tools Execute`,
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
  
  // Add connections
  executeNode.connections[`${cleanName} Tools Execute`] = {
    ai_tool: [[]]
  };
  
  return {
    credential,
    listNode,
    executeNode
  };
}

// Save configuration to file for reference
function saveConfigToFile(config, packageName) {
  const homeDir = os.homedir();
  const configDir = path.join(homeDir, '.n8n-mcp-configs');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  // Sanitize package name for filename
  const cleanName = packageName.replace(/[@/]/g, '-');
  const configPath = path.join(configDir, `${cleanName}-config.json`);
  
  // Write to file
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  
  return configPath;
}

// Main function - called when running from CLI
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Please provide a package name to install');
    console.log('Usage: n8n-mcp-install [package-name]');
    process.exit(1);
  }
  
  const packageName = args[0];
  const result = await installMcpServerForN8n(packageName);
  
  if (!result.success) {
    console.error(result.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

// Export for use as a module
export { installMcpServerForN8n };
