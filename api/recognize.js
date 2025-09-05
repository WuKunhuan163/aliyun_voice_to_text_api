// 阿里云语音识别API - 统一接口（向后兼容）
const { RPCClient } = require('@alicloud/pop-core');

/**
 * 获取阿里云Token
 */
async function getAliyunToken(appKey, accessKeyId, accessKeySecret) {
    const client = new RPCClient({
        accessKeyId: accessKeyId,
        accessKeySecret: accessKeySecret,
        endpoint: 'http://nls-meta.cn-shanghai.aliyuncs.com',
        apiVersion: '2019-02-28'
    });

    try {
        const result = await client.request('CreateToken');

        if (result && result.Token && result.Token.Id) {
            return {
                success: true,
                token: result.Token.Id,
                expireTime: result.Token.ExpireTime
            };
        } else {
            return {
                success: false,
                error: 'Token获取失败'
            };
        }
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 执行语音识别
 */
async function recognizeAudio(audioData, appKey, token, format = 'pcm', sampleRate = 16000) {
    try {
        // 构建请求URL
        const nlsUrl = 'https://nls-gateway.cn-shanghai.aliyuncs.com/stream/v1/asr';
        
        // 构建请求参数
        const params = new URLSearchParams({
            appkey: appKey,
            token: token,
            format: format,
            sample_rate: sampleRate.toString(),
            enable_punctuation_prediction: 'true',
            enable_inverse_text_normalization: 'true'
        });
        
        const requestUrl = `${nlsUrl}?${params}`;
        
        console.log('🔗 调用阿里云NLS API:', requestUrl.substring(0, 100) + '...');
        
        // 将音频数据转换为Buffer
        let audioBuffer;
        if (typeof audioData === 'string') {
            // 如果是base64字符串格式
            audioBuffer = Buffer.from(audioData, 'base64');
        } else {
            throw new Error('不支持的音频数据格式');
        }
        
        console.log('📊 发送音频数据大小:', audioBuffer.length, 'bytes');
        console.log('📊 音频Buffer前20字节:', Array.from(audioBuffer.slice(0, 20)));
        
        // 发送POST请求到阿里云NLS API
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
        
        // 解析响应
        const result = JSON.parse(responseText);
        
        if (result.status === 20000000) {
            // 识别成功
            console.log('✅ 识别成功，result字段值:', result.result);
            return {
                success: true,
                result: result.result || result.text || result.transcript || result.content || '',
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
            throw new Error('网络连接失败，请检查网络');
        }
        
        return {
            success: false,
            error: error.message
        };
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
            maxDuration = 60,
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

        // 添加音频数据大小检查
        if (audioData.length > 10 * 1024 * 1024) { // 10MB限制
            return res.status(413).json({
                success: false,
                error: '音频文件过大，请录制较短的音频'
            });
        }

        console.log('正在获取阿里云访问令牌...');
        const tokenResult = await getAliyunToken(appKey, accessKeyId, accessKeySecret);
        
        if (!tokenResult.success) {
            return res.status(401).json({
                success: false,
                error: `获取访问令牌失败: ${tokenResult.error}`
            });
        }

        console.log('访问令牌获取成功，开始语音识别...');
        console.log(`音频数据大小: ${audioData.length} 字符 (base64)`);
        console.log('音频数据前100个字符:', audioData.substring(0, 100));
        
        // 执行语音识别
        const recognitionResult = await recognizeAudio(
            audioData,
            appKey, 
            tokenResult.token,
            format,
            sampleRate
        );

        if (recognitionResult.success) {
            console.log('语音识别成功，识别结果:', recognitionResult.result);
            return res.json({
                success: true,
                data: {
                    text: recognitionResult.result,
                    tokenExpireTime: tokenResult.expireTime
                }
            });
        } else {
            console.error('语音识别失败:', recognitionResult.error);
            return res.status(500).json({
                success: false,
                error: recognitionResult.error
            });
        }

    } catch (error) {
        console.error('处理语音识别请求时发生错误:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
