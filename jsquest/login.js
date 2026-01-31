/**
 * Sistema de Login - Autenticação JWT via API
 * Gerencia login, logout e recuperação de senha
 */

// ================================================================
// CONFIGURAÇÃO DA API
// ================================================================

const AUTH_API_URL = '/api';

const authApi = {
    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        try {
            const response = await fetch(`${AUTH_API_URL}${endpoint}`, { ...options, headers });
            const data = await response.json();

            if (!response.ok) {
                throw { status: response.status, ...data };
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    async login(cpf, password) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ cpf, password })
        });
    },

    async forgotPassword(email) {
        return this.request('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
    },

    async verifyCode(email, code) {
        return this.request('/auth/verify-code', {
            method: 'POST',
            body: JSON.stringify({ email, code })
        });
    },

    async resetPassword(email, code, newPassword) {
        return this.request('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ email, code, newPassword })
        });
    }
};

// ================================================================
// VARIÁVEIS GLOBAIS
// ================================================================

let elementos = {};

// ================================================================
// INICIALIZAÇÃO
// ================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('Sistema de login carregado...');
    inicializarSistema();
});

function inicializarSistema() {
    try {
        elementos = obterElementosDOM();
        configurarEventos();
        inicializarModais();

        console.log('Sistema de login pronto');
    } catch (error) {
        console.error('Erro na inicialização:', error);
    }
}

function obterElementosDOM() {
    return {
        // Modais
        loginModal: document.getElementById('loginModal'),
        recuperacaoModal: document.getElementById('recuperacaoSenhaModal'),
        novaSenhaModal: document.getElementById('novaSenhaModal'),

        // Botões principais
        openLoginModalBtn: document.getElementById('openLoginModalBtn'),
        esqueceuSenhaBtn: document.getElementById('modal-esqueceu-senha'),
        recuperacaoAbrirLoginBtn: document.getElementById('recuperacao-abrir-login'),

        // Botões de fechar
        loginCloseBtn: document.querySelector('.login-close'),
        recuperacaoCloseBtn: document.querySelector('.recuperacao-close'),
        novaSenhaCloseBtn: document.querySelector('.nova-senha-close'),

        // Formulários
        loginForm: document.getElementById('modal-login-form'),
        formRecuperacao: document.getElementById('form-recuperacao-senha'),
        formNovaSenha: document.getElementById('form-nova-senha'),

        // Mensagens
        modalErrorMessage: document.getElementById('modal-error-message'),
        recuperacaoErrorMessage: document.getElementById('recuperacao-error-message'),
        recuperacaoSuccessMessage: document.getElementById('recuperacao-success-message'),
        novaSenhaErrorMessage: document.getElementById('nova-senha-error-message'),
        novaSenhaSuccessMessage: document.getElementById('nova-senha-success-message')
    };
}

// ================================================================
// CONFIGURAÇÃO DE EVENTOS
// ================================================================

function configurarEventos() {
    // Abrir modal de login
    const openLoginBtn = document.getElementById('openLoginModalBtn');
    if (openLoginBtn) {
        openLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            abrirModal(elementos.loginModal);
        });
    }

    // Login
    if (elementos.loginForm) {
        elementos.loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await processarLogin();
        });
    }

    // Esqueceu senha
    if (elementos.esqueceuSenhaBtn) {
        elementos.esqueceuSenhaBtn.addEventListener('click', (e) => {
            e.preventDefault();
            fecharModal(elementos.loginModal);
            abrirModal(elementos.recuperacaoModal);
        });
    }

    // Voltar ao login da recuperação
    if (elementos.recuperacaoAbrirLoginBtn) {
        elementos.recuperacaoAbrirLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            fecharModal(elementos.recuperacaoModal);
            abrirModal(elementos.loginModal);
        });
    }

    // Recuperação de senha
    if (elementos.formRecuperacao) {
        elementos.formRecuperacao.addEventListener('submit', async (e) => {
            e.preventDefault();
            await processarRecuperacao();
        });
    }

    // Nova senha
    if (elementos.formNovaSenha) {
        elementos.formNovaSenha.addEventListener('submit', async (e) => {
            e.preventDefault();
            await processarNovaSenha();
        });
    }

    // Botões de fechar
    const closeButtons = [
        { btn: elementos.loginCloseBtn, modal: elementos.loginModal },
        { btn: elementos.recuperacaoCloseBtn, modal: elementos.recuperacaoModal },
        { btn: elementos.novaSenhaCloseBtn, modal: elementos.novaSenhaModal }
    ];

    closeButtons.forEach(({ btn, modal }) => {
        if (btn) {
            btn.addEventListener('click', () => fecharModal(modal));
        }
    });

    // Fechar clicando fora
    window.addEventListener('click', (event) => {
        const modais = [elementos.loginModal, elementos.recuperacaoModal, elementos.novaSenhaModal];
        modais.forEach(modal => {
            if (event.target === modal) {
                fecharModal(modal);
            }
        });
    });

    // Fechar com ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modais = [elementos.loginModal, elementos.recuperacaoModal, elementos.novaSenhaModal];
            modais.forEach(modal => {
                if (modal && !modal.classList.contains('hidden')) {
                    fecharModal(modal);
                }
            });
        }
    });

    // Limpar mensagens ao digitar
    configurarLimpezaMensagens();

    // Formatação de documento
    const campoDocumento = document.getElementById('modal-documento');
    if (campoDocumento) {
        campoDocumento.addEventListener('input', () => formatarDocumento(campoDocumento));
    }
}

// ================================================================
// PROCESSO DE LOGIN
// ================================================================

async function processarLogin() {
    const documento = document.getElementById('modal-documento')?.value?.trim();
    const password = document.getElementById('modal-password')?.value?.trim();
    const botaoSubmit = elementos.loginForm?.querySelector('button[type="submit"]');

    // Limpar mensagem de erro
    ocultarMensagem(elementos.modalErrorMessage);

    if (!documento || !password) {
        mostrarErroLogin('Todos os campos são obrigatórios');
        return;
    }

    setLoadingState(botaoSubmit, true, 'Entrando...');

    try {
        const docLimpo = documento.replace(/[^\d]+/g, '');

        // Chamar API de login
        const response = await authApi.login(docLimpo, password);

        if (response.token) {
            // Salvar token e dados do usuário
            localStorage.setItem('auth_token', response.token);
            localStorage.setItem('user', JSON.stringify(response.user));

            // Redirecionar para o dashboard
            window.location.href = 'index.html';
        } else {
            mostrarErroLogin('Erro ao realizar login');
        }

    } catch (error) {
        console.error('Erro durante login:', error);

        if (error.status === 401) {
            mostrarErroLogin('Documento ou senha incorretos');
        } else if (error.message) {
            mostrarErroLogin(error.message);
        } else {
            mostrarErroLogin('Erro no servidor. Tente novamente.');
        }

        // Limpar senha
        const passwordField = document.getElementById('modal-password');
        if (passwordField) passwordField.value = '';

    } finally {
        setLoadingState(botaoSubmit, false, 'Entrar');
    }
}

// ================================================================
// RECUPERAÇÃO DE SENHA
// ================================================================

let recuperacaoEmail = '';

async function processarRecuperacao() {
    const email = document.getElementById('recuperacao-email')?.value?.trim();
    const codigo = document.getElementById('codigo-recuperacao')?.value?.trim();
    const botaoSubmit = elementos.formRecuperacao?.querySelector('button[type="submit"]');

    // Limpar mensagens
    ocultarMensagem(elementos.recuperacaoErrorMessage);
    ocultarMensagem(elementos.recuperacaoSuccessMessage);

    if (!email) {
        mostrarErroRecuperacao('Por favor, informe seu email');
        return;
    }

    setLoadingState(botaoSubmit, true, 'Enviando...');

    try {
        if (!codigo) {
            // Primeira etapa: solicitar código
            await authApi.forgotPassword(email);

            recuperacaoEmail = email;
            mostrarSucessoRecuperacao('Código enviado! Verifique seu email.');

            // Mostrar campo do código
            const campoCodigoContainer = document.getElementById('campo-codigo-container');
            if (campoCodigoContainer) {
                campoCodigoContainer.classList.remove('hidden');
            }

            // Alterar texto do botão
            setLoadingState(botaoSubmit, false, 'Verificar Código');

        } else {
            // Segunda etapa: verificar código
            const response = await authApi.verifyCode(recuperacaoEmail || email, codigo);

            if (response.valid) {
                // Código válido, ir para nova senha
                fecharModal(elementos.recuperacaoModal);

                // Passar email para modal de nova senha
                const emailNovaSenhaField = document.getElementById('email-nova-senha');
                if (emailNovaSenhaField) {
                    emailNovaSenhaField.value = recuperacaoEmail || email;
                }

                // Salvar código para uso na redefinição
                sessionStorage.setItem('reset_code', codigo);

                abrirModal(elementos.novaSenhaModal);
            } else {
                mostrarErroRecuperacao('Código inválido ou expirado');
            }
        }

    } catch (error) {
        console.error('Erro na recuperação:', error);

        if (error.status === 404) {
            mostrarErroRecuperacao('Email não encontrado no sistema');
        } else if (error.message) {
            mostrarErroRecuperacao(error.message);
        } else {
            mostrarErroRecuperacao('Erro no sistema. Tente novamente.');
        }
    } finally {
        if (botaoSubmit && botaoSubmit.textContent === 'Enviando...') {
            setLoadingState(botaoSubmit, false, 'Enviar Código');
        }
    }
}

async function processarNovaSenha() {
    const email = document.getElementById('email-nova-senha')?.value?.trim();
    const novaSenha = document.getElementById('nova-senha')?.value?.trim();
    const confirmarSenha = document.getElementById('confirmar-nova-senha')?.value?.trim();
    const botaoSubmit = elementos.formNovaSenha?.querySelector('button[type="submit"]');
    const code = sessionStorage.getItem('reset_code');

    // Limpar mensagens
    ocultarMensagem(elementos.novaSenhaErrorMessage);
    ocultarMensagem(elementos.novaSenhaSuccessMessage);

    // Validações
    if (!novaSenha || !confirmarSenha) {
        mostrarErroNovaSenha('Todos os campos são obrigatórios');
        return;
    }

    if (novaSenha !== confirmarSenha) {
        mostrarErroNovaSenha('As senhas não coincidem');
        return;
    }

    if (novaSenha.length < 4) {
        mostrarErroNovaSenha('A senha deve ter pelo menos 4 caracteres');
        return;
    }

    setLoadingState(botaoSubmit, true, 'Alterando...');

    try {
        await authApi.resetPassword(email, code, novaSenha);

        mostrarSucessoNovaSenha('Senha alterada com sucesso!');
        sessionStorage.removeItem('reset_code');

        // Voltar ao login após 2 segundos
        setTimeout(() => {
            fecharModal(elementos.novaSenhaModal);
            abrirModal(elementos.loginModal);
        }, 2000);

    } catch (error) {
        console.error('Erro ao alterar senha:', error);

        if (error.message) {
            mostrarErroNovaSenha(error.message);
        } else {
            mostrarErroNovaSenha('Erro ao alterar senha. Tente novamente.');
        }
    } finally {
        setLoadingState(botaoSubmit, false, 'Alterar Senha');
    }
}

// ================================================================
// GERENCIAMENTO DE MODAIS
// ================================================================

function abrirModal(modal) {
    if (modal) {
        modal.classList.remove('hidden');

        // Focus no primeiro input
        const firstInput = modal.querySelector('input:not([type="hidden"])');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    }
}

function fecharModal(modal) {
    if (modal) {
        modal.classList.add('hidden');

        const form = modal.querySelector('form');
        if (form) form.reset();

        // Ocultar mensagens
        const messages = modal.querySelectorAll('.error-message, .success-message');
        messages.forEach(msg => {
            msg.classList.add('hidden');
        });

        // Resetar campo de código
        const campoCode = modal.querySelector('#campo-codigo-container');
        if (campoCode) {
            campoCode.classList.add('hidden');
        }

        // Resetar botão
        const botao = modal.querySelector('button[type="submit"]');
        if (botao) {
            botao.disabled = false;
            botao.classList.remove('btn-loading');
        }
    }
}

function inicializarModais() {
    const modais = [elementos.loginModal, elementos.recuperacaoModal, elementos.novaSenhaModal];
    modais.forEach(modal => {
        if (modal) {
            modal.classList.add('hidden');
        }
    });

    // Ocultar todas as mensagens
    const mensagens = [
        elementos.modalErrorMessage,
        elementos.recuperacaoErrorMessage,
        elementos.recuperacaoSuccessMessage,
        elementos.novaSenhaErrorMessage,
        elementos.novaSenhaSuccessMessage
    ];

    mensagens.forEach(msg => {
        if (msg) {
            msg.classList.add('hidden');
        }
    });

    // Ocultar campo de código
    const campoCode = document.getElementById('campo-codigo-container');
    if (campoCode) {
        campoCode.classList.add('hidden');
    }
}

// ================================================================
// FUNÇÕES DE MENSAGENS
// ================================================================

function ocultarMensagem(elemento) {
    if (elemento) {
        elemento.classList.add('hidden');
    }
}

function mostrarMensagem(elemento, mensagem, tipo = 'error') {
    if (elemento) {
        elemento.textContent = mensagem;
        elemento.classList.remove('hidden');
    }
}

function mostrarErroLogin(mensagem) {
    mostrarMensagem(elementos.modalErrorMessage, mensagem, 'error');
}

function mostrarErroRecuperacao(mensagem) {
    mostrarMensagem(elementos.recuperacaoErrorMessage, mensagem, 'error');
}

function mostrarSucessoRecuperacao(mensagem) {
    mostrarMensagem(elementos.recuperacaoSuccessMessage, mensagem, 'success');
}

function mostrarErroNovaSenha(mensagem) {
    mostrarMensagem(elementos.novaSenhaErrorMessage, mensagem, 'error');
}

function mostrarSucessoNovaSenha(mensagem) {
    mostrarMensagem(elementos.novaSenhaSuccessMessage, mensagem, 'success');
}

function configurarLimpezaMensagens() {
    const campos = [
        { id: 'modal-documento', mensagem: elementos.modalErrorMessage },
        { id: 'modal-password', mensagem: elementos.modalErrorMessage },
        { id: 'recuperacao-email', mensagem: elementos.recuperacaoErrorMessage },
        { id: 'codigo-recuperacao', mensagem: elementos.recuperacaoErrorMessage },
        { id: 'nova-senha', mensagem: elementos.novaSenhaErrorMessage },
        { id: 'confirmar-nova-senha', mensagem: elementos.novaSenhaErrorMessage }
    ];

    campos.forEach(({ id, mensagem }) => {
        const campo = document.getElementById(id);
        if (campo && mensagem) {
            campo.addEventListener('input', () => ocultarMensagem(mensagem));
        }
    });
}

// ================================================================
// UTILITÁRIOS
// ================================================================

function formatarDocumento(input) {
    let documento = input.value.replace(/\D/g, '');

    if (documento.length <= 11) {
        // CPF: 000.000.000-00
        documento = documento.replace(/(\d{3})(\d)/, '$1.$2');
        documento = documento.replace(/(\d{3})(\d)/, '$1.$2');
        documento = documento.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
        // CNPJ: 00.000.000/0000-00
        documento = documento.replace(/^(\d{2})(\d)/, '$1.$2');
        documento = documento.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
        documento = documento.replace(/\.(\d{3})(\d)/, '.$1/$2');
        documento = documento.replace(/(\d{4})(\d)/, '$1-$2');
    }

    input.value = documento.substring(0, 18);
}

function setLoadingState(button, loading = true, text = '') {
    if (!button) return;

    if (loading) {
        button.disabled = true;
        button.dataset.originalText = button.textContent;
        button.textContent = text || 'Carregando...';
        button.classList.add('btn-loading');
    } else {
        button.disabled = false;
        button.textContent = text || button.dataset.originalText || 'Enviar';
        button.classList.remove('btn-loading');
    }
}

// ================================================================
// FUNÇÕES GLOBAIS
// ================================================================

function togglePassword(inputId, button) {
    const input = document.getElementById(inputId);
    const icon = button.querySelector('i');

    if (!input || !icon) return;

    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
        button.setAttribute('aria-label', 'Ocultar senha');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
        button.setAttribute('aria-label', 'Mostrar senha');
    }
}

// Verificar se já está logado
function verificarAutenticacao() {
    const token = localStorage.getItem('auth_token');
    return !!token;
}

// Logout
function logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    window.location.href = 'quest.html';
}

// Exportar para escopo global
window.togglePassword = togglePassword;
window.verificarAutenticacao = verificarAutenticacao;
window.logout = logout;
