const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

// Expor APIs seguras para o renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    // Seleção de arquivos - CORRIGIDO
    selectFiles: async () => {
        try {
            return await ipcRenderer.invoke('select-files');
        } catch (error) {
            console.error('Erro ao selecionar arquivos:', error);
            return { canceled: true, error: error.message };
        }
    },
    
    // Seleção de pasta de saída
    selectOutputFolder: async () => {
        try {
            return await ipcRenderer.invoke('select-output-folder');
        } catch (error) {
            console.error('Erro ao selecionar pasta:', error);
            return { canceled: true, error: error.message };
        }
    },
    
    // Mostrar arquivo no explorador
    showInFolder: async (filePath) => {
        try {
            return await ipcRenderer.invoke('show-in-folder', filePath);
        } catch (error) {
            console.error('Erro ao abrir pasta:', error);
            return { success: false, error: error.message };
        }
    },
    
    // Informações do sistema
    platform: process.platform,
    isElectron: true,
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    
    // Utilitários para arquivo - ADICIONADO
    getFileStats: (filePath) => {
        try {
            return fs.statSync(filePath);
        } catch (error) {
            return null;
        }
    },
    
    pathBasename: (filePath) => {
        return path.basename(filePath);
    },
    
    // Controles da janela
    minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
    closeApp: () => ipcRenderer.invoke('close-app'),
    
    // Receber notificações
    onNotification: (callback) => {
        ipcRenderer.on('app-notification', (event, data) => callback(data));
    },
    
    // Remover listeners
    removeAllListeners: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    }
});

// Detectar ambiente Electron
window.isElectron = true;
window.electronVersion = process.versions.electron;

// Configurações específicas do Electron
document.addEventListener('DOMContentLoaded', () => {
    // Desabilitar menu de contexto em produção
    if (process.env.NODE_ENV !== 'development') {
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    // Desabilitar zoom
    document.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
        }
    }, { passive: false });

    // Desabilitar atalhos de teclado problemáticos
    document.addEventListener('keydown', (e) => {
        // F12 (DevTools) em produção
        if (e.key === 'F12' && process.env.NODE_ENV !== 'development') {
            e.preventDefault();
        }
        
        // Ctrl + Zoom
        if (e.ctrlKey && ['+', '-', '0'].includes(e.key)) {
            e.preventDefault();
        }
        
        // F5 (Refresh)
        if (e.key === 'F5') {
            e.preventDefault();
        }
        
        // Ctrl+R (Refresh)
        if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
        }
    });

    // Configurar título
    document.title = 'Unificador de Mídia Pro v2.0';

    // Adicionar classe CSS para Electron
    document.body.classList.add('electron-app');

    // Log de inicialização
    console.log('✅ Preload carregado - Electron v' + process.versions.electron);
    
    // Notificar que está pronto
    setTimeout(() => {
        console.log('🚀 Aplicação Electron totalmente carregada');
    }, 1000);
});

// Prevenir navegação acidental
window.addEventListener('beforeunload', (e) => {
    // Verificar se há trabalho não salvo
    if (window.app && window.app.files && window.app.files.length > 0) {
        e.preventDefault();
        e.returnValue = 'Você tem arquivos carregados. Tem certeza que deseja sair?';
        return e.returnValue;
    }
});

// Capturar erros globais para debugging
window.addEventListener('error', (e) => {
    console.error('❌ Erro global:', {
        message: e.message,
        filename: e.filename,
        line: e.lineno,
        column: e.colno,
        error: e.error
    });
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('❌ Promise rejeitada:', e.reason);
});

// Utilitários de debug (apenas em desenvolvimento)
if (process.env.NODE_ENV === 'development') {
    window.electronDebug = {
        versions: process.versions,
        platform: process.platform,
        selectFiles: () => window.electronAPI.selectFiles(),
        selectFolder: () => window.electronAPI.selectOutputFolder(),
        minimize: () => window.electronAPI.minimizeWindow(),
        close: () => window.electronAPI.closeApp(),
        getStats: (path) => window.electronAPI.getFileStats(path)
    };
    
    console.log('🔧 Debug utilities: window.electronDebug');
}

// CORRIGIDO - Expor path para uso no frontend
window.path = {
    basename: (filePath) => path.basename(filePath),
    extname: (filePath) => path.extname(filePath),
    dirname: (filePath) => path.dirname(filePath)
};