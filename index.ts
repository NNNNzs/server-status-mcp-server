#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import os from "os";
import { NodeSSH } from 'node-ssh';
import fs from 'fs/promises';
import path from 'path';

/**
 * 创建服务器状态监控MCP服务实例
 * @param {Object} config - 服务配置选项
 * @param {string} [config.sshConfigPath] - SSH配置文件路径
 * @returns {McpServer} 创建的McpServer实例
 */
export function createServerStatusMCP(config: { sshConfigPath?: string } = {}) {
  const server = new McpServer({
    name: "server-status-mcp-server",
    version: "1.0.1"
  });

  // 自定义配置选项
  const options = {
    sshConfigPath: config.sshConfigPath || process.env.SSH_CONFIG_PATH || path.join(os.homedir(), '.ssh', 'config')
  };

  /**
   * 添加工具到MCP服务
   */
  addServerTools(server, options);

  return server;
}

/**
 * 服务器状态接口
 */
export interface RemoteServerStatus {
  cpuRel: string;
  memoryRel: string;
  alarmInfo: string;
  itemStatus: string;
  cpu: string;
  memory: string;
  memoryUsage: string;
  uptime: string;
  type: 'remote' | 'local';
}

/**
 * 解析 SSH 配置文件
 * @param {string} configContent - SSH 配置文件内容
 * @param {string} targetHost - 目标主机名
 * @returns {Object} SSH 配置对象
 */
export async function parseSSHConfig(configContent: string, targetHost: string) {
  const lines = configContent.split('\n');
  let currentHost: string | null = null;
  let config: Record<string, Record<string, string>> = {};

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) continue;

    const [key, ...values] = trimmedLine.split(/\s+/);
    const value = values.join(' ');

    if (key.toLowerCase() === 'host') {
      currentHost = value;
      if (currentHost && !config[currentHost]) {
        config[currentHost] = {};
      }
    } else if (currentHost) {
      config[currentHost][key.toLowerCase()] = value;
    }
  }

  return targetHost ? config[targetHost] : null;
}

/**
 * 获取本地CPU使用率
 * @returns {number} CPU使用率（0-1之间的值）
 */
export function getLocalCpuUsage() {
  const cpus = os.cpus();
  let totalIdle = 0, totalTick = 0;
  cpus.forEach((cpu) => {
    for (let type in cpu.times) {
      totalTick += cpu.times[type as keyof typeof cpu.times];
    }
    totalIdle += cpu.times.idle;
  });
  const idle = totalIdle / cpus.length;
  const total = totalTick / cpus.length;
  return 1 - idle / total;
}

/**
 * 向MCP服务添加服务器状态工具
 * @param {McpServer} server - McpServer实例
 * @param {Object} options - 配置选项
 */
function addServerTools(server: McpServer, options: { sshConfigPath: string }) {
  /**
   * 获取本地服务器状态的工具
   */
  server.tool(
    "get_server_status",
    "获取服务器的CPU、内存和运行状态",
    {
      host: z.string().optional().describe("远程服务器地址或SSH配置中的主机名")
    },
    async () => {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            cpuCount: os.cpus().length,
            cpuRel: getLocalCpuUsage(),
            memory: os.freemem(),
            memoryUsage: ((1 - os.freemem() / os.totalmem()) * 100).toFixed(2) + '',
            uptime: os.uptime(),
            type: 'local'
          }, null, 2)
        }]
      };
    }
  );

  /**
   * 获取远程服务器状态的工具
   */
  server.tool(
    "get_remote_server_status",
    "获取远程服务器的CPU、内存和运行状态",
    {
      host: z.string().describe("远程服务器地址或SSH配置中的主机名")
    },
    async (args) => {
      const ssh = new NodeSSH();

      try {
        const sshConfigPath = options.sshConfigPath.replace(/^~/, os.homedir());
        let sshConfig;

        try {
          const configContent = await fs.readFile(sshConfigPath, 'utf-8');
          sshConfig = await parseSSHConfig(configContent, args.host);
        } catch (error: any) {
          console.warn(`无法读取 SSH 配置文件 ${sshConfigPath}:`, error.message);
          sshConfig = null;
        }

        const connectionConfig = sshConfig ? {
          host: sshConfig.hostname || args.host,
          username: sshConfig.user,
          port: sshConfig.port ? parseInt(sshConfig.port) : 22,
          privateKey: sshConfig.identityfile ?
            await fs.readFile(sshConfig.identityfile.replace(/^~/, os.homedir()), 'utf-8') :
            undefined
        } : {
          host: args.host,
          username: os.userInfo().username,
          privateKey: path.join(os.homedir(), '.ssh', 'id_rsa')
        };

        await ssh.connect(connectionConfig);

        const [cpuInfo, memInfo, uptimeInfo] = await Promise.all([
          ssh.execCommand('cat /proc/cpuinfo'),
          ssh.execCommand('free -m'),
          ssh.execCommand('uptime'),
        ]);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              cpu: cpuInfo.stdout,
              memory: memInfo.stdout,
              uptime: uptimeInfo.stdout,
              type: 'remote'
            }, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: error.message
            }, null, 2)
          }]
        };
      } finally {
        ssh.dispose();
      }
    }
  );
}

const server = createServerStatusMCP();
const transport = new StdioServerTransport();
await server.connect(transport);