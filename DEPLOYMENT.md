# 🚀 Vercel部署指南

## 快速部署 (推荐方法)

### 1. 通过Vercel网站部署

1. **登录Vercel**
   - 访问 [vercel.com](https://vercel.com)
   - 使用GitHub账号登录

2. **导入项目**
   - 点击 "New Project"
   - 选择 "Import Git Repository"
   - 搜索并选择 `aliyun_voice_api` 仓库
   - 点击 "Import"

3. **项目配置**
   ```
   Project Name: aliyun-voice-api
   Framework Preset: Other
   Root Directory: ./
   Build Command: (留空)
   Output Directory: (留空)
   Install Command: npm install
   ```

4. **部署**
   - 点击 "Deploy" 按钮
   - 等待部署完成 (1-2分钟)
   - 获取部署URL，格式类似: `https://aliyun-voice-api-xxx.vercel.app`

### 2. 验证部署

部署完成后，你会得到一个类似这样的URL:
```
https://aliyun-voice-api-xxx.vercel.app
```

你的API端点将是:
```
https://aliyun-voice-api-xxx.vercel.app/api/recognize
```

### 3. 测试API

使用curl测试API是否正常工作:

```bash
curl -X POST https://your-app-name.vercel.app/api/recognize \
  -H "Content-Type: application/json" \
  -d '{
    "audioData": "test_base64_data",
    "appKey": "your_app_key",
    "accessKeyId": "your_access_key_id",
    "accessKeySecret": "your_access_key_secret",
    "maxDuration": 60
  }'
```

## 在1minSlidePre中使用API

部署完成后，你需要在1minSlidePre项目中更新API调用地址。

### 更新前端代码

在 `pages/audio-setup.js` 中的 `recognizeAudio` 函数中，将API端点更新为你的Vercel部署地址:

```javascript
async function recognizeAudio(audioBlob) {
    try {
        // 将音频转换为base64
        const audioData = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(audioBlob);
        });

        // 获取配置
        const config = simpleConfig.getConfig();
        
        // 调用Vercel API
        const response = await fetch('https://your-app-name.vercel.app/api/recognize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                audioData: audioData.split(',')[1], // 移除data:audio/wav;base64,前缀
                appKey: config.audioAppKey,
                accessKeyId: config.audioAccessKeyId,
                accessKeySecret: config.audioAccessKeySecret,
                maxDuration: 60
            })
        });

        const result = await response.json();
        
        if (result.success) {
            return {
                success: true,
                text: result.data.text,
                confidence: result.data.confidence
            };
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('语音识别失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
}
```

## 自动部署设置

### GitHub Actions (可选)

如果你想设置自动部署，Vercel会自动为你的GitHub仓库设置webhook。每次推送到master分支时，Vercel会自动重新部署。

### 环境分支

- `master` 分支 → 生产环境
- 其他分支 → 预览环境

## 监控和日志

1. **访问控制台**
   - 在Vercel控制台中查看你的项目
   - 点击项目名称进入详情页

2. **查看日志**
   - 点击 "Functions" 标签
   - 选择 `/api/recognize` 函数
   - 查看实时日志和错误信息

3. **性能监控**
   - 在 "Analytics" 标签中查看API调用统计
   - 监控响应时间和错误率

## 故障排除

### 常见问题

1. **CORS错误**
   - 确保 `vercel.json` 中的CORS配置正确
   - 检查请求头设置

2. **API密钥错误**
   - 验证阿里云AccessKey配置
   - 检查AppKey是否正确

3. **音频格式问题**
   - 确保音频数据是正确的base64格式
   - 检查音频文件大小限制

### 调试技巧

1. **查看Vercel日志**
   ```bash
   # 如果安装了Vercel CLI
   vercel logs your-app-name
   ```

2. **本地测试**
   ```bash
   # 在项目目录中
   npm install
   vercel dev
   ```

3. **API测试工具**
   - 使用Postman或Insomnia测试API
   - 检查请求和响应格式

## 成本和限制

### Vercel免费计划限制
- 每月100GB带宽
- 每月100GB-hours函数执行时间
- 每个函数最大10秒执行时间
- 每个函数最大50MB内存

### 优化建议
- 压缩音频数据以减少带宽使用
- 实现请求缓存机制
- 添加请求频率限制

## 安全建议

1. **API密钥保护**
   - 不要在客户端代码中硬编码API密钥
   - 考虑实现服务端会话管理

2. **请求验证**
   - 添加请求来源验证
   - 实现请求频率限制

3. **HTTPS强制**
   - Vercel默认强制HTTPS
   - 确保所有API调用都使用HTTPS

## 下一步

部署完成后，你可以:
1. 在1minSlidePre中集成新的API端点
2. 测试完整的语音识别流程
3. 根据需要添加更多功能 (如智谱AI端点)
4. 优化性能和安全性

祝你部署成功！🎉
