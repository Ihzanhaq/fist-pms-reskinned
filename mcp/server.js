#!/usr/bin/env node
// FIST PMS tools for Claude over MCP (stdio). stdout is the protocol channel,
// so nothing else may write to it.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { startSessionKeepalive } from '../server/keepalive.js';
import { registerTools } from './tools.js';

const server = new McpServer(
  { name: 'fist-pms', version: '1.0.0' },
  {
    instructions:
      'Tools for FIST PMS (pms.fistinnovations.com). Refer to issues by key (e.g. BMS-1). ' +
      'Status names differ per project; get_issue lists the ones available. ' +
      'Confirm with the user before creating issues or changing several issues at once.',
  },
);
registerTools(server);
startSessionKeepalive();
await server.connect(new StdioServerTransport());
