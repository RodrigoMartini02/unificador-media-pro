const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// CORRIGIDO - Importar servidor corretamente
let MediaServer;
try {
    MediaServer = require('./server.js');
} catch (error) {
    console.error('❌ Erro ao importar server.js:', error.message);
    process.exit(1);
}

class MediaUnifierApp {
    constructor() {
        this.mainWindow = null;
        this.server = null;
        this.serverPort = 3005; // MUDANÇA: Porta diferente
        this.isDev = process.env.NODE_ENV === 'development';
    }

    async init() {
        console.log('🚀 Iniciando Unificador de Mídia Pro...');
        
        await app.whenReady();
        
        // Iniciar servidor primeiro
        await this.startServer();
        
        // Criar janela
        this.createWindow();
        
        this.setupAppEvents();
        this.setupIPC();
    }

    async startServer() {
        try {
            console.log(`🌐 Iniciando servidor na porta ${this.serverPort}...`);
            this.server = new MediaServer(this.serverPort);
            await this.server.start();
            console.log(`✅ Servidor iniciado na porta ${this.serverPort}`);
        } catch (error) {
            console.error('❌ Erro ao iniciar servidor:', error);
            
            // Tentar porta alternativa
            if (error.code === 'EADDRINUSE') {
                console.log('🔄 Tentando porta alternativa...');
                this.serverPort = await this.findAvailablePort();
                try {
                    this.server = new MediaServer(this.serverPort);
                    await this.server.start();
                    console.log(`✅ Servidor iniciado na porta ${this.serverPort}`);
                    return;
                } catch (retryError) {
                    console.error('❌ Erro na segunda tentativa:', retryError);
                }
            }
            
            dialog.showErrorBox('Erro do Sistema', 'Falha ao iniciar o servidor interno: ' + error.message);
            app.quit();
        }
    }

    async findAvailablePort() {
        const net = require('net');
        
        for (let port = 3005; port <= 3020; port++) {
            if (await this.isPortAvailable(port)) {
                return port;
            }
        }
        throw new Error('Nenhuma porta disponível encontrada');
    }

    isPortAvailable(port) {
        return new Promise((resolve) => {
            const server = net.createServer();
            server.listen(port, () => {
                server.close(() => resolve(true));
            });
            server.on('error', () => resolve(false));
        });
    }

    createWindow() {
        console.log('🖥️ Criando janela principal...');
        
        this.mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            minWidth: 900,
            minHeight: 600,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.js'),
                webSecurity: true
            },
            titleBarStyle: 'default',
            center: true,
            show: false,
            title: 'Unificador de Mídia Pro',
            icon: this.getAppIcon()
        });

        // Remover menu
        this.mainWindow.setMenuBarVisibility(false);

        // Aguardar servidor estar pronto antes de carregar
        setTimeout(() => {
            console.log(`🌐 Carregando interface em http://localhost:${this.serverPort}`);
            this.mainWindow.loadURL(`http://localhost:${this.serverPort}`)
                .then(() => {
                    console.log('✅ Interface carregada com sucesso');
                })
                .catch(err => {
                    console.error('❌ Erro ao carregar interface:', err);
                    dialog.showErrorBox('Erro', 'Falha ao carregar a interface: ' + err.message);
                });
        }, 3000); // Aguardar 3 segundos para garantir

        // Mostrar quando carregada
        this.mainWindow.once('ready-to-show', () => {
            console.log('✅ Janela pronta - exibindo aplicação');
            this.mainWindow.show();
            if (this.isDev) {
                this.mainWindow.webContents.openDevTools();
            }
        });

        this.mainWindow.on('closed', () => {
            console.log('🔴 Janela fechada pelo usuário');
            this.mainWindow = null;
            if (this.server) {
                this.server.stop();
            }
            app.quit();
        });

        // Debug detalhado
        this.mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
            console.error('❌ Falha ao carregar:', {
                errorCode,
                errorDescription,
                url: validatedURL
            });
        });

        this.mainWindow.webContents.on('did-finish-load', () => {
            console.log('✅ Conteúdo da página carregado completamente');
        });

        this.mainWindow.webContents.on('dom-ready', () => {
            console.log('✅ DOM da página está pronto');
        });
    }

    getAppIcon() {
        // Tentar encontrar ícone
        const iconPaths = [
            path.join(__dirname, 'assets', 'icon.png'),
            path.join(__dirname, 'assets', 'icon.ico')
        ];

        for (const iconPath of iconPaths) {
            if (fs.existsSync(iconPath)) {
                return iconPath;
            }
        }
        return null; // Usar ícone padrão
    }

    setupAppEvents() {
        app.on('window-all-closed', () => {
            console.log('🔴 Todas as janelas fechadas');
            if (this.server) {
                this.server.stop();
            }
            app.quit();
        });

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                console.log('🔄 Reativando aplicação...');
                this.createWindow();
            }
        });

        app.on('before-quit', () => {
            console.log('🔴 Preparando para encerrar...');
            if (this.server) {
                this.server.stop();
            }
        });
    }

    setupIPC() {
        ipcMain.handle('select-files', async () => {
            try {
                const result = await dialog.showOpenDialog(this.mainWindow, {
                    properties: ['openFile', 'multiSelections'],
                    filters: [
                        { name: 'Arquivos de Mídia', extensions: ['mp4', 'avi', 'mov', 'mkv', 'mp3', 'wav', 'flac', 'm4a'] },
                        { name: 'Vídeos', extensions: ['mp4', 'avi', 'mov', 'mkv', 'webm'] },
                        { name: 'Áudios', extensions: ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg'] }
                    ]
                });
                return result;
            } catch (error) {
                console.error('❌ Erro ao selecionar arquivos:', error);
                return { canceled: true };
            }
        });

        ipcMain.handle('select-output-folder', async () => {
            try {
                const result = await dialog.showOpenDialog(this.mainWindow, {
                    properties: ['openDirectory']
                });
                return result;
            } catch (error) {
                console.error('❌ Erro ao selecionar pasta:', error);
                return { canceled: true };
            }
        });

        ipcMain.handle('show-in-folder', (event, filePath) => {
            try {
                shell.showItemInFolder(filePath);
                return { success: true };
            } catch (error) {
                console.error('❌ Erro ao abrir pasta:', error);
                return { success: false, error: error.message };
            }
        });
    }
}

// Configurações do Electron
app.commandLine.appendSwitch('--disable-web-security');
app.setName('Unificador de Mídia Pro');

// Tratamento de erros não capturadas
process.on('uncaughtException', (error) => {
    console.error('❌ Erro não capturado:', error);
    dialog.showErrorBox('Erro Fatal', error.message);
    app.quit();
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promise rejeitada:', reason);
});

// Prevenir múltiplas instâncias
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    console.log('❌ Aplicação já está rodando - fechando esta instância');
    app.quit();
} else {
    // Inicializar aplicação
    const mediaApp = new MediaUnifierApp();
    
    app.on('second-instance', () => {
        // Focar na janela existente se tentar abrir segunda instância
        console.log('🔄 Segunda instância detectada - focando janela existente');
        if (mediaApp.mainWindow) {
            if (mediaApp.mainWindow.isMinimized()) {
                mediaApp.mainWindow.restore();
            }
            mediaApp.mainWindow.focus();
        }
    });

    mediaApp.init().catch(error => {
        console.error('❌ Erro fatal na inicialização:', error);
        dialog.showErrorBox('Erro Fatal', 'Falha ao inicializar: ' + error.message);
        app.quit();
    });
}