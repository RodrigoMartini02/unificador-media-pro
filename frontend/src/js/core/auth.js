/**
 * Gerenciador de Autenticação
 * Controla login, logout e estado de autenticação
 */
class AuthManager {
    static TOKEN_KEY = 'auth_token';
    static USER_KEY = 'user';

    static getToken() {
        return localStorage.getItem(this.TOKEN_KEY);
    }

    static setToken(token) {
        localStorage.setItem(this.TOKEN_KEY, token);
    }

    static getUser() {
        const user = localStorage.getItem(this.USER_KEY);
        return user ? JSON.parse(user) : null;
    }

    static setUser(user) {
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    }

    static isAuthenticated() {
        return !!this.getToken();
    }

    static getUserRole() {
        const user = this.getUser();
        return user?.role || null;
    }

    static isAdmin() {
        return this.getUserRole() === 'admin';
    }

    static logout() {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
        window.location.href = '/quest.html?login=true';
    }

    static async login(email, password) {
        try {
            const response = await AuthAPI.login(email, password);
            this.setToken(response.token);
            this.setUser(response.user);
            return response;
        } catch (error) {
            throw error;
        }
    }

    static checkAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = '/quest.html?login=true';
            return false;
        }
        return true;
    }
}

// Exportar para uso global
window.AuthManager = AuthManager;
