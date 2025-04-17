# 服务器状态监控工具

这是一个基于 FastMCP 的服务器状态监控工具，可以获取本地或远程服务器的 CPU、内存和运行时间信息。

## 功能特点

- 支持获取本地服务器状态
- 支持通过 SSH 获取远程服务器状态
- 自动读取 SSH 配置文件（~/.ssh/config）
- 支持自定义 SSH 连接参数
- 可作为独立服务器运行
- 可作为npm包集成到其他应用中

## 安装

### 通过npm安装

```bash
# 全局安装
npm install -g server-status-mcp-server

# 或作为项目依赖安装
npm install server-status-mcp-server
```

### 从源码安装

```bash
# 克隆仓库
git clone https://github.com/nnnnzs/server-status-mcp-server.git
cd server-status-mcp-server

# 安装依赖
npm install

# 构建项目
npm run build
```

## 使用方法

### 作为独立服务运行

#### 1. 启动服务器

```bash
# 如果全局安装了包
server-status-mcp-server

# 或者从源码启动
npm start
```

#### 2. 运行测试客户端

```bash
node client.js
```

#### 3. 命令行直接调用

使用 `stdio` 方式与服务器通信：

```bash
echo '{"jsonrpc":"2.0","method":"get_server_status","params":{},"id":1}' | node dist/index.js
```

获取远程服务器状态：

```bash
echo '{"jsonrpc":"2.0","method":"getRemoteServerStatus","params":{"host":"172.18.1.103"},"id":1}' | node dist/index.js
```

### 作为npm包集成

#### 1. 创建和配置MCP服务

```javascript
import { createServerStatusMCP } from 'server-status-mcp-server';

// 创建MCP服务实例
const server = createServerStatusMCP({
  // 可选：自定义SSH配置文件路径
  sshConfigPath: '/path/to/ssh/config'
});

// 启动服务
server.start({
  transportType: "stdio" // 或其他传输类型
});
```

#### 2. 使用MCP客户端调用

```javascript
import { MCPClient } from 'fastmcp';
import { createServerStatusMCP } from 'server-status-mcp-server';
import { spawn } from 'child_process';

async function main() {
  // 方法1：创建子进程运行服务
  const serverProcess = spawn('node', ['path/to/your/server.js']);
  
  // 创建MCP客户端
  const client = new MCPClient();
  
  // 连接到服务进程
  await client.connect({
    process: serverProcess,
    transportType: "stdio"
  });
  
  // 方法2：在同一进程中使用（不推荐用于生产环境）
  const server = createServerStatusMCP();
  server.start({ transportType: "memory" });
  
  const memoryClient = new MCPClient();
  await memoryClient.connect({ transportType: "memory", server });
  
  // 调用工具
  const localStatus = await client.invoke('getLocalServerStatus', {});
  console.log('本地服务器状态:', JSON.stringify(localStatus, null, 2));
  
  const remoteStatus = await client.invoke('getRemoteServerStatus', {
    host: 'your-ssh-host'
  });
  console.log('远程服务器状态:', JSON.stringify(remoteStatus, null, 2));
  
  // 断开连接
  await client.disconnect();
  serverProcess.kill();
}

main().catch(console.error);
```

## SSH 配置示例

在 `~/.ssh/config` 文件中添加以下配置：

```
Host my-server
    HostName 192.168.1.100
    User username
    Port 22
    IdentityFile ~/.ssh/id_rsa
```

然后可以使用配置的主机名来获取状态：

```bash
echo '{"jsonrpc":"2.0","method":"getRemoteServerStatus","params":{"host":"my-server"},"id":1}' | node dist/index.js
```

## 返回数据格式

### 本地服务器状态

```json
{
  "cpuCount": 8,
  "cpuRel": 0.12,
  "memory": 8589934592,
  "memoryUsage": "45.32",
  "uptime": 123456,
  "type": "local"
}
```

### 远程服务器状态

```json
{
  "cpu": "处理器信息...",
  "memory": "内存使用情况...",
  "uptime": "系统运行时间...",
  "type": "remote"
}
```

## API文档

### 主要导出

```typescript
// 创建MCP服务实例
createServerStatusMCP(config?: { sshConfigPath?: string }): FastMCP

// 获取本地CPU使用率
getLocalCpuUsage(): number

// 解析SSH配置文件
parseSSHConfig(configContent: string, targetHost: string): Promise<Record<string, string> | null>

// 服务器状态接口
interface RemoteServerStatus {
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
```

## 错误处理

如果连接失败或执行命令出错，将返回：

```json
{
  "error": "错误信息"
}
```

## 发布到NPM

如果你想自己发布这个包到NPM，可以按照以下步骤操作：

1. 更新`package.json`中的版本号
2. 运行`npm run build`确保构建成功
3. 运行`npm login`登录NPM账号
4. 运行`npm publish`发布包
5. 可选：使用`npm publish --access public`发布公共包

## 许可证

ISC

