document.addEventListener('DOMContentLoaded', function() {
    console.log('Sistema de login carregado...');
    inicializarSistema();
});

// ================================================================
// USUÁRIOS HARDCODED
// ================================================================

const USUARIOS = [
    {
        nome: "Administrador",
        email: "admin@sistema.com",
        documento: "08996441988",
        password: "0000"
    },
    {
        nome: "João Silva",
        email: "joao@email.com", 
        documento: "12345678901",
        password: "123456"
    }
];

// ================================================================
// VARIÁVEIS GLOBAIS
// ================================================================

let elementos = {};
let emailJSDisponivel = false;

const EMAIL_CONFIG = {
    serviceId: 'service_financas',
    templateId: 'template_recuperacao', 
    userId: 'oW3fgPbnchMKc42Yf'
};

// ================================================================
// INICIALIZAÇÃO
// ================================================================

function inicializarSistema() {
    try {
        elementos = obterElementosDOM();
        configurarEventos();
        inicializarModais();
        carregarEmailJS();
        
        console.log('Sistema pronto');
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

function carregarEmailJS() {
    if (!window.emailjs) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
        script.onload = () => {
            try {
                emailjs.init(EMAIL_CONFIG.userId);
                emailJSDisponivel = true;
                console.log('EmailJS carregado');
            } catch (e) {
                console.warn('EmailJS erro:', e);
            }
        };
        script.onerror = () => console.warn('EmailJS falhou');
        document.head.appendChild(script);
    } else {
        emailJSDisponivel = true;
    }
}

// ================================================================
// CONFIGURAÇÃO DE EVENTOS
// ================================================================

// Adicione esta função no final do arquivo jsquest/login.js
// ou substitua a função configurarEventos() existente

function configurarEventos() {
    // Abrir modal de login - CORREÇÃO AQUI
    const openLoginBtn = document.getElementById('openLoginModalBtn');
    if (openLoginBtn) {
        openLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Botão clicado - abrindo modal');
            abrirModal(elementos.loginModal);
        });
    } else {
        console.error('Botão openLoginModalBtn não encontrado!');
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
    
    // Limpar mensagens ao digitar
    configurarLimpezaMensagens();
    
    // Formatação de documento
    const campoDocumento = document.getElementById('modal-documento');
    if (campoDocumento) {
        campoDocumento.addEventListener('input', () => formatarDocumento(campoDocumento));
    }
}

// E certifique-se de que a função obterElementosDOM() inclui o botão:
function obterElementosDOM() {
    return {
        // Modais
        loginModal: document.getElementById('loginModal'),
        recuperacaoModal: document.getElementById('recuperacaoSenhaModal'),
        novaSenhaModal: document.getElementById('novaSenhaModal'),
        
        // Botões principais
        openLoginModalBtn: document.getElementById('openLoginModalBtn'), // ADICIONE ESTA LINHA SE NÃO EXISTIR
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
// PROCESSO DE LOGIN
// ================================================================

async function processarLogin() {
    const documento = document.getElementById('modal-documento')?.value?.trim();
    const password = document.getElementById('modal-password')?.value?.trim();
    const botaoSubmit = elementos.loginForm?.querySelector('button[type="submit"]');
    
    // Limpar mensagem de erro
    if (elementos.modalErrorMessage) {
        elementos.modalErrorMessage.style.display = 'none';
    }
    
    if (!documento || !password) {
        mostrarErroLogin('Todos os campos são obrigatórios');
        return;
    }
    
    setLoadingState(botaoSubmit, true);
    
    try {
        const docLimpo = documento.replace(/[^\d]+/g, '');
        
        // Buscar usuário
        const usuario = USUARIOS.find(u => 
            u.documento.replace(/[^\d]+/g, '') === docLimpo && 
            u.password === password
        );
        
        if (usuario) {
            // Login bem-sucedido
            sessionStorage.setItem('usuarioAtual', docLimpo);
            sessionStorage.setItem('dadosUsuarioLogado', JSON.stringify(usuario));
            
            console.log('Login bem-sucedido, redirecionando...');
            window.location.href = 'dados.html';
        } else {
            mostrarErroLogin('Documento ou senha incorretos');
            
            // Limpar senha
            const passwordField = document.getElementById('modal-password');
            if (passwordField) passwordField.value = '';
        }
        
    } catch (error) {
        console.error('Erro durante login:', error);
        mostrarErroLogin('Erro no sistema. Tente novamente.');
    } finally {
        setLoadingState(botaoSubmit, false);
    }
}

// ================================================================
// RECUPERAÇÃO DE SENHA
// ================================================================

async function processarRecuperacao() {
    const email = document.getElementById('recuperacao-email')?.value?.trim();
    const codigo = document.getElementById('codigo-recuperacao')?.value?.trim();
    const botaoSubmit = elementos.formRecuperacao?.querySelector('button[type="submit"]');
    
    // Limpar mensagens
    if (elementos.recuperacaoErrorMessage) elementos.recuperacaoErrorMessage.style.display = 'none';
    if (elementos.recuperacaoSuccessMessage) elementos.recuperacaoSuccessMessage.style.display = 'none';
    
    if (!email) {
        mostrarErroRecuperacao('Por favor, informe seu email');
        return;
    }
    
    setLoadingState(botaoSubmit, true);
    
    try {
        if (!codigo) {
            // Primeira etapa: enviar código
            const usuario = USUARIOS.find(u => u.email.toLowerCase() === email.toLowerCase());
            
            if (!usuario) {
                mostrarErroRecuperacao('Email não encontrado no sistema');
                return;
            }
            
            if (!emailJSDisponivel) {
                mostrarErroRecuperacao('Serviço de email temporariamente indisponível');
                return;
            }
            
            const codigoGerado = gerarCodigoRecuperacao();
            salvarCodigoRecuperacao(email, codigoGerado);
            
            const resultado = await enviarEmailRecuperacao(email, codigoGerado, usuario.nome);
            
            if (resultado.success) {
                mostrarSucessoRecuperacao('Código enviado! Verifique seu email.');
                
                // Mostrar campo do código
                const campoCodigoContainer = document.getElementById('campo-codigo-container');
                if (campoCodigoContainer) {
                    campoCodigoContainer.style.display = 'block';
                }
                
                // Alterar texto do botão
                if (botaoSubmit) {
                    botaoSubmit.textContent = 'Verificar Código';
                }
            } else {
                mostrarErroRecuperacao('Erro ao enviar email. Tente novamente.');
            }
            
        } else {
            // Segunda etapa: verificar código
            const verificacao = verificarCodigoRecuperacao(email, codigo);
            
            if (verificacao.valido) {
                // Código válido, ir para nova senha
                fecharModal(elementos.recuperacaoModal);
                
                // Passar email para modal de nova senha
                const emailNovaSenhaField = document.getElementById('email-nova-senha');
                if (emailNovaSenhaField) {
                    emailNovaSenhaField.value = email;
                }
                
                abrirModal(elementos.novaSenhaModal);
            } else {
                mostrarErroRecuperacao(verificacao.motivo || 'Código inválido');
            }
        }
        
    } catch (error) {
        console.error('Erro na recuperação:', error);
        mostrarErroRecuperacao('Erro no sistema. Tente novamente.');
    } finally {
        setLoadingState(botaoSubmit, false);
    }
}

async function processarNovaSenha() {
    const email = document.getElementById('email-nova-senha')?.value?.trim();
    const novaSenha = document.getElementById('nova-senha')?.value?.trim();
    const confirmarSenha = document.getElementById('confirmar-nova-senha')?.value?.trim();
    const botaoSubmit = elementos.formNovaSenha?.querySelector('button[type="submit"]');
    
    // Limpar mensagens
    if (elementos.novaSenhaErrorMessage) elementos.novaSenhaErrorMessage.style.display = 'none';
    if (elementos.novaSenhaSuccessMessage) elementos.novaSenhaSuccessMessage.style.display = 'none';
    
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
    
    setLoadingState(botaoSubmit, true);
    
    try {
        // Buscar usuário no array
        const usuarioIndex = USUARIOS.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
        
        if (usuarioIndex === -1) {
            mostrarErroNovaSenha('Usuário não encontrado');
            return;
        }
        
        // Atualizar senha no array
        USUARIOS[usuarioIndex].password = novaSenha;
        
        mostrarSucessoNovaSenha('Senha alterada com sucesso!');
        
        // Voltar ao login após 2 segundos
        setTimeout(() => {
            fecharModal(elementos.novaSenhaModal);
            abrirModal(elementos.loginModal);
        }, 2000);
        
    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        mostrarErroNovaSenha('Erro ao alterar senha.');
    } finally {
        setLoadingState(botaoSubmit, false);
    }
}

// ================================================================
// GERENCIAMENTO DE CÓDIGOS DE RECUPERAÇÃO
// ================================================================

function gerarCodigoRecuperacao() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function salvarCodigoRecuperacao(email, codigo) {
    const codigosRecuperacao = JSON.parse(localStorage.getItem('codigosRecuperacao') || '{}');
    codigosRecuperacao[email] = {
        codigo: codigo,
        expiracao: Date.now() + (15 * 60 * 1000), // 15 minutos
        tentativas: 0
    };
    localStorage.setItem('codigosRecuperacao', JSON.stringify(codigosRecuperacao));
}

function verificarCodigoRecuperacao(email, codigoInformado) {
    const codigosRecuperacao = JSON.parse(localStorage.getItem('codigosRecuperacao') || '{}');
    const dadosCodigo = codigosRecuperacao[email];
    
    if (!dadosCodigo) {
        return { valido: false, motivo: 'Código não encontrado' };
    }
    
    if (Date.now() > dadosCodigo.expiracao) {
        delete codigosRecuperacao[email];
        localStorage.setItem('codigosRecuperacao', JSON.stringify(codigosRecuperacao));
        return { valido: false, motivo: 'Código expirado (15 min)' };
    }
    
    if (dadosCodigo.tentativas >= 3) {
        return { valido: false, motivo: 'Muitas tentativas incorretas' };
    }
    
    if (dadosCodigo.codigo !== codigoInformado) {
        dadosCodigo.tentativas++;
        localStorage.setItem('codigosRecuperacao', JSON.stringify(codigosRecuperacao));
        return { valido: false, motivo: 'Código incorreto' };
    }
    
    // Código válido, remover do armazenamento
    delete codigosRecuperacao[email];
    localStorage.setItem('codigosRecuperacao', JSON.stringify(codigosRecuperacao));
    
    return { valido: true };
}

async function enviarEmailRecuperacao(email, codigo, nomeUsuario = 'Usuário') {
    try {
        if (!emailJSDisponivel || !window.emailjs) {
            throw new Error('EmailJS não disponível');
        }
        
        const templateParams = {
            to_email: email,
            to_name: nomeUsuario,
            codigo_recuperacao: codigo,
            validade: '15 minutos',
            sistema_nome: 'Sistema de Controle'
        };
        
        const response = await emailjs.send(
            EMAIL_CONFIG.serviceId, 
            EMAIL_CONFIG.templateId, 
            templateParams
        );
        
        console.log('Email enviado:', response);
        return { success: true, message: 'Email enviado com sucesso!' };
        
    } catch (error) {
        console.error('Erro ao enviar email:', error);
        return { success: false, message: 'Erro ao enviar email: ' + error.message };
    }
}

// ================================================================
// GERENCIAMENTO DE MODAIS
// ================================================================

function abrirModal(modal) {
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('show');
    }
}

function fecharModal(modal) {
    if (modal) {
        modal.classList.remove('show');
        modal.classList.add('hidden');
        const form = modal.querySelector('form');
        if (form) form.reset();
        
        const error = modal.querySelector('.error-message');
        const success = modal.querySelector('.success-message');
        if (error) error.style.display = 'none';
        if (success) success.style.display = 'none';
        
        const campoCode = modal.querySelector('#campo-codigo-container');
        if (campoCode) campoCode.style.display = 'none';
        
        const botao = modal.querySelector('button[type="submit"]');
        if (botao && botao.textContent === 'Verificar Código') {
            botao.textContent = 'Enviar Código';
        }
    }
}

function inicializarModais() {
    const modais = [elementos.loginModal, elementos.recuperacaoModal, elementos.novaSenhaModal];
    modais.forEach(modal => {
        if (modal) modal.style.display = 'none';
    });
    
    const mensagens = [
        elementos.modalErrorMessage,
        elementos.recuperacaoErrorMessage, elementos.recuperacaoSuccessMessage,
        elementos.novaSenhaErrorMessage, elementos.novaSenhaSuccessMessage
    ];
    
    mensagens.forEach(msg => {
        if (msg) msg.style.display = 'none';
    });
    
    // Ocultar campo de código inicialmente
    const campoCode = document.getElementById('campo-codigo-container');
    if (campoCode) campoCode.style.display = 'none';
}

// ================================================================
// FUNÇÕES DE MENSAGENS
// ================================================================

function mostrarErroLogin(mensagem) {
    if (elementos.modalErrorMessage) {
        elementos.modalErrorMessage.textContent = mensagem;
        elementos.modalErrorMessage.style.display = 'block';
    }
}

function mostrarErroRecuperacao(mensagem) {
    if (elementos.recuperacaoErrorMessage) {
        elementos.recuperacaoErrorMessage.textContent = mensagem;
        elementos.recuperacaoErrorMessage.style.display = 'block';
    }
}

function mostrarSucessoRecuperacao(mensagem) {
    if (elementos.recuperacaoSuccessMessage) {
        elementos.recuperacaoSuccessMessage.textContent = mensagem;
        elementos.recuperacaoSuccessMessage.style.display = 'block';
    }
}

function mostrarErroNovaSenha(mensagem) {
    if (elementos.novaSenhaErrorMessage) {
        elementos.novaSenhaErrorMessage.textContent = mensagem;
        elementos.novaSenhaErrorMessage.style.display = 'block';
    }
}

function mostrarSucessoNovaSenha(mensagem) {
    if (elementos.novaSenhaSuccessMessage) {
        elementos.novaSenhaSuccessMessage.textContent = mensagem;
        elementos.novaSenhaSuccessMessage.style.display = 'block';
    }
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
            campo.addEventListener('input', () => {
                mensagem.style.display = 'none';
            });
        }
    });
}

// ================================================================
// UTILITÁRIOS
// ================================================================

function formatarDocumento(input) {
    let documento = input.value.replace(/\D/g, '');
    
    if (documento.length <= 11) {
        // CPF
        documento = documento.replace(/(\d{3})(\d)/, '$1.$2');
        documento = documento.replace(/(\d{3})(\d)/, '$1.$2');
        documento = documento.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
        // CNPJ
        documento = documento.replace(/^(\d{2})(\d)/, '$1.$2');
        documento = documento.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
        documento = documento.replace(/\.(\d{3})(\d)/, '.$1/$2');
        documento = documento.replace(/(\d{4})(\d)/, '$1-$2');
    }
    
    input.value = documento.substring(0, 18);
}

function setLoadingState(button, loading = true) {
    if (!button) return;
    
    if (loading) {
        button.disabled = true;
        button.textContent = 'Carregando...';
        button.style.opacity = '0.7';
    } else {
        button.disabled = false;
        if (button.textContent === 'Carregando...') {
            button.textContent = 'Entrar'; // ou texto original
        }
        button.style.opacity = '1';
    }
}

// ================================================================
// FUNÇÕES GLOBAIS EXPORTADAS
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

function diagnosticoSistema() {
    return {
        timestamp: new Date().toISOString(),
        emailJSDisponivel,
        usuariosCarregados: USUARIOS.length,
        usuarioAtual: sessionStorage.getItem('usuarioAtual'),
        codigosAtivos: Object.keys(JSON.parse(localStorage.getItem('codigosRecuperacao') || '{}')).length
    };
}

// Exportar para escopo global
window.togglePassword = togglePassword;
window.diagnosticoSistema = diagnosticoSistema;
window.USUARIOS = USUARIOS; // Para debug