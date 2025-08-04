const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const WebSocket = require('ws');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

class MediaServerWeb {
    constructor() {
        this.app = express();
        this.server = null;
        this.wss = null;
        this.port = process.env.PORT || 3000;
        
        // Usar diretórios temporários do sistema
        this.tempDir = path.join(os.tmpdir(), 'media-unifier-web');
        this.outputDir = this.tempDir; // Em web, output no mesmo local
        
        this.processes = new Map();
        this.uploadedFiles = new Map();
        
        this.ensureDirectories();
        this.setupFFmpeg();
        this.setupMiddleware();
        this.setupRoutes();
    }

    ensureDirectories() {
        [this.tempDir, this.outputDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`📁 Diretório criado: ${dir}`);
            }
        });
        
        // Limpar arquivos antigos (maior que 4 horas)
        this.cleanupOldFiles(4 * 60 * 60 * 1000);
    }

    cleanupOldFiles(maxAge) {
        try {
            const files = fs.readdirSync(this.tempDir);
            let cleanedCount = 0;
            
            files.forEach(filename => {
                const filePath = path.join(this.tempDir, filename);
                try {
                    const stats = fs.statSync(filePath);
                    if (Date.now() - stats.mtime.getTime() > maxAge) {
                        fs.unlinkSync(filePath);
                        cleanedCount++;
                    }
                } catch {}
            });
            
            if (cleanedCount > 0) {
                console.log(`🧹 ${cleanedCount} arquivo(s) antigo(s) removido(s)`);
            }
        } catch (error) {
            console.log('🧹 Limpeza concluída');
        }
    }

    setupFFmpeg() {
        // Para web, tentar FFmpeg do sistema ou Heroku buildpack
        const ffmpegPaths = [
            'ffmpeg', // Sistema/Heroku
            '/usr/bin/ffmpeg',
            '/usr/local/bin/ffmpeg',
            './bin/ffmpeg', // Local se existir
            './bin/ffmpeg.exe'
        ];

        for (const ffmpegPath of ffmpegPaths) {
            try {
                require('child_process').execSync(`"${ffmpegPath}" -version`, { 
                    stdio: 'ignore',
                    timeout: 5000 
                });
                
                ffmpeg.setFfmpegPath(ffmpegPath);
                console.log(`✅ FFmpeg encontrado: ${ffmpegPath}`);
                return;
            } catch {}
        }
        
        console.warn('⚠️ FFmpeg não encontrado - algumas funcionalidades podem não funcionar');
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json({ limit: '100mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '100mb' }));
        this.app.use(express.static(path.join(__dirname, 'public')));
        
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
        
        this.app.set('trust proxy', 1);
        
        this.upload = multer({
            storage: multer.diskStorage({
                destination: this.tempDir,
                filename: (req, file, cb) => {
                    const ext = path.extname(file.originalname);
                    const name = path.basename(file.originalname, ext);
                    const uniqueName = `media_${Date.now()}_${uuidv4().slice(0,8)}_${name}${ext}`;
                    cb(null, uniqueName);
                }
            }),
            limits: { 
                fileSize: 2 * 1024 * 1024 * 1024,
                files: 20
            },
            fileFilter: (req, file, cb) => {
                const validExts = /\.(mp4|avi|mov|mkv|webm|flv|mp3|wav|flac|m4a|aac|ogg|wma)$/i;
                cb(null, validExts.test(file.originalname));
            }
        });
    }

    setupRoutes() {
        this.app.get('/', (req, res) => {
            const indexPath = path.join(__dirname, 'public', 'index.html');
            if (fs.existsSync(indexPath)) {
                res.sendFile(indexPath);
            } else {
                res.send(`<h1>🎬 Unificador de Mídia Pro</h1><p>Arquivo index.html não encontrado na pasta public/</p>`);
            }
        });

        this.app.get('/health', (req, res) => {
            res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
        });

        this.app.post('/upload', this.upload.array('files', 20), async (req, res) => {
            try {
                if (!req.files?.length) {
                    return res.status(400).json({ success: false, error: 'Nenhum arquivo enviado' });
                }
                console.log(`📤 Upload web: ${req.files.length} arquivo(s)`);
                const files = await Promise.all(req.files.map(async (file) => {
                    const fileInfo = {
                        id: uuidv4(),
                        originalName: file.originalname,
                        path: file.path,
                        size: file.size,
                        type: this.getMediaType(file.originalname),
                        uploadTime: Date.now()
                    };
                    try {
                        fileInfo.metadata = await this.analyzeMedia(file.path);
                        console.log(`✅ ${file.originalname}: ${fileInfo.metadata.duration}s`);
                    } catch (error) {
                        console.warn(`⚠️ Análise ${file.originalname}:`, error.message);
                        fileInfo.metadata = { duration: 0, resolution: 'Erro na análise', bitrate: 0 };
                    }
                    this.uploadedFiles.set(fileInfo.id, fileInfo);
                    return fileInfo;
                }));
                setTimeout(() => {
                    files.forEach(file => {
                        if (fs.existsSync(file.path)) {
                            fs.unlinkSync(file.path);
                            this.uploadedFiles.delete(file.id);
                        }
                    });
                }, 60 * 60 * 1000);
                res.json({ success: true, files, message: `${files.length} arquivo(s) enviado(s)` });
            } catch (error) {
                console.error('❌ Erro upload web:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.post('/process', async (req, res) => {
            try {
                const { fileIds, config } = req.body;
                if (!fileIds?.length || fileIds.length < 2) {
                    return res.status(400).json({ success: false, error: 'Selecione pelo menos 2 arquivos' });
                }
                const processId = uuidv4();
                console.log(`🚀 Processamento web: ${processId}`);
                this.startUnification(processId, fileIds, config);
                res.json({ success: true, processId, message: 'Processamento iniciado' });
            } catch (error) {
                console.error('❌ Erro processamento web:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.get('/download/:processId', (req, res) => {
            try {
                const processId = req.params.processId;
                const process = this.processes.get(processId);
                if (!process?.outputPath || !fs.existsSync(process.outputPath)) {
                    return res.status(404).json({ success: false, error: 'Arquivo não encontrado' });
                }
                console.log(`📥 Download web: ${process.fileName}`);
                res.setHeader('Content-Disposition', `attachment; filename="${process.fileName}"`);
                res.setHeader('Content-Type', 'application/octet-stream');
                const fileStream = fs.createReadStream(process.outputPath);
                fileStream.pipe(res);
                fileStream.on('end', () => {
                    setTimeout(() => {
                        if (fs.existsSync(process.outputPath)) {
                            fs.unlinkSync(process.outputPath);
                            this.processes.delete(processId);
                        }
                    }, 60000);
                });
            } catch (error) {
                console.error('❌ Erro download web:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.get('/status', (req, res) => {
            res.json({
                status: 'online',
                version: '2.0.0-web',
                platform: 'web',
                processes: this.processes.size,
                uploadedFiles: this.uploadedFiles.size,
                memory: process.memoryUsage(),
                uptime: process.uptime(),
                environment: process.env.NODE_ENV || 'development'
            });
        });

        // Rota de info do WebSocket removida pois não usa mais porta separada em prod
    }

    getMediaType(filename) {
        const ext = path.extname(filename).toLowerCase();
        const videoExts = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.m4v'];
        const audioExts = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.wma'];
        if (videoExts.includes(ext)) return 'video';
        if (audioExts.includes(ext)) return 'audio';
        return 'unknown';
    }

    async analyzeMedia(filePath) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (err) return reject(new Error(`Análise falhou: ${err.message}`));
                try {
                    const videoStream = metadata.streams.find(s => s.codec_type === 'video');
                    const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
                    const result = {
                        duration: parseFloat(metadata.format.duration) || 0,
                        bitrate: parseInt(metadata.format.bit_rate) || 0
                    };
                    if (videoStream) {
                        result.resolution = `${videoStream.width}x${videoStream.height}`;
                        result.codec = videoStream.codec_name;
                    } else if (audioStream) {
                        result.resolution = `${audioStream.sample_rate}Hz`;
                        result.codec = audioStream.codec_name;
                    } else {
                        result.resolution = 'Desconhecido';
                        result.codec = 'unknown';
                    }
                    resolve(result);
                } catch (parseError) {
                    reject(new Error(`Erro metadados: ${parseError.message}`));
                }
            });
        });
    }

    async startUnification(processId, fileIds, config) {
        const processInfo = {
            id: processId, status: 'iniciando', progress: 0,
            startTime: Date.now(),
            fileName: `${config.outputName || 'media_unificado'}.${config.format || 'mp4'}`,
            outputPath: null, error: null
        };
        this.processes.set(processId, processInfo);
        this.broadcast({ type: 'processUpdate', data: processInfo });
        try {
            const files = fileIds.map(id => this.uploadedFiles.get(id)).filter(Boolean);
            if (files.length < 2) throw new Error('Arquivos insuficientes');
            console.log(`🎬 Processamento web: ${files.length} arquivo(s)`);
            const outputPath = path.join(this.outputDir, `${processId}_${processInfo.fileName}`);
            processInfo.outputPath = outputPath;
            const listPath = path.join(this.tempDir, `list_${processId}.txt`);
            const listContent = files.map(f => `file '${f.path.replace(/\\/g, '/')}'`).join('\n');
            fs.writeFileSync(listPath, listContent, 'utf8');
            let command = ffmpeg().input(listPath).inputOptions(['-f', 'concat', '-safe', '0']);
            this.applyWebConfig(command, config, files);
            processInfo.status = 'processando';
            this.broadcast({ type: 'processUpdate', data: processInfo });
            command
                .on('start', () => console.log(`🎬 FFmpeg web iniciado`))
                .on('progress', (progress) => {
                    processInfo.progress = Math.min(Math.max(progress.percent || 0, 0), 100);
                    processInfo.speed = progress.currentKbps ? `${(progress.currentKbps / 1000).toFixed(2)} MB/s` : 'Calculando...';
                    this.broadcast({ type: 'processUpdate', data: processInfo });
                })
                .on('end', () => {
                    processInfo.status = 'concluído';
                    processInfo.progress = 100;
                    processInfo.endTime = Date.now();
                    console.log(`✅ Processamento web concluído: ${processInfo.fileName}`);
                    this.broadcast({ type: 'processUpdate', data: processInfo });
                    this.cleanup(files, listPath);
                })
                .on('error', (err) => {
                    processInfo.status = 'erro';
                    processInfo.error = err.message;
                    console.error(`❌ Erro FFmpeg web:`, err.message);
                    this.broadcast({ type: 'processUpdate', data: processInfo });
                    this.cleanup(files, listPath);
                    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                })
                .save(outputPath);
        } catch (error) {
            console.error(`❌ Erro processamento web:`, error);
            processInfo.status = 'erro';
            processInfo.error = error.message;
            this.broadcast({ type: 'processUpdate', data: processInfo });
        }
    }

    applyWebConfig(command, config, files) {
        const hasVideo = files.some(f => f.type === 'video');
        if (config.quality === 'copy') {
            command.outputOptions(['-c', 'copy']);
        } else if (hasVideo) {
            command.videoCodec('libx264').audioCodec('aac').outputOptions(['-crf', '23', '-preset', 'fast', '-b:a', '192k', '-threads', '2', '-movflags', '+faststart']);
        } else {
            command.audioCodec('libmp3lame').outputOptions(['-b:a', '192k', '-threads', '2']);
        }
    }

    cleanup(files, listPath) {
        files.forEach(file => {
            if (fs.existsSync(file.path)) { try { fs.unlinkSync(file.path); } catch {} }
            this.uploadedFiles.delete(file.id);
        });
        if (fs.existsSync(listPath)) { try { fs.unlinkSync(listPath); } catch {} }
    }

    setupWebSocket() {
        // ### CORREÇÃO APLICADA AQUI ###
        // Em vez de criar um novo servidor em uma nova porta,
        // vamos anexar o WebSocket ao servidor HTTP existente.
        this.wss = new WebSocket.Server({ 
            server: this.server, // Reutiliza o servidor HTTP
            perMessageDeflate: false 
        });
        
        this.wss.on('connection', (ws, req) => {
            console.log(`🔌 Cliente web conectado`);
            ws.send(JSON.stringify({ type: 'connected', data: { message: 'Conectado ao servidor web' } }));
            ws.on('close', () => console.log('🔌 Cliente web desconectado'));
        });

        // A porta já é a mesma do servidor HTTP, não precisa de log separado.
        console.log(`🔌 WebSocket pronto e compartilhando a porta ${this.port}`);
    }

    broadcast(message) {
        if (!this.wss) return;
        const data = JSON.stringify(message);
        this.wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                try { client.send(data); } catch (error) { console.error('❌ Erro envio web:', error); }
            }
        });
    }

    start() {
        return new Promise((resolve, reject) => {
            // AQUI, o this.app.listen CRIA e INICIA o servidor.
            // Nós o salvamos em this.server para que o WebSocket possa usá-lo.
            this.server = this.app.listen(this.port, () => {
                console.log('\n🌐 =====================================');
                console.log('🎬🎵 UNIFICADOR WEB v2.0');
                console.log('🌐 =====================================');
                console.log(`🌍 Servidor pronto na porta ${this.port}`);
                console.log(`📁 Temp: ${this.tempDir}`);
                console.log('=====================================\n');
                
                // Agora configuramos o WebSocket para usar o servidor JÁ CRIADO.
                this.setupWebSocket();
                
                resolve();
            }).on('error', reject);
        });
    }

    stop() {
        if (this.wss) {
            this.wss.close();
            console.log('🔴 WebSocket web parado');
        }
        if (this.server) {
            this.server.close();
            console.log('🔴 Servidor web parado');
        }
    }
}

// Exportar
module.exports = MediaServerWeb;

// Executar se chamado diretamente
if (require.main === module) {
    const server = new MediaServerWeb();
    server.start().catch(err => {
        console.error('❌ Erro fatal ao iniciar servidor web:', err);
        process.exit(1);
    });

    // Tratamento limpo de parada
    const shutdown = () => {
        console.log('\n🛑 Parando servidor web...');
        server.stop();
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}