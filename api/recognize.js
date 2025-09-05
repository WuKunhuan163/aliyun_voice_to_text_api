// 阿里云语音识别API - 基于正确的工作实现
const { RPCClient } = require('@alicloud/pop-core');

/**
 * 获取阿里云Token
 */
async function getAliyunToken(accessKeyId, accessKeySecret) {
    try {
        console.log('🔑 创建阿里云客户端...');
        console.log('   AccessKey ID:', accessKeyId.substring(0, 8) + '...');
        
        // 使用@alicloud/pop-core创建客户端 - 与工作版本相同
        const client = new RPCClient({
            accessKeyId: accessKeyId,
            accessKeySecret: accessKeySecret,
            endpoint: 'http://nls-meta.cn-shanghai.aliyuncs.com', // HTTP，不是HTTPS
            apiVersion: '2019-02-28'
        });
        
        console.log('🔄 调用CreateToken API...');
        
        // 调用CreateToken API
        const result = await client.request('CreateToken');
        
        console.log('✅ Token获取成功:');
        console.log('   Token ID:', result.Token.Id.substring(0, 16) + '...');
        console.log('   过期时间:', new Date(result.Token.ExpireTime * 1000).toLocaleString());
        
        return {
            success: true,
            token: result.Token.Id,
            expireTime: result.Token.ExpireTime
        };
        
    } catch (error) {
        console.error('❌ Token获取失败:', error);
        console.error('   错误类型:', error.constructor.name);
        console.error('   错误代码:', error.code || 'N/A');
        console.error('   错误消息:', error.message);
        
        let errorMessage = error.message;
        
        if (error.code) {
            switch (error.code) {
                case 'InvalidAccessKeyId.NotFound':
                    errorMessage = 'AccessKey ID 不存在，请检查是否正确';
                    break;
                case 'SignatureDoesNotMatch':
                    errorMessage = 'AccessKey Secret 不正确，请检查是否正确';
                    break;
                case 'Forbidden':
                case 'NoPermission':
                    errorMessage = '权限不足，请检查AccessKey权限设置';
                    break;
                default:
                    errorMessage = `API错误: ${error.message}`;
                    break;
            }
        }
        
        return {
            success: false,
            error: errorMessage
        };
    }
}

/**
 * 调用阿里云NLS语音识别API - 按照工作版本实现
 */
async function callAliyunNLS(requestData) {
    const { token, audioData, appKey, format = 'pcm', sampleRate = 16000 } = requestData;
    
    try {
        console.log('🎤 音频数据长度:', audioData.length);
        console.log('🔑 使用Token:', token.substring(0, 16) + '...');
        console.log('🔐 使用AppKey:', appKey);
        
        // 构建请求URL - 与工作版本完全相同
        const nlsUrl = 'https://nls-gateway.cn-shanghai.aliyuncs.com/stream/v1/asr';
        
        // 构建请求参数 - 与工作版本完全相同
        const params = new URLSearchParams({
            appkey: appKey, // 使用客户端发送的AppKey
            token: token,
            format: format,
            sample_rate: sampleRate.toString(),
            enable_punctuation_prediction: 'true',
            enable_inverse_text_normalization: 'true'
        });
        
        const requestUrl = `${nlsUrl}?${params}`;
        
        console.log('🔗 调用阿里云NLS API:', requestUrl.substring(0, 100) + '...');
        
        // 将音频数据转换为Buffer - 关键：audioData已经是数组格式
        const audioBuffer = Buffer.from(audioData);
        
        console.log('📊 发送音频数据大小:', audioBuffer.length, 'bytes');
        
        // 发送POST请求到阿里云NLS API - 与工作版本完全相同
        const response = await fetch(requestUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Length': audioBuffer.length.toString()
            },
            body: audioBuffer
        });
        
        console.log('📡 阿里云API响应状态:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ 阿里云API错误响应:', errorText);
            throw new Error(`阿里云API错误: ${response.status} - ${errorText}`);
        }
        
        const responseText = await response.text();
        console.log('📄 阿里云API原始响应:', responseText);
        
        // 解析响应 - 与工作版本完全相同
        const result = JSON.parse(responseText);
        
        if (result.status === 20000000) {
            // 识别成功 - 与工作版本完全相同的返回格式
            console.log('✅ 识别结果:', result.result);
            return {
                success: true,
                text: result.result, // 使用text字段，与前端期望一致
                confidence: 0.9, // 阿里云API可能不返回置信度
                timestamp: Date.now()
            };
        } else {
            // 识别失败
            throw new Error(`阿里云识别失败: ${result.message || '未知错误'}`);
        }
        
    } catch (error) {
        console.error('❌ 调用阿里云NLS失败:', error);
        
        // 如果是网络错误，返回更详细的信息
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('网络连接失败，请检查网络连接');
        }
        
        throw error;
    }
}

/**
 * Vercel Function 主函数
 */
export default async function handler(req, res) {
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Authorization');
    
    // 处理CORS预检请求
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 只允许POST请求
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            success: false, 
            error: '只支持POST请求' 
        });
    }

    try {
        const { 
            audioData, 
            appKey, 
            accessKeyId, 
            accessKeySecret, 
            format = 'pcm',
            sampleRate = 16000
        } = req.body;

        // 验证必需参数
        if (!audioData || !appKey || !accessKeyId || !accessKeySecret) {
            return res.status(400).json({
                success: false,
                error: '缺少必需参数: audioData, appKey, accessKeyId, accessKeySecret'
            });
        }

        // 获取访问令牌
        console.log('正在获取阿里云访问令牌...');
        const tokenResult = await getAliyunToken(accessKeyId, accessKeySecret);
        
        if (!tokenResult.success) {
            return res.status(401).json({
                success: false,
                error: `获取访问令牌失败: ${tokenResult.error}`
            });
        }

        console.log('访问令牌获取成功，开始语音识别...');
        
        // 检查音频数据格式 - audioData应该是数组格式
        if (!Array.isArray(audioData)) {
            return res.status(400).json({
                success: false,
                error: '音频数据格式错误，应该是数组格式'
            });
        }

        // 添加音频数据大小检查
        if (audioData.length > 10 * 1024 * 1024) { // 10MB限制
            return res.status(413).json({
                success: false,
                error: '音频文件过大，请录制较短的音频'
            });
        }
        
        console.log(`音频数据大小: ${audioData.length} bytes (数组)`);
        
        // 执行语音识别 - 按照工作版本的方式
        const recognitionResult = await callAliyunNLS({
            token: tokenResult.token,
            audioData: audioData, // 直接传递数组
            appKey: appKey,
            format: format,
            sampleRate: sampleRate
        });

        console.log('语音识别成功，识别结果:', recognitionResult.text);
        return res.json({
            success: true,
            data: {
                text: recognitionResult.text,
                tokenExpireTime: tokenResult.expireTime
            }
        });

    } catch (error) {
        console.error('API处理错误:', error);
        return res.status(500).json({
            success: false,
            error: error.message || '服务器内部错误'
        });
    }
}