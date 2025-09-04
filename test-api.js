/**
 * API测试脚本
 * 用于测试Vercel部署的语音识别API
 */

const testAPI = async (baseUrl) => {
  console.log('🧪 开始测试API...');
  console.log(`📡 API地址: ${baseUrl}/api/recognize`);
  
  // 模拟测试数据
  const testData = {
    audioData: "UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmUeCy9+zPLNfC8H", // 示例WAV文件的base64数据
    appKey: "test_app_key",
    accessKeyId: "test_access_key_id", 
    accessKeySecret: "test_access_key_secret",
    maxDuration: 60
  };

  try {
    const response = await fetch(`${baseUrl}/api/recognize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    console.log(`📊 响应状态: ${response.status}`);
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ API调用成功!');
      console.log('📝 识别结果:', result.data);
    } else {
      console.log('❌ API调用失败:', result.error);
    }
    
    return result;
    
  } catch (error) {
    console.error('🚨 请求失败:', error.message);
    return { success: false, error: error.message };
  }
};

// 测试CORS预检请求
const testCORS = async (baseUrl) => {
  console.log('🔍 测试CORS配置...');
  
  try {
    const response = await fetch(`${baseUrl}/api/recognize`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://your-github-pages-site.github.io',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    
    console.log(`📊 CORS预检状态: ${response.status}`);
    
    if (response.status === 200) {
      console.log('✅ CORS配置正常');
    } else {
      console.log('❌ CORS配置可能有问题');
    }
    
  } catch (error) {
    console.error('🚨 CORS测试失败:', error.message);
  }
};

// 主测试函数
const runTests = async () => {
  // 替换为你的实际Vercel部署URL
  const baseUrl = process.argv[2] || 'http://localhost:3000';
  
  console.log('🚀 开始API测试套件');
  console.log('=' .repeat(50));
  
  // 测试CORS
  await testCORS(baseUrl);
  console.log('');
  
  // 测试API功能
  await testAPI(baseUrl);
  
  console.log('=' .repeat(50));
  console.log('✨ 测试完成');
};

// 如果直接运行此脚本
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testAPI, testCORS };
