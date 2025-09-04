// 阿里云Token获取API - 基于stable版本迁移
const { RPCClient } = require('@alicloud/pop-core');

// 获取Token的函数
async function getAliyunToken(appKey, accessKeyId, accessKeySecret) {
    const client = new RPCClient({
        accessKeyId: accessKeyId,
        accessKeySecret: accessKeySecret,
        endpoint: 'https://nls-meta.cn-shanghai.aliyuncs.com',
        apiVersion: '2019-02-28'
    });

    try {
        const result = await client.request('CreateToken', {}, {
            method: 'POST'
        });

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
 * Vercel Function 主函数
 */
export default async function handler(req, res) {
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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
        const { appKey, accessKeyId, accessKeySecret } = req.body;

        // 验证必需参数
        if (!appKey || !accessKeyId || !accessKeySecret) {
            return res.status(400).json({
                success: false,
                error: '缺少必需参数: appKey, accessKeyId, accessKeySecret'
            });
        }

        console.log('正在获取阿里云访问令牌...');
        const result = await getAliyunToken(appKey, accessKeyId, accessKeySecret);
        
        if (result.success) {
            console.log('Token获取成功');
        } else {
            console.error('Token获取失败:', result.error);
        }

        return res.json(result);
        
    } catch (error) {
        console.error('获取Token时发生错误:', error);
        return res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
}
