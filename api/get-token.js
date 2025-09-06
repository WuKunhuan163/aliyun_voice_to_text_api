// 阿里云Token获取API - 独立端点，语义明确
const { RPCClient } = require('@alicloud/pop-core');

/**
 * 获取阿里云Token
 */
async function getAliyunToken(accessKeyId, accessKeySecret) {
    try {
        console.log('🔑 创建阿里云客户端...');
        console.log('   AccessKey ID:', accessKeyId ? accessKeyId.substring(0, 8) + '...' : 'undefined');
        
        // 使用HTTPS端点
        const client = new RPCClient({
            accessKeyId: accessKeyId,
            accessKeySecret: accessKeySecret,
            endpoint: 'https://nls-meta.cn-shanghai.aliyuncs.com',
            apiVersion: '2019-02-28'
        });
        
        console.log('🔄 调用CreateToken API...');
        
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
 * Vercel Function - 获取Token端点
 */
export default async function handler(req, res) {
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
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

    console.log('🔍 收到Token获取请求');
    console.log('请求详情:', {
        method: req.method,
        body: req.body ? Object.keys(req.body) : 'no body',
        contentType: req.headers['content-type']
    });

    try {
        const { appKey, accessKeyId, accessKeySecret } = req.body;

        console.log('参数检查:', {
            hasAppKey: !!appKey,
            hasAccessKeyId: !!accessKeyId,
            hasAccessKeySecret: !!accessKeySecret
        });

        // 验证必需参数
        if (!appKey) {
            console.log('❌ 缺少AppKey');
            return res.status(400).json({
                success: false,
                error: '缺少AppKey'
            });
        }

        if (!accessKeyId) {
            console.log('❌ 缺少AccessKeyId');
            return res.status(400).json({
                success: false,
                error: '缺少AccessKeyId'
            });
        }

        if (!accessKeySecret) {
            console.log('❌ 缺少AccessKeySecret');
            return res.status(400).json({
                success: false,
                error: '缺少AccessKeySecret'
            });
        }

        console.log('🔐 AppKey:', appKey || 'undefined');
        console.log('🔑 AccessKeyId:', accessKeyId ? accessKeyId.substring(0, 8) + '...' : 'undefined');
        
        // 获取Token
        console.log('🔄 正在获取阿里云访问令牌...');
        const tokenResult = await getAliyunToken(accessKeyId, accessKeySecret);
        
        if (!tokenResult.success) {
            console.log(`❌ Token获取失败: ${tokenResult.error}`);
            return res.status(401).json({
                success: false,
                error: `获取访问令牌失败: ${tokenResult.error}`
            });
        }
        
        console.log('✅ Token获取成功，返回给前端');
        return res.json({
            success: true,
            token: tokenResult.token,
            expireTime: tokenResult.expireTime
        });

    } catch (error) {
        console.error('❌ Token API处理错误:', error);
        console.error('   错误堆栈:', error.stack);
        
        return res.status(500).json({
            success: false,
            error: error.message || '服务器内部错误'
        });
    }
}
