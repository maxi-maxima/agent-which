# 贡献指南

感谢你改进 `agent-which`。

## 开发

```bash
npm install
npm run check
node dist/cli.js demo
```

## Pull Request 要求

- 保持本地优先和确定性。
- 行为变化需要新增或更新测试。
- 用户可见行为变化时，同时更新英文和中文文档。
- 避免加入模型调用、遥测或网络依赖。
