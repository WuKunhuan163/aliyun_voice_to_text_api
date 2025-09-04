// 阿里云语音识别API - 统一接口（向后兼容）
// 这个接口内部调用分离的get-token和recognize-audio API

/**
 * 获取阿里云Token
 */
async function getToken(appKey, accessKeyId, accessKeySecret) {
    try {
        // 构建内部API URL
        const baseUrl = process.env.VERCEL_URL ? 
            `https://${process.env.VERCEL_URL}` : 
            'http://localhost:3000';
        
        const response = await fetch(`${baseUrl}/api/get-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                appKey,
                accessKeyId,
                accessKeySecret
            })
        });

        if (!response.ok) {
            throw new Error(`Token API错误: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('获取Token失败:', error);
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
        // 构建内部API URL
        const baseUrl = process.env.VERCEL_URL ? 
            `https://${process.env.VERCEL_URL}` : 
            'http://localhost:3000';
        
        const response = await fetch(`${baseUrl}/api/recognize-audio`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                audioData,
                appKey,
                token,
                format,
                sampleRate
            })
        });

        if (!response.ok) {
            throw new Error(`语音识别API错误: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('语音识别失败:', error);
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
        const tokenResult = await getToken(appKey, accessKeyId, accessKeySecret);
        
        if (!tokenResult.success) {
            return res.status(401).json({
                success: false,
                error: `获取访问令牌失败: ${tokenResult.error}`
            });
        }

        console.log('访问令牌获取成功，开始语音识别...');
        console.log(`音频数据大小: ${audioData.length} 字符 (base64)`);
        
        // 执行语音识别
        const recognitionResult = await recognizeAudio(
            audioData,
            appKey, 
            tokenResult.token,
            format,
            sampleRate
        );

        if (recognitionResult.success) {
            console.log('语音识别成功');
            return res.json({
                success: true,
                data: {
                    text: recognitionResult.result,
                    confidence: 0.95, // 阿里云不返回置信度，使用固定值
                    duration: maxDuration,
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
