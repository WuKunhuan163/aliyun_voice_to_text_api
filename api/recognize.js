// 阿里云语音识别API - 基于local_server的正确实现 (Updated)
const { RPCClient } = require('@alicloud/pop-core');

/**
 * 根据接收到的数据类型提供格式转换建议
 */
function getAudioFormatSuggestion(receivedType) {
    const suggestions = {
        'object': {
            message: '接收到对象类型，可能是Blob或其他对象',
            solution: '如果是Blob，请先转换为ArrayBuffer，然后转为Uint8Array数组',
            code: `
// 如果audioData是Blob
const arrayBuffer = await audioBlob.arrayBuffer();
const audioData = Array.from(new Uint8Array(arrayBuffer));

// 或者如果是其他格式，确保转换为数组
const audioData = Array.from(new Uint8Array(yourAudioBuffer));`
        },
        'string': {
            message: '接收到字符串类型，这通常不是有效的音频数据',
            solution: '音频数据应该是二进制数据，不能是字符串',
            code: '请确保传递的是音频的二进制数据，而不是Base64字符串或其他文本格式'
        },
        'undefined': {
            message: '音频数据未定义',
            solution: '请确保在请求体中包含audioData字段',
            code: '{ "audioData": [...], "appKey": "...", "token": "..." }'
        },
        'number': {
            message: '接收到单个数字，但需要数组',
            solution: '音频数据应该是数字数组，不是单个数字',
            code: 'const audioData = Array.from(new Uint8Array(audioBuffer));'
        }
    };

    return suggestions[receivedType] || {
        message: `未知的数据类型: ${receivedType}`,
        solution: '请确保音频数据是Uint8Array转换后的数组格式',
        code: 'const audioData = Array.from(new Uint8Array(audioBuffer));'
    };
}

/**
 * 调用阿里云NLS语音识别API - 完全基于local_server的实现
 */
async function callAliyunNLS(requestData) {
    console.log('🌐 [NLS] callAliyunNLS 函数开始执行');
    const { token, audioData, format = 'pcm', sampleRate = 16000, appKey } = requestData;
    
    try {
        console.log('🎤 [NLS] 音频数据长度:', audioData ? audioData.length : 'undefined');
        console.log('🔍 [NLS] 音频数据类型:', typeof audioData);
        console.log('🔍 [NLS] 音频数据是否为数组:', Array.isArray(audioData));
        console.log('🔍 [NLS] 音频数据前5个元素:', audioData ? audioData.slice(0, 5) : 'undefined');
        console.log('🔑 [NLS] 使用Token:', token ? token.substring(0, 16) + '...' : 'undefined');
        console.log('🔐 [NLS] 使用AppKey:', appKey || 'undefined');
        
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
        console.log('🔗 完整请求URL:', requestUrl);
        console.log('🔍 请求参数详情:');
        console.log('   appkey:', appKey);
        console.log('   token:', token ? token.substring(0, 16) + '...' : 'undefined');
        console.log('   format:', format);
        console.log('   sample_rate:', sampleRate);
        
        // 将音频数据转换为Buffer - 与local_server版本完全相同
        const audioBuffer = Buffer.from(audioData);
        
        console.log('📊 发送音频数据大小:', audioBuffer.length, 'bytes');
        console.log('📊 音频数据前10个字节:', audioBuffer.slice(0, 10));
        console.log('📊 音频数据最后10个字节:', audioBuffer.slice(-10));
        
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
        console.log('📄 响应文本长度:', responseText.length);
        console.log('📄 响应前100个字符:', responseText.substring(0, 100));
        
        // 解析响应 - 与local_server版本完全相同
        const result = JSON.parse(responseText);
        console.log('🔍 解析后的结果对象:', JSON.stringify(result, null, 2));
        console.log('🔍 结果状态码:', result.status);
        console.log('🔍 结果消息:', result.message || 'N/A');
        
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
                timestamp: Date.now(),
                version: "AUDIO_DEBUG_v7.1_UPDATED",
                aliyunApiResponse: {
                    status: result.status,
                    message: result.message || 'N/A',
                    hasResult: !!result.result,
                    resultLength: result.result ? result.result.length : 0,
                    allFields: Object.keys(result)
                }
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
        console.log('🚀 [ROUTE] 处理OPTIONS预检请求');
        res.status(200).end();
        return;
    }

    // 只允许POST请求
    if (req.method !== 'POST') {
        console.log(`❌ [ROUTE] 不支持的请求方法: ${req.method}`);
        return res.status(405).json({ 
            success: false, 
            error: '只支持POST请求' 
        });
    }

    console.log('🔍 [ROUTE] 收到语音识别请求 - 使用最新的recognize.js v3.0');
    console.log('📋 [ROUTE] 请求详情:', {
        method: req.method,
        body: req.body ? Object.keys(req.body) : 'no body',
        contentType: req.headers['content-type'],
        bodySize: req.body ? JSON.stringify(req.body).length : 0
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
            
            // 提供详细的格式转换建议
            const formatSuggestion = getAudioFormatSuggestion(typeof audioData);
            
            return res.status(400).json({
                success: false,
                error: `音频数据格式不正确`,
                details: {
                    received: typeof audioData,
                    expected: 'array',
                    description: '音频数据应该是Uint8Array转换后的数组格式'
                },
                suggestion: formatSuggestion,
                examples: {
                    webmToMp3: {
                        description: '如果您有WebM格式的录音，可以使用lamejs转换为MP3后再处理',
                        codeExample: `
// 1. 使用lamejs将WebM转换为MP3
// 首先引入lamejs库: <script src="https://cdn.jsdelivr.net/npm/lamejs@1.2.0/lame.min.js"></script>

// 2. 获取WebM录音的PCM数据
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const arrayBuffer = await webmBlob.arrayBuffer();
const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
const pcmData = audioBuffer.getChannelData(0); // Float32Array

// 3. 转换为正确格式
const buffer = new ArrayBuffer(pcmData.length * 4);
const view = new Float32Array(buffer);
view.set(pcmData);
const audioData = Array.from(new Uint8Array(buffer));

// 4. 发送到API
const response = await fetch('/api/recognize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        audioData: audioData,
        appKey: 'your-app-key',
        token: 'your-token',
        format: 'pcm',
        sampleRate: 16000
    })
});`
                    },
                    correctUsage: {
                        description: '正确的音频数据发送格式',
                        codeExample: `
// 正确的调用方式
const audioData = Array.from(new Uint8Array(audioBuffer)); // 必须是数组
const response = await fetch('https://aliyun-voice-to-text-api.vercel.app/api/recognize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        audioData: audioData,  // Array<number>
        appKey: 'your-app-key',
        token: 'your-token',
        format: 'pcm',
        sampleRate: 16000
    })
});`
                    }
                }
            });
        }

        // 验证音频数据不能为空
        if (audioData.length === 0) {
            console.log('❌ 音频数据为空');
            return res.status(400).json({
                success: false,
                error: '音频数据不能为空',
                details: {
                    received: 'empty array',
                    expected: 'non-empty array with audio data'
                },
                suggestions: {
                    checkRecording: '请确保录音功能正常工作，录制了有效的音频',
                    checkConversion: '检查音频数据转换过程是否正确',
                    minimumSize: '音频数据通常应该至少有几千字节'
                },
                endpoints: {
                    getToken: '/api/get-token - 获取阿里云访问令牌',
                    recognize: '/api/recognize - 语音识别（当前端点）'
                }
            });
        }

        console.log(`✅ 音频数据验证通过: ${audioData.length} bytes (数组)`);
        console.log('🎤 [ROUTE] 音频数据长度:', audioData.length);
        console.log('🔍 [ROUTE] 详细音频数据信息:');
        console.log('   类型:', typeof audioData);
        console.log('   是否为数组:', Array.isArray(audioData));
        console.log('   前10个元素:', audioData.slice(0, 10));
        console.log('   最后10个元素:', audioData.slice(-10));
        console.log('   构造函数:', audioData.constructor.name);
        console.log('   数据范围分析:');
        console.log('   - 最小值:', Math.min(...audioData.slice(0, 1000)));
        console.log('   - 最大值:', Math.max(...audioData.slice(0, 1000)));
        console.log('   - 非零元素数量:', audioData.slice(0, 1000).filter(x => x !== 0).length);
        
        // 检测音频数据格式
        const maxVal = Math.max(...audioData.slice(0, 1000));
        const minVal = Math.min(...audioData.slice(0, 1000));
        if (maxVal <= 255 && minVal >= 0) {
            console.log('🎵 [ROUTE] 音频格式分析: 8位无符号PCM (0-255)');
        } else if (maxVal <= 32767 && minVal >= -32768) {
            console.log('🎵 [ROUTE] 音频格式分析: 16位有符号PCM (-32768 to 32767)');
        } else {
            console.log('🎵 [ROUTE] 音频格式分析: 可能是Float32或其他格式');
        }
        
        console.log('🔑 [ROUTE] 开始处理Token逻辑');
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
            
            try {
                // 直接实现token获取，避免重复函数
                const client = new RPCClient({
                    accessKeyId: accessKeyId,
                    accessKeySecret: accessKeySecret,
                    endpoint: 'https://nls-meta.cn-shanghai.aliyuncs.com',
                    apiVersion: '2019-02-28'
                });
                
                const result = await client.request('CreateToken', {}, {
                    method: 'POST'
                });
                
                finalToken = result.Token.Id;
                console.log('✅ 访问令牌获取成功');
                
            } catch (error) {
                console.log(`❌ Token获取失败: ${error.message}`);
                return res.status(401).json({
                    success: false,
                    error: `获取访问令牌失败: ${error.message}`
                });
            }
        }

        console.log('🔑 [ROUTE] 使用Token:', finalToken ? finalToken.substring(0, 16) + '...' : 'undefined');
        
        console.log('🎯 [ROUTE] 开始调用阿里云NLS API');
        // 调用语音识别 - 与local_server版本完全相同的参数
        const recognitionResult = await callAliyunNLS({
            token: finalToken,
            audioData: audioData,
            format: format,
            sampleRate: sampleRate,
            appKey: appKey
        });

        // 在返回结果中添加调试信息
        recognitionResult.debugInfo = {
            receivedToken: !!finalToken,
            tokenLength: finalToken ? finalToken.length : 0,
            audioDataLength: audioData.length,
            audioDataType: typeof audioData,
            audioDataIsArray: Array.isArray(audioData),
            audioDataFirst10: audioData.slice(0, 10),
            audioDataLast10: audioData.slice(-10),
            audioDataMin: Math.min(...audioData.slice(0, 100)),
            audioDataMax: Math.max(...audioData.slice(0, 100)),
            appKey: appKey,
            format: format,
            sampleRate: sampleRate,
            executionPath: "callAliyunNLS_executed",
            requestUrl: `https://nls-gateway.cn-shanghai.aliyuncs.com/stream/v1/asr?appkey=${appKey}&token=${finalToken.substring(0,8)}...&format=${format}&sample_rate=${sampleRate}`
        };

        console.log('✅ [ROUTE] 识别结果:', recognitionResult.result);
        console.log('📤 [ROUTE] 返回结果给前端:', JSON.stringify(recognitionResult, null, 2));
        
        // 强制显示返回结果
        console.error('📤📤📤 [CRITICAL] 返回结果给前端:', JSON.stringify(recognitionResult, null, 2));
        
        // 强制添加测试字段确保部署生效
        recognitionResult.testField = "AUDIO_DEBUG_v7.1_UPDATED";
        recognitionResult.forceDebug = "v7.1更新：修复音频格式问题";
        recognitionResult.updateTimestamp = new Date().toISOString();
        
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