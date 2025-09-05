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
        this.transcriptionResult = document.getElementById('transcriptionResult');
        
        // 新的进度条和波形图元素
        this.transcriptionProgress = document.getElementById('transcriptionProgress');
        this.progressBar = document.getElementById('progressBar');
        this.waveformMini = document.getElementById('waveformMini');
        
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
        this.waveformBars = [];
        
        // 创建50个波形条
        this.waveformMini.innerHTML = '';
        for (let i = 0; i < 50; i++) {
            const bar = document.createElement('div');
            bar.className = 'waveform-bar';
            this.waveformMini.appendChild(bar);
            this.waveformBars.push(bar);
        }
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

        // 设置信息图标点击事件
        this.setupInfoIconEvents();
        
        // 初始化动态提示
        this.updateDynamicHints();
    }

    setupInfoIconEvents() {
        const infoIcons = document.querySelectorAll('.info-icon');
        infoIcons.forEach((icon, index) => {
            icon.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // 切换tooltip显示状态
                const isShowing = icon.classList.contains('show-tooltip');
                
                // 先隐藏所有tooltip
                infoIcons.forEach(i => i.classList.remove('show-tooltip'));
                
                // 如果之前没有显示，则显示当前tooltip
                if (!isShowing) {
                    icon.classList.add('show-tooltip');
                    
                    // 3秒后自动隐藏
                    setTimeout(() => {
                        icon.classList.remove('show-tooltip');
                    }, 3000);
                }
            });
        });
        
        // 点击其他地方隐藏tooltip
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.info-icon')) {
                infoIcons.forEach(icon => icon.classList.remove('show-tooltip'));
            }
        });
    }

    updateDynamicHints() {
        const appKey = this.appKey.value.trim();
        const accessKeyId = this.accessKeyId.value.trim();
        const accessKeySecret = this.accessKeySecret.value.trim();

        // 找到第一个空字段并更新其提示
        if (!appKey) {
            this.appKey.placeholder = "📝 请先填写AppKey - 前往 https://nls-portal.console.aliyun.com/applist";
            this.appKey.style.borderColor = "#ffc107";
        } else {
            this.appKey.placeholder = "从阿里云NLS控制台项目中获取";
            this.appKey.style.borderColor = "#28a745";
        }

        if (!accessKeyId && appKey) {
            this.accessKeyId.placeholder = "📝 接下来填写AccessKey ID - 前往 https://ram.console.aliyun.com/users";
            this.accessKeyId.style.borderColor = "#ffc107";
        } else if (accessKeyId) {
            this.accessKeyId.placeholder = "从RAM用户管理页面获取";
            this.accessKeyId.style.borderColor = "#28a745";
        } else {
            this.accessKeyId.placeholder = "从RAM用户管理页面获取";
            this.accessKeyId.style.borderColor = "";
        }

        if (!accessKeySecret && appKey && accessKeyId) {
            this.accessKeySecret.placeholder = "📝 最后填写AccessKey Secret - 在RAM用户页面创建";
            this.accessKeySecret.style.borderColor = "#ffc107";
        } else if (accessKeySecret) {
            this.accessKeySecret.placeholder = "在RAM用户管理页面创建";
            this.accessKeySecret.style.borderColor = "#28a745";
        } else {
            this.accessKeySecret.placeholder = "在RAM用户管理页面创建";
            this.accessKeySecret.style.borderColor = "";
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
            this.tokenField.textContent = '将在填写密钥后自动获取...';
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
                            this.tokenField.textContent = result.token;
            this.tokenField.classList.add('has-token');
                this.showStatus('Token获取成功，可以开始录音', 'success');
                this.recordButton.disabled = false;
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            console.error('Token获取失败:', error);
            this.tokenField.textContent = '获取失败，请检查密钥信息';
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
            this.transcriptionResult.placeholder = '录音识别中...';
            
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
        this.mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm'
        });

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
        this.progressBar.style.width = progress + '%';
    }

    updateMiniWaveform() {
        // 模拟音频峰值
        const amplitude = this.currentAmplitude || Math.random() * 0.8 + 0.1;
        
        // 更新波形条
        this.waveformBars.forEach((bar, index) => {
            const randomHeight = Math.random() * amplitude * 100 + 10;
            bar.style.height = Math.min(randomHeight, 100) + '%';
        });
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
        this.transcriptionResult.placeholder = '录音完成后，语音识别结果将显示在这里...';

        this.updateUI();
        this.showStatus('录音结束，正在处理...', 'processing');
    }

    async processRecording() {
        try {
            // 更新按钮状态为识别中
            this.recordButton.textContent = '识别中...';
            this.recordButton.disabled = true;
            
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
            
            // 转换为base64
            const audioBase64 = await this.blobToBase64(audioBlob);
            
            // 保存录音数据供下载使用
            this.currentAudioBlob = audioBlob;
            this.currentAudioBase64 = audioBase64;
            
            // 立即显示下载按钮
            this.downloadButton.style.display = 'block';
            
            // 自动调用语音识别
            await this.recognizeAudio(audioBase64);
            
        } catch (error) {
            console.error('录音处理失败:', error);
            this.showStatus('录音处理失败: ' + error.message, 'error');
        } finally {
            // 恢复按钮状态
            this.recordButton.textContent = '开始录音测试';
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

    async recognizeAudio(audioBase64) {
        try {
            console.log('🚀 开始API调用...');
            console.log('📊 音频数据大小:', audioBase64.length, '字符 (base64)');
            console.log('🔗 API地址:', this.apiUrl.value);
            console.log('🔐 AppKey:', this.appKey.value);
            console.log('🔑 AccessKeyId:', this.accessKeyId.value);
            
            this.showStatus('正在调用API进行语音识别...', 'processing');
            
            const requestBody = {
                audioData: audioBase64,
                appKey: this.appKey.value,
                accessKeyId: this.accessKeyId.value,
                accessKeySecret: this.accessKeySecret.value,
                maxDuration: 60
            };
            
            console.log('📤 发送请求体:', {
                ...requestBody,
                audioData: `[${audioBase64.length} chars]`,
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
                const recognizedText = result.data ? result.data.text : '';
                console.log('✅ 识别成功！文本内容:', `"${recognizedText}"`);
                console.log('📝 文本长度:', recognizedText.length);
                
                // 延迟清除进度条并显示结果
                setTimeout(() => {
                    if (recognizedText) {
                        this.transcriptionResult.value = recognizedText;
                        this.transcriptionResult.classList.add('has-content');
                    }
                    this.showResultStatus(recognizedText);
                }, 1000);
                
            } else {
                console.error('❌ 识别失败:', result.error);
                this.showStatus('识别失败: ' + result.error, 'error');
                this.transcriptionResult.value = '识别失败: ' + result.error;
                this.transcriptionResult.classList.remove('has-content');
            }
            
        } catch (error) {
            console.error('❌ API调用异常:', error);
            this.showStatus('API调用失败: ' + error.message, 'error');
            this.transcriptionResult.value = 'API调用失败: ' + error.message;
            this.transcriptionResult.classList.remove('has-content');
        }
    }

    // 根据识别结果显示不同颜色的状态
    showResultStatus(text) {
        const textLength = text.length;
        
        if (textLength >= 10) {
            // 绿色：成功，文字超过10字
            this.transcriptionResult.value = `录音结果：${text}`;
            this.transcriptionResult.className = 'transcription-textarea success has-content';
            this.showStatus(`识别成功！识别了 ${textLength} 个字符`, 'success');
        } else if (textLength > 0) {
            // 黄色：成功但文字较少
            this.transcriptionResult.value = `录音结果：${text}`;
            this.transcriptionResult.className = 'transcription-textarea warning has-content';
            this.showStatus(`识别成功，但文字较少：${textLength} 个字符`, 'warning');
        } else {
            // 红色：识别失败或无内容
            this.transcriptionResult.value = '识别成功但无文字内容';
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
            this.recordButton.textContent = '开始录音测试';
            this.recordButton.classList.remove('recording');
            
            // 重置所有显示
            this.transcriptionResult.value = '';
            this.transcriptionResult.classList.remove('has-content');
            this.downloadButton.style.display = 'none';
            
            // 重置进度条
            this.progressBar.style.width = '0%';
            this.initMiniWaveform();
        }
    }

    showStatus(message, type) {
        // 使用转录框显示状态信息
        this.transcriptionResult.value = message;
        this.transcriptionResult.className = `transcription-textarea ${type}`;
    }
}

// 初始化测试器
document.addEventListener('DOMContentLoaded', () => {
    new VoiceRecognitionTester();
});
