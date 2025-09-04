const crypto = require('crypto');
const querystring = require('querystring');

// 阿里云语音识别API配置
const ALIYUN_CONFIG = {
  endpoint: 'https://nls-meta.cn-shanghai.aliyuncs.com',
  version: '2019-02-28',
  action: 'CreateToken'
};

/**
 * 生成阿里云API签名
 */
function generateSignature(accessKeySecret, stringToSign) {
  return crypto
    .createHmac('sha1', accessKeySecret)
    .update(stringToSign)
    .digest('base64');
}

/**
 * 创建阿里云API请求参数
 */
function createRequestParams(accessKeyId, accessKeySecret) {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const nonce = crypto.randomBytes(16).toString('hex');
  
  const params = {
    'AccessKeyId': accessKeyId,
    'Action': ALIYUN_CONFIG.action,
    'Format': 'JSON',
    'RegionId': 'cn-shanghai',
    'SignatureMethod': 'HMAC-SHA1',
    'SignatureNonce': nonce,
    'SignatureVersion': '1.0',
    'Timestamp': timestamp,
    'Version': ALIYUN_CONFIG.version
  };

  // 按字典序排序参数
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((result, key) => {
      result[key] = params[key];
      return result;
    }, {});

  // 构造待签名字符串
  const canonicalizedQueryString = querystring.stringify(sortedParams);
  const stringToSign = `POST&${encodeURIComponent('/')}&${encodeURIComponent(canonicalizedQueryString)}`;
  
  // 生成签名
  const signature = generateSignature(accessKeySecret + '&', stringToSign);
  sortedParams['Signature'] = signature;

  return sortedParams;
}

/**
 * 获取阿里云访问令牌
 */
async function getAliyunToken(accessKeyId, accessKeySecret) {
  try {
    const params = createRequestParams(accessKeyId, accessKeySecret);
    const postData = querystring.stringify(params);

    const response = await fetch(ALIYUN_CONFIG.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      },
      body: postData
    });

    const result = await response.json();
    
    if (result.Token) {
      return {
        success: true,
        token: result.Token.Id,
        expireTime: result.Token.ExpireTime
      };
    } else {
      throw new Error(result.Message || '获取令牌失败');
    }
  } catch (error) {
    console.error('获取阿里云令牌失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 语音识别函数 - 使用阿里云实时语音识别API
 */
async function recognizeAudio(audioBuffer, appKey, token, maxDuration = 60) {
  try {
    console.log(`开始实时语音识别，音频大小: ${audioBuffer.length} bytes`);
    
    // 阿里云实时语音识别API端点
    const recognitionUrl = 'https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/FlashRecognizer';
    
    // 构建请求参数
    const params = new URLSearchParams({
      appkey: appKey,
      token: token,
      format: 'pcm', // 实时识别通常使用PCM格式
      sample_rate: '16000',
      enable_punctuation_prediction: 'true',
      enable_inverse_text_normalization: 'true',
      enable_voice_detection: 'false', // 关闭静音检测，处理完整音频
      max_end_silence: '800', // 最大结束静音时间
      max_start_silence: '10000' // 最大开始静音时间
    });
    
    console.log('发送实时语音识别请求到阿里云...');
    
    // 发送POST请求到阿里云实时语音识别API
    const response = await fetch(`${recognitionUrl}?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': audioBuffer.length.toString()
      },
      body: audioBuffer
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('阿里云实时识别API响应错误:', response.status, errorText);
      throw new Error(`阿里云实时识别API调用失败: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    console.log('阿里云实时识别API响应:', result);
    
    // 处理阿里云实时识别API响应
    if (result.flash_result && result.flash_result.sentences) {
      // 合并所有句子的识别结果
      const sentences = result.flash_result.sentences;
      const fullText = sentences.map(sentence => sentence.text).join('');
      const avgConfidence = sentences.reduce((sum, sentence) => sum + (sentence.confidence || 0), 0) / sentences.length;
      
      console.log(`实时识别成功，识别出 ${sentences.length} 个句子`);
      
      return {
        success: true,
        text: fullText || '识别结果为空',
        confidence: avgConfidence || 0.9,
        duration: Math.min(audioBuffer.length / 16000, maxDuration),
        sentences: sentences.length
      };
    } else if (result.status === 20000000) {
      // 兼容一句话识别格式
      return {
        success: true,
        text: result.result || '识别结果为空',
        confidence: result.confidence || 0.9,
        duration: Math.min(audioBuffer.length / 16000, maxDuration)
      };
    } else {
      console.error('实时语音识别失败:', result);
      return {
        success: false,
        error: result.message || `实时识别失败，状态码: ${result.status}`
      };
    }
    
  } catch (error) {
    console.error('实时语音识别异常:', error);
    return {
      success: false,
      error: `实时语音识别异常: ${error.message}`
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
      maxDuration = 60 
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

    // 将base64音频数据转换为Buffer，添加大小检查
    if (audioData.length > 10 * 1024 * 1024) { // 10MB限制
      return res.status(413).json({
        success: false,
        error: '音频文件过大，请录制较短的音频'
      });
    }
    
    let audioBuffer;
    try {
      audioBuffer = Buffer.from(audioData, 'base64');
      console.log(`音频Buffer创建成功，大小: ${audioBuffer.length} bytes`);
    } catch (bufferError) {
      console.error('Buffer创建失败:', bufferError);
      return res.status(400).json({
        success: false,
        error: '音频数据格式错误'
      });
    }
    
    // 执行语音识别
    const recognitionResult = await recognizeAudio(
      audioBuffer, 
      appKey, 
      tokenResult.token, 
      maxDuration
    );

    if (recognitionResult.success) {
      console.log('语音识别成功');
      return res.status(200).json({
        success: true,
        data: {
          text: recognitionResult.text,
          confidence: recognitionResult.confidence,
          duration: recognitionResult.duration,
          tokenExpireTime: tokenResult.expireTime
        }
      });
    } else {
      return res.status(500).json({
        success: false,
        error: `语音识别失败: ${recognitionResult.error}`
      });
    }

  } catch (error) {
    console.error('API处理错误:', error);
    return res.status(500).json({
      success: false,
      error: `服务器内部错误: ${error.message}`
    });
  }
}
