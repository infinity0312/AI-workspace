# 部署与验收

默认本机模式使用嵌入式数据库和磁盘对象存储。常规服务部署可以采用 PostgreSQL/pgvector、S3 兼容对象存储和独立 Worker。若本机安装了 Docker Compose，可使用仓库中的 `compose.yaml` 准备依赖。

```powershell
docker compose up -d postgres minio
```

创建名为 `akw` 的 MinIO 存储桶。复制 `.env.example` 为 `.env`，配置 `DATABASE_URL` 和 S3 设置，执行 `npm.cmd run migrate`。分别运行 API、独立 Worker 和 Web。当前可以用 `npm.cmd run dev -w @akw/api`、`npm.cmd run worker` 和 `npm.cmd run dev -w @akw/web` 验证独立部署。编译后的 API 由 `npm.cmd run start -w @akw/api` 启动。

服务模式使用 `AKW_PROFILE=server`，要求数据库 URL、S3 存储桶和不少于 32 字节的 JWT 签名密钥。由部署方的认证网关签发 HS256 token，声明包括 `iss`、`aud=akw-api`、`sub`、`tid`、`exp`。Web 临时壳默认走本机模式，服务环境需在同源代理层接入登录及 Authorization 注入。API 重新校验角色和租户。配置 `AKW_ALLOWED_ORIGINS` 以匹配实际 Web 来源。

数据库使用迁移事务和独立实例上的 PostgreSQL advisory lock。Worker 用 `FOR UPDATE SKIP LOCKED` 领用任务，租约过期可重领。研究检查点与模型调用预算写入数据库。业务改动和持久事件在同一事务内提交，客户端通过 cursor 拉取。

生产部署前需要在目标基础设施验证租户隔离、上游服务超时和授权、解析进程隔离、容量、备份与恢复。RPO/RTO 需在数据库和对象存储恢复演练中实测。
