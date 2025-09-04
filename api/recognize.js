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
  const timestamp = new Date().toISOString();
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
  const signature = generateSignature(accessKeySecret, stringToSign);
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
 * 语音识别函数
 */
async function recognizeAudio(audioBuffer, appKey, token, maxDuration = 60) {
  try {
    // 这里实现实际的语音识别逻辑
    // 由于阿里云语音识别需要WebSocket连接，这里提供一个简化版本
    
    // 模拟语音识别结果（实际应用中需要连接阿里云实时语音识别服务）
    const mockResult = {
      success: true,
      text: "这是模拟的语音识别结果，实际部署时需要连接阿里云实时语音识别服务",
      confidence: 0.95,
      duration: Math.min(audioBuffer.length / 16000, maxDuration) // 假设16kHz采样率
    };

    return mockResult;
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

    // 将base64音频数据转换为Buffer
    const audioBuffer = Buffer.from(audioData, 'base64');
    
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
