# 阿里云语音识别 API - Vercel Functions

这个项目提供了一个基于Vercel Functions的阿里云语音识别API代理服务，支持完整的音频格式处理和错误提示。

## 🎯 功能特性

- 🎤 阿里云实时语音识别API代理
- 🔐 安全的API密钥处理（支持Token和AccessKey两种方式）
- 🌐 完整的CORS支持
- ⚡ 基于Vercel的无服务器架构
- 🔄 音频格式转换指导和错误处理
- 📊 详细的调试信息和错误提示

## 📡 API 端点

### 1. POST /api/get-token
获取阿里云访问令牌

#### 请求参数
```json
{
  "appKey": "阿里云应用AppKey",
  "accessKeyId": "阿里云Access Key ID", 
  "accessKeySecret": "阿里云Access Key Secret"
}
```

#### 响应格式
```json
{
  "success": true,
  "token": "获取的访问令牌",
  "expireTime": 1642694400
}
```

### 2. POST /api/recognize
语音识别端点

#### 请求参数
```json
{
  "audioData": [1, 2, 3, ...],  // Uint8Array转换后的数组格式
  "appKey": "阿里云应用AppKey",
  "token": "访问令牌（可选，如果没有会自动获取）",
  "accessKeyId": "阿里云Access Key ID（token为空时必需）",
  "accessKeySecret": "阿里云Access Key Secret（token为空时必需）",
  "format": "pcm",
  "sampleRate": 16000
}
```

#### 成功响应
```json
{
  "success": true,
  "result": "识别的文字内容",
  "timestamp": 1642694400000,
  "debugInfo": {
    "audioDataLength": 12345,
    "executionPath": "callAliyunNLS_executed"
  }
}
```

#### 错误响应（格式错误时）
```json
{
  "success": false,
  "error": "音频数据格式不正确",
  "details": {
    "received": "object",
    "expected": "array",
    "description": "音频数据应该是Uint8Array转换后的数组格式"
  },
  "suggestion": {
    "message": "接收到对象类型，可能是Blob或其他对象",
    "solution": "如果是Blob，请先转换为ArrayBuffer，然后转为Uint8Array数组",
    "code": "const audioData = Array.from(new Uint8Array(arrayBuffer));"
  },
  "examples": {
    "webmToMp3": { /* 详细的转换示例 */ },
    "correctUsage": { /* 正确的使用方法 */ }
  }
}
```

## 🎵 音频格式处理指南

### 方法1：使用lamejs处理WebM录音

如果你的录音是WebM格式（如MediaRecorder产生的），可以使用lamejs进行转换：

```html
<!-- 引入lamejs库 -->
<script src="https://cdn.jsdelivr.net/npm/lamejs@1.2.0/lame.min.js"></script>
```

```javascript
// 完整的WebM转PCM处理流程
async function processWebMRecording(webmBlob) {
    try {
        // 1. 创建AudioContext
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // 2. 将WebM Blob转换为ArrayBuffer
        const arrayBuffer = await webmBlob.arrayBuffer();
        
        // 3. 解码音频数据
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // 4. 获取PCM数据（Float32Array）
        const pcmData = audioBuffer.getChannelData(0);
        
        // 5. 转换为正确的格式发送给API
        const buffer = new ArrayBuffer(pcmData.length * 4);
        const view = new Float32Array(buffer);
        view.set(pcmData);
        const audioData = Array.from(new Uint8Array(buffer));
        
        return audioData;
    } catch (error) {
        console.error('音频处理失败:', error);
        throw error;
    }
}

// 使用示例
async function recognizeWebMRecording(webmBlob, config) {
    // 处理音频数据
    const audioData = await processWebMRecording(webmBlob);
    
    // 调用识别API
    const response = await fetch('https://aliyun-voice-to-text-api.vercel.app/api/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            audioData: audioData,
            appKey: config.appKey,
            accessKeyId: config.accessKeyId,
            accessKeySecret: config.accessKeySecret,
            format: 'pcm',
            sampleRate: 16000
        })
    });
    
    const result = await response.json();
    return result;
}
```

### 方法2：使用Web Audio API直接录音

推荐的录音方式，直接获取PCM数据：

```javascript
class AudioRecorder {
    constructor() {
        this.audioContext = null;
        this.audioBuffer = [];
        this.isRecording = false;
    }
    
    async startRecording() {
        // 获取麦克风权限
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // 创建AudioContext
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = this.audioContext.createMediaStreamSource(stream);
        
        // 创建ScriptProcessor收集PCM数据
        const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
        
        processor.onaudioprocess = (event) => {
            if (this.isRecording) {
                const inputBuffer = event.inputBuffer.getChannelData(0);
                const buffer = new Float32Array(inputBuffer.length);
                buffer.set(inputBuffer);
                this.audioBuffer.push(buffer);
            }
        };
        
        source.connect(processor);
        processor.connect(this.audioContext.destination);
        
        this.isRecording = true;
    }
    
    stopRecording() {
        this.isRecording = false;
        
        // 合并所有音频数据
        const totalLength = this.audioBuffer.reduce((sum, buffer) => sum + buffer.length, 0);
        const mergedBuffer = new Float32Array(totalLength);
        let offset = 0;
        
        for (let buffer of this.audioBuffer) {
            mergedBuffer.set(buffer, offset);
            offset += buffer.length;
        }
        
        // 转换为API需要的格式
        const buffer = new ArrayBuffer(mergedBuffer.length * 4);
        const view = new Float32Array(buffer);
        view.set(mergedBuffer);
        const audioData = Array.from(new Uint8Array(buffer));
        
        return audioData;
    }
}

// 使用示例
const recorder = new AudioRecorder();

// 开始录音
await recorder.startRecording();

// 10秒后停止录音
setTimeout(async () => {
    const audioData = recorder.stopRecording();
    
    // 发送到API进行识别
    const result = await fetch('https://aliyun-voice-to-text-api.vercel.app/api/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            audioData: audioData,
            appKey: 'your-app-key',
            token: 'your-token',
            format: 'pcm',
            sampleRate: 16000
        })
    });
    
    const response = await result.json();
    console.log('识别结果:', response.result);
}, 10000);
```

## 🚀 完整的两步调用示例

推荐的调用方式（先获取token，再识别）：

```javascript
async function recognizeAudioComplete(audioData, credentials) {
    try {
        // 第一步：获取Token
        console.log('🔄 正在获取阿里云Token...');
        const tokenResponse = await fetch('https://aliyun-voice-to-text-api.vercel.app/api/get-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                appKey: credentials.appKey,
                accessKeyId: credentials.accessKeyId,
                accessKeySecret: credentials.accessKeySecret
            })
        });
        
        const tokenResult = await tokenResponse.json();
        if (!tokenResult.success) {
            throw new Error('Token获取失败: ' + tokenResult.error);
        }
        
        console.log('✅ Token获取成功');
        
        // 第二步：使用Token进行语音识别
        console.log('🔄 开始语音识别...');
        const recognizeResponse = await fetch('https://aliyun-voice-to-text-api.vercel.app/api/recognize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: tokenResult.token,
                audioData: audioData, // 必须是数组格式
                format: 'pcm',
                sampleRate: 16000,
                appKey: credentials.appKey,
                accessKeyId: credentials.accessKeyId,
                accessKeySecret: credentials.accessKeySecret
            })
        });
        
        const recognizeResult = await recognizeResponse.json();
        
        if (recognizeResult.success) {
            console.log('✅ 识别成功:', recognizeResult.result);
            return recognizeResult.result;
        } else {
            throw new Error('识别失败: ' + recognizeResult.error);
        }
        
    } catch (error) {
        console.error('❌ 语音识别失败:', error);
        throw error;
    }
}

// 使用示例
const credentials = {
    appKey: 'your-app-key',
    accessKeyId: 'your-access-key-id',
    accessKeySecret: 'your-access-key-secret'
};

// audioData 必须是 Array<number> 格式
const audioData = Array.from(new Uint8Array(yourAudioBuffer));

recognizeAudioComplete(audioData, credentials)
    .then(result => console.log('最终结果:', result))
    .catch(error => console.error('错误:', error));
```

## 🔧 本地开发

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
# 测试Token获取
curl -X POST http://localhost:3000/api/get-token \
  -H "Content-Type: application/json" \
  -d '{
    "appKey": "your_app_key",
    "accessKeyId": "your_access_key_id", 
    "accessKeySecret": "your_access_key_secret"
  }'

# 测试语音识别（需要真实的音频数据数组）
curl -X POST http://localhost:3000/api/recognize \
  -H "Content-Type: application/json" \
  -d '{
    "audioData": [1,2,3,4,5],
    "appKey": "your_app_key",
    "token": "your_token",
    "format": "pcm",
    "sampleRate": 16000
  }'
```

## 🚀 部署到Vercel

### 方法1: 通过GitHub自动部署（推荐）

1. 将代码推送到GitHub仓库：
```bash
git add .
git commit -m "优化音频格式处理和错误提示"
git push origin main
```

2. Vercel会自动检测到推送并开始部署
3. 部署完成后，你的API将在 `https://your-project.vercel.app` 可用

### 方法2: 使用Vercel CLI

```bash
npm i -g vercel
vercel login
vercel --prod
```

## ⚠️ 常见错误和解决方案

### 1. 音频数据格式错误
**错误**: `音频数据格式不正确`
**解决**: 确保audioData是数组格式，使用 `Array.from(new Uint8Array(buffer))`

### 2. 音频数据为空
**错误**: `音频数据不能为空`
**解决**: 检查录音是否正常工作，确保有有效的音频数据

### 3. Token获取失败
**错误**: `获取访问令牌失败`
**解决**: 检查阿里云AccessKey是否正确，是否有智能语音交互服务权限

### 4. CORS错误
**错误**: `Access to fetch blocked by CORS policy`
**解决**: 确保使用HTTPS访问，或在本地开发时使用正确的域名

## 🔗 相关链接

- [在线API地址](https://aliyun-voice-to-text-api.vercel.app)
- [Vercel Functions文档](https://vercel.com/docs/functions)
- [阿里云语音识别文档](https://help.aliyun.com/product/30413.html)
- [lamejs库文档](https://github.com/zhuker/lamejs)

## 📝 更新日志

- **v3.0**: 优化音频格式错误处理，添加详细的转换示例和建议
- **v2.0**: 支持两步API调用（get-token + recognize）
- **v1.0**: 基础的语音识别功能

---

如有问题，请查看错误响应中的详细建议，或参考上述完整示例代码。