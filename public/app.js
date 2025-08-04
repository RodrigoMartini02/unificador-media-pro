class MediaUnifierApp {
    constructor() {
        this.files = [];
        this.isProcessing = false;
        this.serverUrl = window.location.origin;
        this.maxFileSize = 5 * 1024 * 1024 * 1024;
        this.maxFiles = 50;
        this.supportedFormats = {
            video: ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv'],
            audio: ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'wma']
        };
        this.ws = null;
        this.currentProcessId = null;
        
        this.init();
    }

    init() {
        console.log('🚀 Iniciando Unificador de Mídia Pro - Versão Web');
        this.setupElements();
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.setupWebSocket();
        this.updateConnectionStatus();
        this.showToast('Aplicação carregada com sucesso!', 'success');
    }

    setupElements() {
        this.dropZone = document.getElementById('dropZone');
        this.fileInput = document.getElementById('fileInput');
        this.filesList = document.getElementById('filesList');
        this.processBtn = document.getElementById('processBtn');
        this.clearBtn = document.getElementById('clearBtn');
        
        this.statsSection = document.getElementById('statsSection');
        this.filesSection = document.getElementById('filesSection');
        this.configSection = document.getElementById('configSection');
        this.processSection = document.getElementById('processSection');
        this.resultSection = document.getElementById('resultSection');
        
        this.outputName = document.getElementById('outputName');
        this.outputFormat = document.getElementById('outputFormat');
        this.quality = document.getElementById('quality');
        this.turboMode = document.getElementById('turboMode');
        this.ecoMode = document.getElementById('ecoMode');
        
        this.connectionStatus = document.getElementById('connectionStatus');
        this.progressBar = document.getElementById('progressBar');
        this.progressPercentage = document.getElementById('progressPercentage');
        this.statusText = document.getElementById('statusText');
        this.speedText = document.getElementById('speedText');
    }

    setupEventListeners() {
        this.dropZone.addEventListener('dragover', this.handleDragOver.bind(this));
        this.dropZone.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.dropZone.addEventListener('drop', this.handleDrop.bind(this));
        this.dropZone.addEventListener('click', () => this.fileInput.click());
        
        this.fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        
        this.processBtn.addEventListener('click', this.startProcessing.bind(this));
        this.clearBtn.addEventListener('click', this.clearAllFiles.bind(this));
        
        this.turboMode.addEventListener('change', this.handleModeChange.bind(this));
        this.ecoMode.addEventListener('change', this.handleModeChange.bind(this));
        
        this.outputName.addEventListener('input', this.validateOutputName.bind(this));
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key.toLowerCase()) {
                    case 'o':
                        e.preventDefault();
                        this.fileInput.click();
                        break;
                    case 'enter':
                        e.preventDefault();
                        if (!this.processBtn.disabled) {
                            this.startProcessing();
                        }
                        break;
                    case 'delete':
                        e.preventDefault();
                        this.clearAllFiles();
                        break;
                }
            }
        });
    }

    setupWebSocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}`;
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('🔌 WebSocket conectado');
                this.updateConnectionStatus();
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('❌ Erro ao processar mensagem WebSocket:', error);
                }
            };
            
            this.ws.onclose = () => {
                console.log('🔌 WebSocket desconectado');
                this.updateConnectionStatus();
                setTimeout(() => this.setupWebSocket(), 5000);
            };
            
            this.ws.onerror = (error) => {
                console.error('❌ Erro WebSocket:', error);
            };
        } catch (error) {
            console.warn('⚠️ WebSocket não disponível, usando polling');
        }
    }

    handleWebSocketMessage(data) {
        if (data.type === 'processUpdate' && data.data.id === this.currentProcessId) {
            const processInfo = data.data;
            
            this.updateProgress(processInfo.progress || 0, processInfo.status || 'Processando...');
            
            if (processInfo.speed) {
                this.updateSpeed(processInfo.speed);
            }
            
            if (processInfo.status === 'concluído') {
                this.handleProcessingComplete({
                    filename: processInfo.fileName,
                    downloadUrl: `${this.serverUrl}/download/${processInfo.id}`,
                    format: this.outputFormat.value,
                    processId: processInfo.id
                });
            } else if (processInfo.status === 'erro') {
                this.showToast('Erro no processamento: ' + processInfo.error, 'error');
                this.resetToInitialState();
            }
        }
    }

    handleDragOver(e) {
        e.preventDefault();
        this.dropZone.classList.add('drag-over');
    }

    handleDragLeave(e) {
        e.preventDefault();
        this.dropZone.classList.remove('drag-over');
    }

    handleDrop(e) {
        e.preventDefault();
        this.dropZone.classList.remove('drag-over');
        
        const files = Array.from(e.dataTransfer.files);
        this.addFiles(files);
    }

    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        this.addFiles(files);
        e.target.value = '';
    }

    async addFiles(fileList) {
        const validFiles = [];
        const errors = [];

        for (const file of fileList) {
            const validation = this.validateFile(file);
            if (validation.valid) {
                const fileWithInfo = {
                    file: file,
                    id: this.generateId(),
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    extension: this.getFileExtension(file.name),
                    duration: null,
                    isVideo: this.isVideoFile(file.name),
                    isAudio: this.isAudioFile(file.name)
                };
                
                try {
                    fileWithInfo.duration = await this.getMediaDuration(file);
                } catch (error) {
                    console.warn('Não foi possível obter duração de:', file.name);
                    fileWithInfo.duration = 0;
                }
                
                validFiles.push(fileWithInfo);
            } else {
                errors.push(`${file.name}: ${validation.error}`);
            }
        }

        if (this.files.length + validFiles.length > this.maxFiles) {
            this.showToast(`Máximo de ${this.maxFiles} arquivos permitido`, 'error');
            return;
        }

        this.files.push(...validFiles);
        
        if (errors.length > 0) {
            this.showToast(`Alguns arquivos foram rejeitados:\n${errors.join('\n')}`, 'warning');
        }

        this.updateUI();
        
        if (validFiles.length > 0) {
            this.showToast(`${validFiles.length} arquivo(s) adicionado(s)`, 'success');
        }
    }

    validateFile(file) {
        if (file.size > this.maxFileSize) {
            return {
                valid: false,
                error: `Arquivo muito grande (máx: ${this.formatFileSize(this.maxFileSize)})`
            };
        }

        const extension = this.getFileExtension(file.name).toLowerCase();
        const allFormats = [...this.supportedFormats.video, ...this.supportedFormats.audio];
        
        if (!allFormats.includes(extension)) {
            return {
                valid: false,
                error: `Formato não suportado (.${extension})`
            };
        }

        return { valid: true };
    }

    async getMediaDuration(file) {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            const audio = document.createElement('audio');
            
            const element = this.isVideoFile(file.name) ? video : audio;
            
            element.preload = 'metadata';
            
            element.onloadedmetadata = () => {
                resolve(element.duration || 0);
                URL.revokeObjectURL(element.src);
            };
            
            element.onerror = () => {
                resolve(0);
                URL.revokeObjectURL(element.src);
            };
            
            element.src = URL.createObjectURL(file);
        });
    }

    async startProcessing() {
        if (this.files.length < 2) {
            this.showToast('Adicione pelo menos 2 arquivos para unificar', 'warning');
            return;
        }

        this.isProcessing = true;
        this.showProcessingSection();

        try {
            this.updateProgress(10, 'Enviando arquivos...');
            const uploadResponse = await this.uploadFilesReal();
            
            if (!uploadResponse.success) {
                throw new Error(uploadResponse.error);
            }

            this.showToast(`${uploadResponse.files.length} arquivos enviados`, 'success');

            this.updateProgress(30, 'Iniciando processamento...');
            const processResponse = await this.processFilesReal(uploadResponse.files);
            
            if (!processResponse.success) {
                throw new Error(processResponse.error);
            }

            this.currentProcessId = processResponse.processId;
            this.showToast('Processamento iniciado', 'info');

            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                this.updateProgress(50, 'Processando com FFmpeg...');
                await this.waitForCompletion(processResponse.processId);
            }

        } catch (error) {
            console.error('❌ Erro no processamento:', error);
            this.showToast('Erro: ' + error.message, 'error');
            this.resetToInitialState();
        }
    }

    async uploadFilesReal() {
        const formData = new FormData();
        
        this.files.forEach((fileInfo) => {
            formData.append('files', fileInfo.file);
        });

        const response = await fetch(`${this.serverUrl}/upload`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Upload falhou: ${response.status} - ${errorText}`);
        }

        return await response.json();
    }

    async processFilesReal(uploadedFiles) {
        const config = {
            outputName: this.outputName.value || 'media_unificado',
            format: this.outputFormat.value,
            quality: this.quality.value,
            turboMode: this.turboMode.checked,
            ecoMode: this.ecoMode.checked
        };

        const fileIds = uploadedFiles.map(file => file.id);

        const response = await fetch(`${this.serverUrl}/process`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fileIds, config })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Processamento falhou: ${response.status} - ${errorText}`);
        }

        return await response.json();
    }

    async waitForCompletion(processId) {
        const maxWait = 300000;
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(50 + (elapsed / maxWait) * 45, 95);
            this.updateProgress(progress, 'Processando com FFmpeg...');
            
            try {
                const downloadUrl = `${this.serverUrl}/download/${processId}`;
                const testResponse = await fetch(downloadUrl, { method: 'HEAD' });
                
                if (testResponse.ok) {
                    this.updateProgress(100, 'Processamento concluído!');
                    
                    this.handleProcessingComplete({
                        filename: `${this.outputName.value || 'media_unificado'}.${this.outputFormat.value}`,
                        downloadUrl: downloadUrl,
                        format: this.outputFormat.value,
                        processId: processId
                    });
                    return;
                }
            } catch (error) {
                // Continue waiting
            }
            
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        throw new Error('Timeout: Processamento demorou mais que 5 minutos');
    }

    updateProgress(progress, status) {
        this.progressBar.style.width = `${progress}%`;
        this.progressPercentage.textContent = `${Math.round(progress)}%`;
        this.statusText.textContent = status || 'Processando...';
    }

    updateSpeed(speed) {
        this.speedText.textContent = speed ? `Velocidade: ${speed}` : '';
    }

    handleProcessingComplete(data) {
        this.isProcessing = false;
        this.currentProcessId = null;
        this.showResultSection(data);
        this.showToast('Processamento concluído com sucesso!', 'success');
    }

    showProcessingSection() {
        this.hideAllSections();
        this.processSection.style.display = 'block';
        this.updateProgress(0, 'Iniciando processamento...');
    }

    showResultSection(result) {
        this.hideAllSections();
        this.resultSection.style.display = 'block';
        
        const resultInfo = document.getElementById('resultInfo');
        resultInfo.innerHTML = `
            <div class="result-details">
                <div class="result-icon">🎉</div>
                <h3>Arquivo unificado criado com sucesso!</h3>
                
                <div class="result-stats">
                    <div class="result-stat">
                        <span class="stat-label">📁 Nome:</span>
                        <span class="stat-value">${result.filename || 'arquivo_unificado'}</span>
                    </div>
                    <div class="result-stat">
                        <span class="stat-label">🎯 Formato:</span>
                        <span class="stat-value">${(result.format || 'mp4').toUpperCase()}</span>
                    </div>
                    <div class="result-stat">
                        <span class="stat-label">📋 Status:</span>
                        <span class="stat-value">Pronto para download</span>
                    </div>
                </div>
            </div>
        `;

        const downloadBtn = document.getElementById('downloadBtn');
        const newProcessBtn = document.getElementById('newProcessBtn');
        
        downloadBtn.onclick = () => {
            if (result.downloadUrl && result.downloadUrl !== '#download-teste') {
                const link = document.createElement('a');
                link.href = result.downloadUrl;
                link.download = result.filename || 'arquivo_unificado.mp4';
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                this.showToast('Download iniciado!', 'success');
            } else {
                this.showToast('URL de download inválida', 'error');
            }
        };
        
        newProcessBtn.onclick = () => this.resetToInitialState();
    }

    hideAllSections() {
        [this.processSection, this.resultSection].forEach(section => {
            if (section) section.style.display = 'none';
        });
    }

    updateUI() {
        this.updateStats();
        this.updateFilesList();
        this.updateProcessButton();
        this.toggleSections();
    }

    updateStats() {
        const fileCount = this.files.length;
        const totalSize = this.files.reduce((sum, file) => sum + file.size, 0);
        const totalDuration = this.files.reduce((sum, file) => sum + (file.duration || 0), 0);
        
        document.getElementById('fileCount').textContent = fileCount;
        document.getElementById('totalSize').textContent = this.formatFileSize(totalSize);
        document.getElementById('totalDuration').textContent = this.formatDuration(totalDuration);
        
        const videoCount = this.files.filter(f => f.isVideo).length;
        const audioCount = this.files.filter(f => f.isAudio).length;
        
        const typeIndicator = document.getElementById('typeIndicator');
        if (videoCount > audioCount) {
            typeIndicator.textContent = 'Vídeo';
            typeIndicator.className = 'stat-value type-video';
        } else if (audioCount > videoCount) {
            typeIndicator.textContent = 'Áudio';
            typeIndicator.className = 'stat-value type-audio';
        } else {
            typeIndicator.textContent = 'Misto';
            typeIndicator.className = 'stat-value type-mixed';
        }
    }

    updateFilesList() {
        if (this.files.length === 0) {
            this.filesList.innerHTML = '<p class="no-files">Nenhum arquivo carregado</p>';
            return;
        }

        this.filesList.innerHTML = this.files.map((fileInfo, index) => `
            <div class="file-item" data-index="${index}">
                <div class="file-icon">
                    ${fileInfo.isVideo ? '🎬' : '🎵'}
                </div>
                <div class="file-info">
                    <div class="file-name" title="${fileInfo.name}">${fileInfo.name}</div>
                    <div class="file-details">
                        <span class="file-size">${this.formatFileSize(fileInfo.size)}</span>
                        ${fileInfo.duration ? `<span class="file-duration">${this.formatDuration(fileInfo.duration)}</span>` : ''}
                        <span class="file-format">.${fileInfo.extension}</span>
                    </div>
                </div>
                <div class="file-controls">
                    <button class="btn-icon-small" onclick="app.moveFileUp(${index})" ${index === 0 ? 'disabled' : ''}>
                        ⬆️
                    </button>
                    <button class="btn-icon-small" onclick="app.moveFileDown(${index})" ${index === this.files.length - 1 ? 'disabled' : ''}>
                        ⬇️
                    </button>
                    <button class="btn-icon-small btn-danger" onclick="app.removeFile(${index})">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
    }

    updateProcessButton() {
        if (this.files.length < 2) {
            this.processBtn.disabled = true;
            this.processBtn.querySelector('.btn-text').textContent = 
                this.files.length === 0 ? 'Adicione pelo menos 2 arquivos' : 'Adicione mais 1 arquivo';
        } else {
            this.processBtn.disabled = false;
            this.processBtn.querySelector('.btn-text').textContent = 
                `Unificar ${this.files.length} arquivos`;
        }
    }

    toggleSections() {
        const hasFiles = this.files.length > 0;
        
        this.statsSection.style.display = hasFiles ? 'block' : 'none';
        this.filesSection.style.display = hasFiles ? 'block' : 'none';
        this.configSection.style.display = hasFiles ? 'block' : 'none';
    }

    removeFile(index) {
        if (index >= 0 && index < this.files.length) {
            const fileName = this.files[index].name;
            this.files.splice(index, 1);
            this.updateUI();
            this.showToast(`Arquivo "${fileName}" removido`, 'info');
        }
    }

    moveFileUp(index) {
        if (index > 0) {
            [this.files[index], this.files[index - 1]] = [this.files[index - 1], this.files[index]];
            this.updateUI();
        }
    }

    moveFileDown(index) {
        if (index < this.files.length - 1) {
            [this.files[index], this.files[index + 1]] = [this.files[index + 1], this.files[index]];
            this.updateUI();
        }
    }

    clearAllFiles() {
        if (this.files.length === 0) return;
        
        if (confirm(`Remover todos os ${this.files.length} arquivos?`)) {
            this.files = [];
            this.updateUI();
            this.showToast('Todos os arquivos foram removidos', 'info');
        }
    }

    resetToInitialState() {
        this.files = [];
        this.isProcessing = false;
        this.currentProcessId = null;
        this.hideAllSections();
        this.updateUI();
        this.outputName.value = 'media_unificado';
        this.showToast('Pronto para nova unificação', 'info');
    }

    handleModeChange() {
        if (this.turboMode.checked) {
            this.ecoMode.checked = false;
        } else if (this.ecoMode.checked) {
            this.turboMode.checked = false;
        }
    }

    validateOutputName() {
        const value = this.outputName.value;
        const cleaned = value.replace(/[<>:"/\\|?*]/g, '');
        if (cleaned !== value) {
            this.outputName.value = cleaned;
        }
    }

    updateConnectionStatus() {
        const wsStatus = this.ws && this.ws.readyState === WebSocket.OPEN;
        
        fetch(`${this.serverUrl}/health`)
            .then(response => {
                if (response.ok) {
                    const status = wsStatus ? '🟢 Online (WebSocket)' : '🟡 Online (HTTP)';
                    this.connectionStatus.textContent = status;
                    this.connectionStatus.className = 'connection-status connected';
                } else {
                    throw new Error('Servidor não responde');
                }
            })
            .catch(() => {
                this.connectionStatus.textContent = '🔴 Offline';
                this.connectionStatus.className = 'connection-status disconnected';
            });
    }

    getFileExtension(filename) {
        return filename.split('.').pop() || '';
    }

    isVideoFile(filename) {
        const ext = this.getFileExtension(filename).toLowerCase();
        return this.supportedFormats.video.includes(ext);
    }

    isAudioFile(filename) {
        const ext = this.getFileExtension(filename).toLowerCase();
        return this.supportedFormats.audio.includes(ext);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatDuration(seconds) {
        if (!seconds || seconds === 0) return '00:00';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-icon">
                ${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}
            </div>
            <div class="toast-message">${message}</div>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 5000);

        console.log(`${type.toUpperCase()}: ${message}`);
    }

    getSystemInfo() {
        const info = {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            onLine: navigator.onLine,
            filesLoaded: this.files.length,
            serverUrl: this.serverUrl,
            supportedFormats: this.supportedFormats,
            webSocketConnected: this.ws && this.ws.readyState === WebSocket.OPEN
        };
        
        console.table(info);
        this.showToast('Info do sistema logada no console (F12)', 'info');
        return info;
    }

    reloadApp() {
        if (confirm('Recarregar a aplicação? Todos os arquivos serão perdidos.')) {
            window.location.reload();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('📱 DOM carregado - iniciando aplicação web');
    
    window.app = new MediaUnifierApp();
    
    if (!window.FormData) {
        alert('Seu navegador não suporta upload de arquivos. Use um navegador mais recente.');
        return;
    }
    
    if (!window.fetch) {
        alert('Seu navegador não suporta requisições modernas. Use um navegador mais recente.');
        return;
    }
    
    console.log('✅ Unificador de Mídia Pro carregado com sucesso!');
});

window.addEventListener('error', (e) => {
    console.error('❌ Erro global:', e.error);
    if (window.app) {
        window.app.showToast('Erro inesperado: ' + e.message, 'error');
    }
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('❌ Promise rejeitada:', e.reason);
    if (window.app) {
        window.app.showToast('Erro de conexão: ' + e.reason, 'error');
    }
});

window.addEventListener('online', () => {
    if (window.app) {
        window.app.showToast('Conexão restaurada', 'success');
        window.app.updateConnectionStatus();
    }
});

window.addEventListener('offline', () => {
    if (window.app) {
        window.app.showToast('Sem conexão com a internet', 'warning');
        window.app.updateConnectionStatus();
    }
});

window.addEventListener('load', () => {
    const loadTime = performance.now();
    console.log(`⚡ Aplicação carregada em ${loadTime.toFixed(2)}ms`);
});