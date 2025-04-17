import * as fastmcp from 'fastmcp';
import { spawn } from 'child_process';
import path from 'path';
import { createServerStatusMCP } from './dist/index.js';

/**
 * 主函数：测试MCP服务
 */
async function main() {
  // 测试方法1：通过子进程启动服务
  console.log('=== 测试方法1：通过子进程启动服务 ===');
  await testWithSubprocess();
  
  // 测试方法2：在同一进程内使用内存传输
  console.log('\n=== 测试方法2：在同一进程内使用内存传输 ===');
  await testWithMemoryTransport();
}

/**
 * 通过子进程和stdio传输方式测试
 */
async function testWithSubprocess() {
  // 创建子进程运行服务器
  const serverProcess = spawn('node', ['dist/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // 输出服务器信息以便调试
  serverProcess.stdout.on('data', (data) => {
    console.log(`服务器输出: ${data}`);
  });
  
  serverProcess.stderr.on('data', (data) => {
    console.error(`服务器错误: ${data}`);
  });

  // 创建 MCP 客户端
  const MCPClient = fastmcp.MCPClient || fastmcp.FastMCPClient;
  if (!MCPClient) {
    throw new Error('找不到MCPClient或FastMCPClient类');
  }
  
  const client = new MCPClient();

  try {
    // 连接到服务器进程
    await client.connect({
      process: serverProcess,
      transportType: "stdio"
    });

    // 获取所有可用工具
    console.log('\n=== 可用工具列表 ===');
    const tools = await client.listTools();
    console.log('可用工具:', tools);

    // 测试：获取本地服务器状态
    console.log('\n=== 测试：获取本地服务器状态 ===');
    const localStatus = await client.invoke('getLocalServerStatus', {});
    console.log('本地服务器状态:', JSON.stringify(localStatus, null, 2));

    // 测试：获取远程服务器状态（使用 SSH 配置）
    console.log('\n=== 测试：获取远程服务器状态 ===');
    try {
      const remoteStatus = await client.invoke('getRemoteServerStatus', {
        host: 'your-ssh-host' // 替换为您的 SSH 配置中的主机名
      });
      console.log('远程服务器状态:', JSON.stringify(remoteStatus, null, 2));
    } catch (error) {
      console.log('远程服务器连接失败:', error.message || error);
    }
  } finally {
    // 关闭客户端连接
    await client.disconnect();
    // 结束服务器进程
    serverProcess.kill();
  }
}

/**
 * 使用内存传输方式测试
 */
async function testWithMemoryTransport() {
  // 创建MCP服务实例
  const server = createServerStatusMCP();
  
  // 启动服务
  server.start({ 
    transportType: "memory" 
  });
  
  // 创建MCP客户端
  const MCPClient = fastmcp.MCPClient || fastmcp.FastMCPClient;
  const client = new MCPClient();
  
  try {
    // 连接到服务
    await client.connect({ 
      transportType: "memory", 
      server 
    });
    
    // 测试：获取本地服务器状态
    console.log('\n=== 测试：获取本地服务器状态（内存传输） ===');
    const localStatus = await client.invoke('getLocalServerStatus', {});
    console.log('本地服务器状态:', JSON.stringify(localStatus, null, 2));
  } finally {
    // 关闭客户端连接
    await client.disconnect();
  }
}

main().catch(err => console.error('主程序错误:', err.message || err)); 