# 阿里云语音识别 API - Vercel Functions

这个项目提供了一个基于Vercel Functions的阿里云语音识别API代理服务，用于1minSlidePre应用程序。

## 功能特性

- 🎤 阿里云实时语音识别API代理
- 🔐 安全的API密钥处理
- 🌐 CORS支持，允许GitHub Pages调用
- ⚡ 基于Vercel的无服务器架构
- 📊 音频处理和识别结果返回

## API 端点

### POST /api/recognize

语音识别端点，接受音频数据并返回识别结果。

#### 请求参数

```json
{
  "audioData": "base64编码的音频数据",
  "appKey": "阿里云应用AppKey",
  "accessKeyId": "阿里云Access Key ID",
  "accessKeySecret": "阿里云Access Key Secret",
  "maxDuration": 60
}
```

#### 响应格式

成功响应：
```json
{
  "success": true,
  "data": {
    "text": "识别的文字内容",
    "confidence": 0.95,
    "duration": 3.2,
    "tokenExpireTime": 1642694400
  }
}
```

错误响应：
```json
{
  "success": false,
  "error": "错误信息"
}
```

## 本地开发

1. 安装依赖：
```bash
npm install
```

2. 启动开发服务器：
```bash
npm run dev
```

3. 测试API端点：
```bash
curl -X POST http://localhost:3000/api/recognize \
  -H "Content-Type: application/json" \
  -d '{
    "audioData": "base64_audio_data_here",
    "appKey": "your_app_key",
    "accessKeyId": "your_access_key_id",
    "accessKeySecret": "your_access_key_secret",
    "maxDuration": 60
  }'
```

## 部署到Vercel

### 方法1: 使用Vercel CLI

1. 安装Vercel CLI：
```bash
npm i -g vercel
```

2. 登录Vercel：
```bash
vercel login
```

3. 部署项目：
```bash
vercel --prod
```

### 方法2: 通过GitHub集成

1. 将代码推送到GitHub仓库
2. 在Vercel控制台中连接GitHub仓库
3. 配置自动部署

## 环境变量

虽然API密钥通过请求体传递，但你也可以设置一些可选的环境变量：

- `NODE_ENV`: 运行环境 (development/production)

## 安全注意事项

1. **API密钥安全**: API密钥通过HTTPS请求体传递，确保只在安全的环境中使用
2. **CORS配置**: 当前配置允许所有域名访问，生产环境中建议限制为特定域名
3. **请求限制**: 考虑添加请求频率限制以防止滥用

## 使用示例

在你的前端应用中调用API：

```javascript
async function recognizeAudio(audioBlob, config) {
  // 将音频转换为base64
  const audioData = await blobToBase64(audioBlob);
  
  try {
    const response = await fetch('https://your-vercel-app.vercel.app/api/recognize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audioData: audioData.split(',')[1], // 移除data:audio/wav;base64,前缀
        appKey: config.appKey,
        accessKeyId: config.accessKeyId,
        accessKeySecret: config.accessKeySecret,
        maxDuration: 60
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('识别结果:', result.data.text);
      return result.data;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('语音识别失败:', error);
    throw error;
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

## 技术栈

- **Runtime**: Node.js 18+
- **Platform**: Vercel Functions
- **Dependencies**: 
  - crypto (签名生成)
  - querystring (参数处理)

## 支持

如有问题，请查看：
1. [Vercel Functions文档](https://vercel.com/docs/functions)
2. [阿里云语音识别文档](https://help.aliyun.com/product/30413.html)
// Force redeploy
