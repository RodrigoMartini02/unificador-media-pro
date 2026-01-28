/**
 * LoginManager - Gerenciador de Login
 * Controla o formulário de login e autenticação
 */
class LoginManager {
    constructor() {
        this.isLoading = false;
    }

    init() {
        this.setupEventListeners();
        this.checkUrlParams();
    }

    setupEventListeners() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Toggle senha
        const togglePassword = document.getElementById('toggle-password');
        if (togglePassword) {
            togglePassword.addEventListener('click', () => this.togglePasswordVisibility());
        }

        // Tecla Enter no formulário
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && document.getElementById('login-modal')?.classList.contains('visible')) {
                const form = document.getElementById('login-form');
                if (form) form.dispatchEvent(new Event('submit'));
            }
        });
    }

    checkUrlParams() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('login') === 'true') {
            this.showLoginModal();
        }
    }

    showLoginModal() {
        const modal = document.getElementById('login-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('visible');
            document.getElementById('login-email')?.focus();
        }
    }

    hideLoginModal() {
        const modal = document.getElementById('login-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('visible');
        }
    }

    async handleLogin(e) {
        e.preventDefault();

        if (this.isLoading) return;

        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        if (!email || !password) {
            this.showError('Preencha todos os campos');
            return;
        }

        try {
            this.isLoading = true;
            this.showLoading();

            await AuthManager.login(email, password);

            // Redirecionar para o dashboard
            window.location.href = '/index.html';

        } catch (error) {
            console.error('Login error:', error);
            this.showError(error.message || 'Email ou senha inválidos');
        } finally {
            this.isLoading = false;
            this.hideLoading();
        }
    }

    togglePasswordVisibility() {
        const passwordInput = document.getElementById('login-password');
        const toggleIcon = document.querySelector('#toggle-password i');

        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            toggleIcon?.classList.replace('fa-eye', 'fa-eye-slash');
        } else {
            passwordInput.type = 'password';
            toggleIcon?.classList.replace('fa-eye-slash', 'fa-eye');
        }
    }

    showLoading() {
        const btn = document.querySelector('#login-form button[type="submit"]');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
        }
    }

    hideLoading() {
        const btn = document.querySelector('#login-form button[type="submit"]');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar';
        }
    }

    showError(message) {
        const errorEl = document.getElementById('login-error');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.remove('hidden');
            setTimeout(() => errorEl.classList.add('hidden'), 5000);
        } else if (window.Swal) {
            Swal.fire('Erro', message, 'error');
        } else {
            alert(message);
        }
    }
}

// Instância global
window.loginManager = new LoginManager();
