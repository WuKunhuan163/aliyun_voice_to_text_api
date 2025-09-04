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
 * 语音识别函数 - 按照原来成功的方式实现
 */
async function recognizeAudio(audioData, appKey, token, maxDuration = 60) {
  try {
    console.log(`🎤 开始语音识别，音频数据长度: ${audioData.length}`);
    console.log(`🔑 使用Token: ${token.substring(0, 16)}...`);
    console.log(`🔐 使用AppKey: ${appKey}`);
    
    // 使用原来成功的阿里云NLS API端点
    const nlsUrl = 'https://nls-gateway.cn-shanghai.aliyuncs.com/stream/v1/asr';
    
    // 构建请求参数（按照原来成功的方式）
    const params = new URLSearchParams({
      appkey: appKey,
      token: token,
      format: 'pcm',
      sample_rate: '16000',
      enable_punctuation_prediction: 'true',
      enable_inverse_text_normalization: 'true'
    });
    
    const requestUrl = `${nlsUrl}?${params}`;
    console.log('🔗 调用阿里云NLS API:', requestUrl.substring(0, 100) + '...');
    
    // 将base64音频数据转换为Buffer（audioData是base64字符串）
    const audioBuffer = Buffer.from(audioData, 'base64');
    console.log('📊 发送音频数据大小:', audioBuffer.length, 'bytes');
    
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
      console.log('✅ 识别结果:', result.result);
      return {
        success: true,
        text: result.result,
        confidence: 0.9,
        duration: Math.min(audioBuffer.length / 16000, maxDuration)
      };
    } else {
      // 识别失败，友好错误处理
      console.error('❌ 阿里云识别失败:', result);
      
      let friendlyError = result.message || '未知错误';
      
      if (result.status === 40000010 || friendlyError.includes('FREE_TRIAL_EXPIRED')) {
        friendlyError = '免费试用已过期，请检查阿里云控制台的试用状态或升级到付费版本';
      } else if (result.status === 40000001) {
        friendlyError = 'AppKey无效，请检查应用密钥配置';
      } else if (result.status === 40000002) {
        friendlyError = '访问令牌无效，请重新验证AccessKey配置';
      } else if (result.status === 40000011) {
        friendlyError = '音频格式不支持，请检查录音设置';
      }
      
      return {
        success: false,
        error: friendlyError
      };
    }
    
  } catch (error) {
    console.error('❌ 调用阿里云NLS失败:', error);
    
    // 如果是网络错误，返回更详细的信息
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return {
        success: false,
        error: '网络连接失败，请检查网络'
      };
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

    // 添加音频数据大小检查
    if (audioData.length > 10 * 1024 * 1024) { // 10MB限制
      return res.status(413).json({
        success: false,
        error: '音频文件过大，请录制较短的音频'
      });
    }
    
    console.log(`音频数据大小: ${audioData.length} 字符 (base64)`);
    
    // 执行语音识别（按照原来成功的方式传递参数）
    const recognitionResult = await recognizeAudio(
      audioData, // 直接传递base64数据，让recognizeAudio函数内部处理
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
