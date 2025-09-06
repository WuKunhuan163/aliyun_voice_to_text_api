// 阿里云语音识别API - 基于local_server的正确实现
const { RPCClient } = require('@alicloud/pop-core');

/**
 * 获取阿里云Token - 基于local_server的实现
 */
async function getAliyunToken(accessKeyId, accessKeySecret) {
    try {
        console.log('🔑 创建阿里云客户端...');
        console.log('   AccessKey ID:', accessKeyId ? accessKeyId.substring(0, 8) + '...' : 'undefined');
        
        // 使用HTTPS端点 - 与local_server版本一致
        const client = new RPCClient({
            accessKeyId: accessKeyId,
            accessKeySecret: accessKeySecret,
            endpoint: 'https://nls-meta.cn-shanghai.aliyuncs.com', // HTTPS，与local_server一致
            apiVersion: '2019-02-28'
        });
        
        console.log('🔄 调用CreateToken API...');
        
        // 与local_server版本一致的调用方式
        const result = await client.request('CreateToken', {}, {
            method: 'POST'
        });
        
        console.log('✅ Token获取成功:');
        console.log('   Token ID:', result.Token.Id ? result.Token.Id.substring(0, 16) + '...' : 'undefined');
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
        
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 调用阿里云NLS语音识别API - 完全基于local_server的实现
 */
async function callAliyunNLS(requestData) {
    const { token, audioData, format = 'pcm', sampleRate = 16000, appKey } = requestData;
    
    try {
        console.log('🎤 音频数据长度:', audioData ? audioData.length : 'undefined');
        console.log('🔍 音频数据类型:', typeof audioData);
        console.log('🔍 音频数据是否为数组:', Array.isArray(audioData));
        console.log('🔍 音频数据前5个元素:', audioData ? audioData.slice(0, 5) : 'undefined');
        console.log('🔑 使用Token:', token ? token.substring(0, 16) + '...' : 'undefined');
        console.log('🔐 使用AppKey:', appKey || 'undefined');
        
        // 构建请求URL - 与local_server版本完全相同
        const nlsUrl = 'https://nls-gateway.cn-shanghai.aliyuncs.com/stream/v1/asr';
        
        // 构建请求参数 - 与local_server版本完全相同
        const params = new URLSearchParams({
            appkey: appKey,
            token: token,
            format: format,
            sample_rate: sampleRate.toString(),
            enable_punctuation_prediction: 'true',
            enable_inverse_text_normalization: 'true'
        });
        
        const requestUrl = `${nlsUrl}?${params}`;
        
        console.log('🔗 调用阿里云NLS API:', requestUrl ? requestUrl.substring(0, 100) + '...' : 'undefined');
        
        // 将音频数据转换为Buffer - 与local_server版本完全相同
        const audioBuffer = Buffer.from(audioData);
        
        console.log('📊 发送音频数据大小:', audioBuffer.length, 'bytes');
        
        // 发送POST请求到阿里云NLS API - 与local_server版本完全相同
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
        
        // 解析响应 - 与local_server版本完全相同
        const result = JSON.parse(responseText);
        console.log('🔍 解析后的结果对象:', JSON.stringify(result, null, 2));
        
        if (result.status === 20000000) {
            // 识别成功 - 与local_server版本完全相同
            console.log('✅ 识别成功，result字段值:', result.result);
            console.log('🔍 所有可能的文本字段:', {
                result: result.result,
                text: result.text,
                transcript: result.transcript,
                content: result.content
            });
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
        
        throw error;
    }
}

/**
 * Vercel Function 主函数 - 基于local_server的实现
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
        console.log(`❌ 不支持的请求方法: ${req.method}`);
        return res.status(405).json({ 
            success: false, 
            error: '只支持POST请求' 
        });
    }

    console.log('🔍 收到语音识别请求 - 使用最新的recognize.js v2.0');
    console.log('收到语音识别请求:', {
        method: req.method,
        body: req.body ? Object.keys(req.body) : 'no body',
        contentType: req.headers['content-type']
    });

    try {
        const { 
            audioData, 
            appKey, 
            accessKeyId, 
            accessKeySecret,
            token, // 支持直接传入token
            format = 'pcm',
            sampleRate = 16000
        } = req.body;

        console.log('参数检查:', {
            hasAudioData: !!audioData,
            hasAppKey: !!appKey,
            hasToken: !!token,
            hasAccessKeyId: !!accessKeyId,
            hasAccessKeySecret: !!accessKeySecret,
            format: format,
            sampleRate: sampleRate
        });

        // 验证必需参数
        if (!audioData) {
            console.log('❌ 缺少音频数据');
            return res.status(400).json({
                success: false,
                error: '缺少音频数据'
            });
        }

        if (!appKey) {
            console.log('❌ 缺少AppKey');
            return res.status(400).json({
                success: false,
                error: '缺少AppKey'
            });
        }

        // 检查音频数据格式 - audioData应该是数组格式
        if (!Array.isArray(audioData)) {
            console.log(`❌ 音频数据格式错误: ${typeof audioData}, 期望: array`);
            return res.status(400).json({
                success: false,
                error: `音频数据格式错误，收到: ${typeof audioData}，期望: array`
            });
        }

        console.log(`✅ 音频数据验证通过: ${audioData.length} bytes (数组)`);
        console.log('🎤 音频数据长度:', audioData.length);
        console.log('🔍 详细音频数据信息:');
        console.log('   类型:', typeof audioData);
        console.log('   是否为数组:', Array.isArray(audioData));
        console.log('   前10个元素:', audioData.slice(0, 10));
        console.log('   构造函数:', audioData.constructor.name);
        
        let finalToken = token;
        
        // 如果没有直接传入token，则需要获取token
        if (!finalToken) {
            if (!accessKeyId || !accessKeySecret) {
                console.log('❌ 缺少Token或AccessKey信息');
                return res.status(400).json({
                    success: false,
                    error: '缺少Token或AccessKey信息'
                });
            }
            
            console.log('🔄 正在获取阿里云访问令牌...');
            const tokenResult = await getAliyunToken(accessKeyId, accessKeySecret);
            
            if (!tokenResult.success) {
                console.log(`❌ Token获取失败: ${tokenResult.error}`);
                return res.status(401).json({
                    success: false,
                    error: `获取访问令牌失败: ${tokenResult.error}`
                });
            }
            
            finalToken = tokenResult.token;
            console.log('✅ 访问令牌获取成功');
        }

        console.log('🔑 使用Token:', finalToken ? finalToken.substring(0, 16) + '...' : 'undefined');
        
        // 调用语音识别 - 与local_server版本完全相同的参数
        const recognitionResult = await callAliyunNLS({
            token: finalToken,
            audioData: audioData,
            format: format,
            sampleRate: sampleRate,
            appKey: appKey
        });

        console.log('✅ 识别结果:', recognitionResult.result);
        
        // 返回格式与local_server版本一致
        return res.json(recognitionResult);

    } catch (error) {
        console.error('❌ API处理错误:', error);
        console.error('   错误堆栈:', error.stack);
        
        return res.status(500).json({
            success: false,
            error: error.message || '服务器内部错误'
        });
    }
}