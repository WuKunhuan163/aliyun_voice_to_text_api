// 阿里云语音识别API测试页面主脚本

class VoiceRecognitionTester {
    constructor() {
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.recordingTimer = null;
        this.timeLeft = 30;
        this.audioContext = null;
        this.analyser = null;
        this.animationId = null;
        
        // 波峰图相关
        this.waveformData = [];
        this.maxWaveformBars = 300; // 30秒录音，每0.1秒一个峰值条
        this.waveformUpdateInterval = 100; // 每100ms更新一次峰值图
        this.currentAmplitude = 0;
        this.waveformTimer = null;
        this.recordingStartTime = 0;
        
        this.initElements();
        this.bindEvents();
    }

    initElements() {
        this.recordButton = document.getElementById('recordButton');
        this.downloadButton = document.getElementById('downloadButton');
        this.demoHtmlButton = document.getElementById('demoHtmlButton');
        this.transcriptionResult = document.getElementById('transcriptionResult');
        
        // 新的进度条和波形图元素 - 适配新的HTML结构
        this.transcriptionProgress = document.getElementById('transcriptionProgress');
        this.progressFill = document.getElementById('progressFill');
        this.waveformContainer = document.getElementById('waveformContainer');
        this.waveformSvg = document.getElementById('waveformSvg');
        this.waveformBars = document.getElementById('waveformBars');
        this.waveformProgressMask = document.getElementById('waveformProgressMask');
        
        // 配置输入框 - 使用正确的API地址
        this.apiUrl = { value: 'https://aliyun-voice-to-text-api.vercel.app/api/recognize' };
        this.appKey = document.getElementById('appKey');
        this.accessKeyId = document.getElementById('accessKeyId');
        this.accessKeySecret = document.getElementById('accessKeySecret');
        
        // Token相关元素
        this.tokenField = document.getElementById('tokenField');
        
        this.initMiniWaveform();
    }

    initMiniWaveform() {
        this.waveformData = [];
        this.audioData = [];
        this.recordingStartTime = null;
        
        // 清空SVG波形条
        this.waveformBars.innerHTML = '';
        
        // 初始化100个波形条（更多的条数以获得更精细的显示）
        for (let i = 0; i < 100; i++) {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', i * 10);
            rect.setAttribute('y', 15);
            rect.setAttribute('width', '8');
            rect.setAttribute('height', '0');
            rect.setAttribute('fill', '#667eea');
            rect.setAttribute('opacity', '0.7');
            this.waveformBars.appendChild(rect);
        }
        
        // 重置进度遮罩
        this.waveformProgressMask.setAttribute('width', '0');
    }

    bindEvents() {
        this.recordButton.addEventListener('click', () => {
            if (this.isRecording) {
                this.stopRecording();
            } else {
                this.startRecording();
            }
        });

        this.downloadButton.addEventListener('click', () => {
            this.downloadRecording();
        });

        this.demoHtmlButton.addEventListener('click', () => {
            this.generateDemoHtml();
        });

        // 监听密钥输入，自动获取Token
        this.accessKeyId.addEventListener('input', () => {
            this.checkAndGetToken();
            this.updateDynamicHints();
        });

        this.accessKeySecret.addEventListener('input', () => {
            this.checkAndGetToken();
            this.updateDynamicHints();
        });

        this.appKey.addEventListener('input', () => {
            this.checkAndGetToken();
            this.updateDynamicHints();
        });

        // 初始化动态提示
        this.updateDynamicHints();
    }


    updateDynamicHints() {
        const appKey = this.appKey.value.trim();
        const accessKeyId = this.accessKeyId.value.trim();
        const accessKeySecret = this.accessKeySecret.value.trim();

        // 简单的视觉反馈：已填写的字段显示绿色边框
        this.appKey.style.borderColor = appKey ? "#28a745" : "";
        this.accessKeyId.style.borderColor = accessKeyId ? "#28a745" : "";
        this.accessKeySecret.style.borderColor = accessKeySecret ? "#28a745" : "";

        // 在转录框中显示动态配置指导
        if (!appKey) {
            this.transcriptionResult.innerHTML = '步骤1: 请填写AppKey。前往<a href="https://nls-portal.console.aliyun.com/applist" target="_blank">阿里云NLS控制台</a>创建项目获取AppKey';
            this.transcriptionResult.className = "transcription-textarea";
        } else if (!accessKeyId) {
            this.transcriptionResult.innerHTML = '步骤2: 请填写AccessKey ID。前往<a href="https://ram.console.aliyun.com/users" target="_blank">RAM用户管理页面</a>创建AccessKey';
            this.transcriptionResult.className = "transcription-textarea";
        } else if (!accessKeySecret) {
            this.transcriptionResult.innerHTML = '步骤3: 请填写AccessKey Secret。在相同的<a href="https://ram.console.aliyun.com/users" target="_blank">RAM用户管理页面</a>创建AccessKey Secret';
            this.transcriptionResult.className = "transcription-textarea";
        } else if (!this.currentToken) {
            this.transcriptionResult.innerHTML = '正在获取Token，请稍候...';
            this.transcriptionResult.className = "transcription-textarea processing";
        } else {
            this.transcriptionResult.innerHTML = '配置完成！点击"开始录音"按钮开始语音识别';
            this.transcriptionResult.className = "transcription-textarea success";
        }
    }

    // 检查并自动获取Token
    async checkAndGetToken() {
        const appKey = this.appKey.value.trim();
        const accessKeyId = this.accessKeyId.value.trim();
        const accessKeySecret = this.accessKeySecret.value.trim();

        if (appKey && accessKeyId && accessKeySecret) {
            await this.getTokenAutomatically(appKey, accessKeyId, accessKeySecret);
        } else {
            // 清除Token和状态
            this.tokenField.value = '将在填写密钥后自动获取...';
            this.tokenField.classList.remove('has-token');
            this.recordButton.disabled = true;
            this.currentToken = null;
            this.showStatus('请完整填写阿里云凭据信息', 'error');
        }
    }

    // 自动获取Token
    async getTokenAutomatically(appKey, accessKeyId, accessKeySecret) {
        try {
            this.showStatus('正在获取Token...', 'processing');
            this.recordButton.disabled = true;

            // 使用专门的get-token端点，语义更明确
            const response = await fetch('https://aliyun-voice-to-text-api.vercel.app/api/get-token', {
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

            const result = await response.json();

            if (result.success) {
                this.currentToken = result.token;
                            this.tokenField.value = result.token;
            this.tokenField.classList.add('has-token');
                this.showStatus('Token获取成功，可以开始录音', 'success');
                this.recordButton.disabled = false;
                this.updateDynamicHints();
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            console.error('Token获取失败:', error);
            this.tokenField.value = '获取失败，请检查密钥信息';
            this.tokenField.classList.remove('has-token');
            this.showStatus(`Token获取失败: ${error.message}`, 'error');
            this.recordButton.disabled = true;
            this.currentToken = null;
        }
    }

    async startRecording() {
        try {
            // 验证配置
            if (!this.validateConfig()) {
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                } 
            });

            this.setupAudioContext(stream);
            this.setupMediaRecorder(stream);

            this.mediaRecorder.start();
            this.isRecording = true;
            this.timeLeft = 30;
            this.recordingStartTime = Date.now();
            
            // 显示进度条和更改文本框内容
            this.transcriptionProgress.style.display = 'block';
            this.transcriptionResult.classList.add('recording');
            this.transcriptionResult.setAttribute('data-placeholder', '录音识别中...');
            
            this.updateUI();
            this.startTimer();
            this.startMiniWaveformTimer();
            
            this.showStatus('开始录音...', 'processing');

        } catch (error) {
            console.error('录音启动失败:', error);
            this.showStatus('录音启动失败: ' + error.message, 'error');
        }
    }

    validateConfig() {
        if (!this.apiUrl.value.trim()) {
            this.showStatus('请输入API地址', 'error');
            return false;
        }
        if (!this.appKey.value.trim()) {
            this.showStatus('请输入AppKey', 'error');
            return false;
        }
        if (!this.accessKeyId.value.trim()) {
            this.showStatus('请输入Access Key ID', 'error');
            return false;
        }
        if (!this.accessKeySecret.value.trim()) {
            this.showStatus('请输入Access Key Secret', 'error');
            return false;
        }
        return true;
    }

    setupAudioContext(stream) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        
        const source = this.audioContext.createMediaStreamSource(stream);
        source.connect(this.analyser);
    }

    setupMediaRecorder(stream) {
        this.audioChunks = [];
        // 尝试使用PCM格式，如果不支持则回退到webm
        let mimeType = 'audio/webm';
        if (MediaRecorder.isTypeSupported('audio/wav')) {
            mimeType = 'audio/wav';
        }
        
        this.mediaRecorder = new MediaRecorder(stream, {
            mimeType: mimeType
        });
        
        console.log('🎤 使用音频格式:', mimeType);

        this.mediaRecorder.ondataavailable = (event) => {
            this.audioChunks.push(event.data);
        };

        this.mediaRecorder.onstop = () => {
            this.processRecording();
        };
    }

    startTimer() {
        this.recordingTimer = setInterval(() => {
            this.timeLeft--;
            
            if (this.timeLeft <= 0) {
                this.stopRecording();
            }
        }, 1000);
    }

    startMiniWaveformTimer() {
        this.waveformTimer = setInterval(() => {
            this.updateMiniWaveform();
            this.updateProgressBar();
        }, this.waveformUpdateInterval);
    }

    updateProgressBar() {
        const elapsed = Date.now() - this.recordingStartTime;
        const progress = Math.min((elapsed / (30 * 1000)) * 100, 100);
        if (this.progressFill) {
            this.progressFill.style.width = progress + '%';
        }
    }

    updateMiniWaveform() {
        if (!this.waveformBars || !this.waveformBars.children) return;
        
        // 模拟音频峰值
        const amplitude = this.currentAmplitude || Math.random() * 0.8 + 0.1;
        
        // 更新SVG波形条
        const bars = this.waveformBars.children;
        for (let i = 0; i < bars.length; i++) {
            const bar = bars[i];
            const randomHeight = Math.random() * amplitude * 25 + 2; // 高度范围2-27px
            const y = 15 - randomHeight / 2;
            
            bar.setAttribute('height', randomHeight);
            bar.setAttribute('y', y);
            bar.setAttribute('opacity', '0.8');
        }
    }

    stopRecording() {
        if (!this.isRecording) return;

        this.isRecording = false;
        this.mediaRecorder.stop();
        
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
        }
        
        if (this.waveformTimer) {
            clearInterval(this.waveformTimer);
            this.waveformTimer = null;
        }

        // 停止所有音频轨道
        if (this.mediaRecorder && this.mediaRecorder.stream) {
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }

        // 隐藏进度条并恢复文本框
        this.transcriptionProgress.style.display = 'none';
        this.transcriptionResult.classList.remove('recording');
        this.transcriptionResult.setAttribute('data-placeholder', '录音完成后，语音识别结果将显示在这里...');

        this.updateUI();
        this.showStatus('录音结束，正在处理...', 'processing');
    }

    async processRecording() {
        try {
            // 更新按钮状态为识别中
            this.recordButton.textContent = '识别中...';
            this.recordButton.disabled = true;
            
            const audioBlob = new Blob(this.audioChunks, { type: this.mediaRecorder.mimeType });
            
            // 转换为PCM格式（模仿local_server的处理方式）
            const audioByteArray = await this.convertAudioToPCM(audioBlob);
            
            // 保存录音数据供下载使用
            this.currentAudioBlob = audioBlob;
            this.currentAudioByteArray = audioByteArray;
            
            // 立即显示下载按钮
            this.downloadButton.style.display = 'block';
            
            // 自动调用语音识别
            await this.recognizeAudio(audioByteArray);
            
        } catch (error) {
            console.error('录音处理失败:', error);
            this.showStatus('录音处理失败: ' + error.message, 'error');
        } finally {
            // 恢复按钮状态
            this.recordButton.textContent = '开始录音';
            this.recordButton.disabled = false;
        }
    }

    async blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                // 移除data:audio/webm;base64,前缀
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    async blobToArrayBuffer(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                resolve(reader.result);
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(blob);
        });
    }

    // 将音频转换为PCM格式（模仿local_server的处理方式）
    async convertAudioToPCM(audioBlob) {
        try {
            console.log('🔄 开始音频转换为PCM格式...');
            console.log('📊 原始音频大小:', audioBlob.size, 'bytes');
            
            // 创建AudioContext用于解码
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // 将Blob转换为ArrayBuffer
            const arrayBuffer = await this.blobToArrayBuffer(audioBlob);
            
            // 解码音频数据
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            console.log('🎵 解码成功:', audioBuffer.numberOfChannels, '声道,', audioBuffer.sampleRate, 'Hz');
            
            // 获取第一个声道的数据
            const channelData = audioBuffer.getChannelData(0);
            
            // 重采样到16kHz（阿里云API要求）
            const resampledData = this.resampleAudio(channelData, audioBuffer.sampleRate, 16000);
            console.log('🔄 重采样完成:', resampledData.length, '采样点');
            
            // 转换为Int16Array（PCM 16-bit）
            const int16Data = new Int16Array(resampledData.length);
            for (let i = 0; i < resampledData.length; i++) {
                const sample = Math.max(-1, Math.min(1, resampledData[i]));
                int16Data[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            }
            
            // 转换为字节数组
            const byteArray = Array.from(new Uint8Array(int16Data.buffer));
            console.log('✅ PCM转换完成:', byteArray.length, 'bytes');
            
            return byteArray;
            
        } catch (error) {
            console.error('❌ 音频转换失败:', error);
            throw error;
        }
    }

    // 音频重采样函数
    resampleAudio(inputData, inputSampleRate, outputSampleRate) {
        if (inputSampleRate === outputSampleRate) {
            return inputData;
        }
        
        const ratio = inputSampleRate / outputSampleRate;
        const outputLength = Math.floor(inputData.length / ratio);
        const outputData = new Float32Array(outputLength);
        
        for (let i = 0; i < outputLength; i++) {
            const inputIndex = i * ratio;
            const index = Math.floor(inputIndex);
            const fraction = inputIndex - index;
            
            if (index + 1 < inputData.length) {
                // 线性插值
                outputData[i] = inputData[index] * (1 - fraction) + inputData[index + 1] * fraction;
            } else {
                outputData[i] = inputData[index] || 0;
            }
        }
        
        return outputData;
    }

    async recognizeAudio(audioByteArray) {
        try {
            console.log('🚀 开始API调用...');
            console.log('📊 音频数据大小:', audioByteArray.length, 'bytes (数组)');
            console.log('🔗 API地址:', this.apiUrl.value);
            console.log('🔐 AppKey:', this.appKey.value);
            console.log('🔑 AccessKeyId:', this.accessKeyId.value);
            
            this.showStatus('正在调用API进行语音识别...', 'processing');
            
            // 与local_server版本完全一致的请求体格式 - 包含Token
            const requestBody = {
                token: this.currentToken, // 传递已获取的Token
                audioData: audioByteArray, // 发送字节数组
                appKey: this.appKey.value,
                accessKeyId: this.accessKeyId.value,
                accessKeySecret: this.accessKeySecret.value,
                format: 'pcm',
                sampleRate: 16000
            };
            
            console.log('📤 发送请求体:', {
                ...requestBody,
                audioData: `[${audioByteArray.length} bytes]`,
                accessKeySecret: '[HIDDEN]'
            });
            
            const response = await fetch(this.apiUrl.value, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            console.log('📡 响应状态:', response.status, response.statusText);
            
            const result = await response.json();
            console.log('📥 完整响应:', result);
            
            if (result.success) {
                // 与local_server版本一致，直接使用result字段
                const recognizedText = result.result || '';
                console.log('✅ 识别成功！文本内容:', `"${recognizedText}"`);
                console.log('📝 文本长度:', recognizedText.length);
                
                // 立即显示识别结果到文本框 - 使用指定格式
                if (recognizedText) {
                    this.transcriptionResult.textContent = `识别结果：「${recognizedText}」`;
                    this.transcriptionResult.className = "transcription-result success";
                    this.showResultStatus('识别成功', 'success');
                    
                    // 显示示例HTML按钮
                    this.demoHtmlButton.style.display = 'inline-block';
                } else {
                    this.transcriptionResult.textContent = '识别结果：「未识别到内容，请重试」';
                    this.transcriptionResult.className = "transcription-result warning";
                    this.showResultStatus('未识别到内容', 'warning');
                }
                
                // 隐藏进度条
                this.transcriptionProgress.style.display = 'none';
                
            } else {
                console.error('❌ 识别失败:', result.error);
                this.showStatus('识别失败: ' + result.error, 'error');
                this.transcriptionResult.textContent = '识别失败: ' + result.error;
                this.transcriptionResult.classList.remove('has-content');
            }
            
        } catch (error) {
            console.error('❌ API调用异常:', error);
            this.showStatus('API调用失败: ' + error.message, 'error');
            this.transcriptionResult.textContent = 'API调用失败: ' + error.message;
            this.transcriptionResult.classList.remove('has-content');
        }
    }

    // 根据识别结果显示不同颜色的状态
    showResultStatus(text) {
        const textLength = text.length;
        
        if (textLength >= 10) {
            // 绿色：成功，文字超过10字
            this.transcriptionResult.textContent = `录音结果：${text}`;
            this.transcriptionResult.className = 'transcription-textarea success has-content';
            this.showStatus(`识别成功！识别了 ${textLength} 个字符`, 'success');
        } else if (textLength > 0) {
            // 黄色：成功但文字较少
            this.transcriptionResult.textContent = `录音结果：${text}`;
            this.transcriptionResult.className = 'transcription-textarea warning has-content';
            this.showStatus(`识别成功，但文字较少：${textLength} 个字符`, 'warning');
        } else {
            // 红色：识别失败或无内容
            this.transcriptionResult.textContent = '识别成功但无文字内容';
            this.transcriptionResult.className = 'transcription-textarea error';
            this.showStatus('识别成功但无文字内容', 'error');
        }
    }

    downloadRecording() {
        if (!this.currentAudioBlob) {
            this.showStatus('没有录音数据可下载', 'error');
            return;
        }

        const url = URL.createObjectURL(this.currentAudioBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recording_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showStatus('录音已下载', 'success');
    }

    updateUI() {
        if (this.isRecording) {
            this.recordButton.textContent = '停止录音';
            this.recordButton.classList.add('recording');
            this.downloadButton.style.display = 'none';
        } else {
            this.recordButton.textContent = '开始录音';
            this.recordButton.classList.remove('recording');
            
            // 重置所有显示
            this.transcriptionResult.textContent = '';
            this.transcriptionResult.classList.remove('has-content');
            this.downloadButton.style.display = 'none';
            
            // 重置进度条
            if (this.progressFill) {
                this.progressFill.style.width = '0%';
            }
            this.initMiniWaveform();
        }
    }

    showStatus(message, type) {
        // 使用转录框显示状态信息
        this.transcriptionResult.textContent = message;
        this.transcriptionResult.className = `transcription-textarea ${type}`;
    }

    // 生成示例HTML页面
    generateDemoHtml() {
        const appKey = this.appKey.value;
        const accessKeyId = this.accessKeyId.value;
        const accessKeySecret = this.accessKeySecret.value;
        
        if (!appKey || !accessKeyId || !accessKeySecret) {
            alert('请先完整配置阿里云密钥信息');
            return;
        }

        // 创建一个简化版本，避免模板字符串嵌套问题
        const demoHtml = '<!DOCTYPE html>' +
            '<html lang="zh-CN">' +
            '<head>' +
            '<meta charset="UTF-8">' +
            '<title>语音识别示例</title>' +
            '<style>' +
            'body{font-family:Arial,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;color:white;margin:0}' +
            '.container{text-align:center;padding:40px}' +
            '.title{font-size:3em;margin-bottom:40px;text-shadow:0 4px 8px rgba(0,0,0,0.3)}' +
            '.record-button{background:rgba(255,255,255,0.15);border:3px solid rgba(255,255,255,0.8);color:white;font-size:1.8em;padding:25px 50px;border-radius:60px;cursor:pointer;transition:all 0.4s ease;backdrop-filter:blur(20px);min-width:400px;margin:30px 0}' +
            '.record-button:hover{background:rgba(255,255,255,0.25);transform:scale(1.05)}' +
            '.record-button.recording{background:rgba(255,59,48,0.3);border-color:#ff6b6b;animation:pulse 1.5s infinite}' +
            '@keyframes pulse{0%{transform:scale(1)}50%{transform:scale(1.02)}100%{transform:scale(1)}}' +
            '.countdown{font-size:1.4em;margin:20px 0;opacity:0.9;min-height:40px}' +
            '.result{margin-top:40px;padding:30px;background:rgba(255,255,255,0.1);border-radius:20px;backdrop-filter:blur(20px);font-size:1.4em;min-height:80px;display:none}' +
            '.hint{margin-top:30px;font-size:1.1em;opacity:0.7}' +
            '</style>' +
            '</head>' +
            '<body>' +
            '<div class="container">' +
            '<h1 class="title">语音识别示例</h1>' +
            '<button id="recordButton" class="record-button">开始录音</button>' +
            '<div id="countdown" class="countdown"></div>' +
            '<div id="result" class="result"></div>' +
            '<div class="hint">录音时可按任意键结束</div>' +
            '</div>' +
            '<script>' +
            'class SimpleVoiceRecognizer{' +
            'constructor(){' +
            'this.appKey="' + appKey + '";' +
            'this.accessKeyId="' + accessKeyId + '";' +
            'this.accessKeySecret="' + accessKeySecret + '";' +
            'this.apiUrl="https://aliyun-voice-to-text-api.vercel.app/api/recognize";' +
            'this.init()' +
            '}' +
            'init(){' +
            'this.recordButton=document.getElementById("recordButton");' +
            'this.countdown=document.getElementById("countdown");' +
            'this.result=document.getElementById("result");' +
            'this.recordButton.onclick=()=>this.isRecording?this.stop():this.start();' +
            'document.onkeydown=()=>this.isRecording&&this.stop();' +
            'this.getToken()' +
            '}' +
            'async getToken(){' +
            'try{' +
            'const res=await fetch("https://aliyun-voice-to-text-api.vercel.app/api/get-token",{' +
            'method:"POST",headers:{"Content-Type":"application/json"},' +
            'body:JSON.stringify({appKey:this.appKey,accessKeyId:this.accessKeyId,accessKeySecret:this.accessKeySecret})' +
            '});' +
            'const result=await res.json();' +
            'this.token=result.success?result.token:null' +
            '}catch(e){console.error("Token获取失败:",e)}' +
            '}' +
            'async start(){' +
            'if(!this.token)return alert("Token未准备就绪");' +
            'try{' +
            'const stream=await navigator.mediaDevices.getUserMedia({audio:{sampleRate:16000,channelCount:1}});' +
            'this.recorder=new MediaRecorder(stream);' +
            'this.chunks=[];' +
            'this.recorder.ondataavailable=e=>this.chunks.push(e.data);' +
            'this.recorder.onstop=()=>this.process();' +
            'this.recorder.start();' +
            'this.isRecording=true;' +
            'this.recordButton.textContent="录音中... (按任意键结束)";' +
            'this.recordButton.classList.add("recording");' +
            'this.startCountdown();' +
            'setTimeout(()=>this.stop(),30000)' +
            '}catch(e){alert("麦克风权限被拒绝")}' +
            '}' +
            'startCountdown(){' +
            'this.time=30;' +
            'this.timer=setInterval(()=>{' +
            'this.countdown.textContent="剩余 "+this.time--+" 秒";' +
            'if(this.time<0)clearInterval(this.timer)' +
            '},1000)' +
            '}' +
            'stop(){' +
            'if(!this.isRecording)return;' +
            'this.isRecording=false;' +
            'this.recorder.stop();' +
            'this.recorder.stream.getTracks().forEach(t=>t.stop());' +
            'this.recordButton.textContent="识别中...";' +
            'this.recordButton.classList.remove("recording");' +
            'this.countdown.textContent="";' +
            'clearInterval(this.timer)' +
            '}' +
            'async process(){' +
            'try{' +
            'const blob=new Blob(this.chunks);' +
            'const audioData=await this.convertToPCM(blob);' +
            'const res=await fetch(this.apiUrl,{' +
            'method:"POST",headers:{"Content-Type":"application/json"},' +
            'body:JSON.stringify({token:this.token,audioData,appKey:this.appKey,accessKeyId:this.accessKeyId,accessKeySecret:this.accessKeySecret,format:"pcm",sampleRate:16000})' +
            '});' +
            'const result=await res.json();' +
            'this.result.textContent=result.success&&result.result?"识别结果：「"+result.result+"」":"识别结果：「未识别到内容」";' +
            'this.result.style.display="block"' +
            '}catch(e){' +
            'this.result.textContent="识别失败，请重试";' +
            'this.result.style.display="block"' +
            '}finally{' +
            'this.recordButton.textContent="开始录音"' +
            '}' +
            '}' +
            'async convertToPCM(blob){' +
            'const ctx=new AudioContext();' +
            'const buf=await ctx.decodeAudioData(await blob.arrayBuffer());' +
            'const data=buf.getChannelData(0);' +
            'const resampled=this.resample(data,buf.sampleRate,16000);' +
            'const int16=new Int16Array(resampled.length);' +
            'for(let i=0;i<resampled.length;i++){' +
            'const s=Math.max(-1,Math.min(1,resampled[i]));' +
            'int16[i]=s<0?s*0x8000:s*0x7FFF' +
            '}' +
            'return Array.from(new Uint8Array(int16.buffer))' +
            '}' +
            'resample(input,inRate,outRate){' +
            'if(inRate===outRate)return input;' +
            'const ratio=inRate/outRate;' +
            'const len=Math.floor(input.length/ratio);' +
            'const output=new Float32Array(len);' +
            'for(let i=0;i<len;i++){' +
            'const idx=i*ratio;' +
            'const floor=Math.floor(idx);' +
            'const frac=idx-floor;' +
            'output[i]=floor+1<input.length?input[floor]*(1-frac)+input[floor+1]*frac:input[floor]||0' +
            '}' +
            'return output' +
            '}' +
            '}' +
            'new SimpleVoiceRecognizer();' +
            '</script>' +
            '</body>' +
            '</html>';

        // 避免使用模板字符串的下载文件名
        const today = new Date().toISOString().slice(0, 10);
        const fileName = '语音识别示例_' + today + '.html';

        // 下载HTML文件
        const blob = new Blob([demoHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('示例HTML文件已生成并下载');
    }
}

// 初始化测试器
document.addEventListener('DOMContentLoaded', () => {
    new VoiceRecognitionTester();
});
