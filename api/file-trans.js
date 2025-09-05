// 基于用户提供的阿里云文件转录API示例
const Client = require('@alicloud/nls-filetrans-2018-08-17');

/**
 * 阿里云文件转录API - 基于用户提供的示例代码
 */
async function fileTrans(akID, akSecret, appKey, fileLink) {
    console.log('🚀 开始文件转录任务');
    console.log(`   AccessKeyId: ${akID.substring(0, 8)}...`);
    console.log(`   AppKey: ${appKey}`);
    console.log(`   FileLink: ${fileLink}`);
    
    // 地域ID，固定值
    const ENDPOINT = 'http://filetrans.cn-shanghai.aliyuncs.com';
    const API_VERSION = '2018-08-17';
    
    /**
     * 创建阿里云鉴权client
     */
    const client = new Client({
        accessKeyId: akID,
        secretAccessKey: akSecret,
        endpoint: ENDPOINT,
        apiVersion: API_VERSION
    });
    
    console.log('✅ 阿里云客户端创建成功');
    console.log(`   Endpoint: ${ENDPOINT}`);
    console.log(`   API Version: ${API_VERSION}`);
    
    /**
     * 提交录音文件识别请求，请求参数组合成JSON格式的字符串作为task的值。
     */
    const task = {
        appkey: appKey,
        file_link: fileLink,
        version: "4.0", // 新接入请使用4.0版本
        enable_words: false // 设置是否输出词信息，默认值为false
    };
    
    const taskString = JSON.stringify(task);
    console.log('📋 任务参数:', taskString);
    
    const taskParams = {
        Task: taskString
    };
    
    const options = {
        method: 'POST'
    };
    
    try {
        console.log('📤 提交录音文件识别请求...');
        
        // 提交录音文件识别请求，处理服务端返回的响应
        const response = await client.submitTask(taskParams, options);
        
        console.log('📡 提交任务响应:', JSON.stringify(response, null, 2));
        
        // 服务端响应信息的状态描述StatusText
        const statusText = response.StatusText;
        if (statusText !== 'SUCCESS') {
            console.log('❌ 录音文件识别请求响应失败!');
            throw new Error(`任务提交失败: ${statusText}`);
        }
        
        console.log('✅ 录音文件识别请求响应成功!');
        
        // 获取录音文件识别请求任务的TaskId，以供识别结果查询使用
        const taskId = response.TaskId;
        console.log(`🆔 TaskId: ${taskId}`);
        
        /**
         * 以TaskId为查询参数，提交识别结果查询请求。
         * 以轮询的方式进行识别结果的查询，直到服务端返回的状态描述为"SUCCESS"、"SUCCESS_WITH_NO_VALID_FRAGMENT"，
         * 或者为错误描述，则结束轮询。
         */
        const taskIdParams = {
            TaskId: taskId
        };
        
        console.log('🔄 开始轮询识别结果...');
        
        return new Promise((resolve, reject) => {
            let pollCount = 0;
            const maxPolls = 30; // 最多轮询30次，避免无限轮询
            
            const timer = setInterval(async () => {
                pollCount++;
                console.log(`🔍 第 ${pollCount} 次轮询 (最多 ${maxPolls} 次)`);
                
                try {
                    const resultResponse = await client.getTaskResult(taskIdParams);
                    
                    console.log('📊 识别结果查询响应:');
                    console.log(JSON.stringify(resultResponse, null, 2));
                    
                    const resultStatusText = resultResponse.StatusText;
                    console.log(`📋 当前状态: ${resultStatusText}`);
                    
                    if (resultStatusText === 'RUNNING' || resultStatusText === 'QUEUEING') {
                        console.log('⏳ 继续轮询...');
                        // 继续轮询，注意间隔周期
                    } else {
                        // 结束轮询
                        clearInterval(timer);
                        
                        if (resultStatusText === 'SUCCESS' || resultStatusText === 'SUCCESS_WITH_NO_VALID_FRAGMENT') {
                            console.log('✅ 录音文件识别成功!');
                            
                            const sentences = resultResponse.Result;
                            console.log('📄 识别结果:');
                            console.log(JSON.stringify(sentences, null, 2));
                            
                            resolve({
                                success: true,
                                taskId: taskId,
                                status: resultStatusText,
                                result: sentences,
                                fullResponse: resultResponse
                            });
                        } else {
                            console.log('❌ 录音文件识别失败!');
                            console.log(`   错误状态: ${resultStatusText}`);
                            
                            reject(new Error(`识别失败: ${resultStatusText}`));
                        }
                    }
                    
                    // 检查是否超过最大轮询次数
                    if (pollCount >= maxPolls) {
                        clearInterval(timer);
                        reject(new Error(`轮询超时: 已轮询 ${maxPolls} 次，任务可能处理时间过长`));
                    }
                    
                } catch (error) {
                    console.error('❌ 轮询过程中发生错误:', error);
                    clearInterval(timer);
                    reject(error);
                }
            }, 10000); // 每10秒轮询一次
        });
        
    } catch (error) {
        console.error('❌ 文件转录失败:', error);
        throw error;
    }
}

/**
 * Vercel Function 主函数 - 文件转录API
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

    console.log('🔍 收到文件转录请求');
    console.log('📋 请求头:', JSON.stringify(req.headers, null, 2));

    try {
        const { 
            accessKeyId, 
            accessKeySecret, 
            appKey, 
            fileLink 
        } = req.body;

        console.log('🔍 解析参数:');
        console.log(`   accessKeyId: ${accessKeyId ? accessKeyId.substring(0, 8) + '...' : 'undefined'}`);
        console.log(`   accessKeySecret: ${accessKeySecret ? accessKeySecret.substring(0, 8) + '...' : 'undefined'}`);
        console.log(`   appKey: ${appKey ? appKey.substring(0, 10) + '...' : 'undefined'}`);
        console.log(`   fileLink: ${fileLink || 'undefined'}`);

        // 验证必需参数
        if (!accessKeyId || !accessKeySecret || !appKey || !fileLink) {
            console.log('❌ 缺少必需参数');
            return res.status(400).json({
                success: false,
                error: '缺少必需参数: accessKeyId, accessKeySecret, appKey, fileLink'
            });
        }

        console.log('✅ 参数验证通过，开始文件转录...');

        // 调用文件转录函数
        const result = await fileTrans(accessKeyId, accessKeySecret, appKey, fileLink);

        console.log('✅ 文件转录成功完成');
        return res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('❌ 文件转录API处理错误:', error);
        console.error('   错误堆栈:', error.stack);
        
        let errorMessage = error.message || '服务器内部错误';
        let statusCode = 500;
        
        // 根据错误类型设置更具体的错误信息
        if (error.message.includes('InvalidAccessKeyId')) {
            errorMessage = 'AccessKey ID 不存在，请检查是否正确';
            statusCode = 401;
        } else if (error.message.includes('SignatureDoesNotMatch')) {
            errorMessage = 'AccessKey Secret 不正确，请检查是否正确';
            statusCode = 401;
        } else if (error.message.includes('Forbidden')) {
            errorMessage = '权限不足，请检查AccessKey权限设置';
            statusCode = 403;
        } else if (error.message.includes('APPKEY_NOT_EXIST')) {
            errorMessage = 'AppKey不存在，请检查AppKey是否正确';
            statusCode = 400;
        } else if (error.message.includes('轮询超时')) {
            errorMessage = '识别任务处理超时，请稍后重试';
            statusCode = 408;
        }
        
        return res.status(statusCode).json({
            success: false,
            error: errorMessage,
            originalError: error.message
        });
    }
}
