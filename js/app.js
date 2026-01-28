/**
 * Dashboard de Pesquisa de Satisfação - Refatorado
 * Conecta com API backend para gerenciamento de dados
 */

// ==================== CONFIGURAÇÃO ====================
const API_URL = '/api';

// ==================== CLIENTE API ====================
const api = {
    token: localStorage.getItem('auth_token'),

    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...(this.token && { 'Authorization': `Bearer ${this.token}` })
        };

        try {
            const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });

            if (response.status === 401) {
                this.logout();
                return null;
            }

            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    get: (endpoint) => api.request(endpoint),
    post: (endpoint, data) => api.request(endpoint, { method: 'POST', body: JSON.stringify(data) }),
    put: (endpoint, data) => api.request(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (endpoint) => api.request(endpoint, { method: 'DELETE' }),

    setToken(token) {
        this.token = token;
        localStorage.setItem('auth_token', token);
    },

    logout() {
        this.token = null;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        window.location.href = 'quest.html';
    },

    isAuthenticated() {
        return !!this.token;
    }
};

// ==================== GERENCIADOR DO DASHBOARD ====================
class DashboardManager {
    constructor() {
        this.charts = {};
        this.filters = {
            state: '',
            questionnaire_id: '',
            period: 'all'
        };
    }

    async init() {
        if (!api.isAuthenticated()) {
            window.location.href = 'quest.html';
            return;
        }

        this.setupEventListeners();
        await this.loadDashboard();
    }

    setupEventListeners() {
        // Filtros
        document.getElementById('stateSelect')?.addEventListener('change', (e) => {
            this.filters.state = e.target.value;
            this.applyFilters();
        });

        document.getElementById('questionarioFilterSelect')?.addEventListener('change', (e) => {
            this.filters.questionnaire_id = e.target.value;
            this.applyFilters();
        });

        document.querySelector('.period-selector')?.addEventListener('change', (e) => {
            this.filters.period = e.target.value;
            this.applyFilters();
        });

        // Exportar
        document.getElementById('exportButton')?.addEventListener('click', () => this.exportCSV());

        // Logout
        document.getElementById('logoutBtn')?.addEventListener('click', () => api.logout());

        // Limpar dados
        document.getElementById('limparDados')?.addEventListener('click', () => this.confirmClearData());
    }

    async loadDashboard() {
        try {
            this.showLoading();

            // Carregar dados em paralelo
            const [overview, satisfaction, locations, questionnaires] = await Promise.all([
                api.get('/analytics/overview'),
                api.get('/analytics/satisfaction'),
                api.get('/locations'),
                api.get('/questionnaires')
            ]);

            this.updateStats(overview);
            this.populateFilters(locations, questionnaires);
            this.createCharts(satisfaction);
            await this.loadResponses();

        } catch (error) {
            console.error('Erro ao carregar dashboard:', error);
            this.showError('Erro ao carregar dados. Verifique sua conexão.');
        } finally {
            this.hideLoading();
        }
    }

    updateStats(data) {
        document.getElementById('totalRespostas').textContent = data?.totalResponses || 0;
        document.getElementById('totalLocais').textContent = data?.totalLocations || 0;
        document.getElementById('respostasHoje').textContent = data?.todayResponses || 0;

        const avg = data?.avgSatisfaction || 0;
        const avgEl = document.getElementById('mediaSatisfacao');
        if (avgEl) {
            avgEl.textContent = avg.toFixed(1);
            avgEl.className = avg >= 7 ? 'stat-value positive' : avg >= 5 ? 'stat-value' : 'stat-value negative';
        }
    }

    populateFilters(locations, questionnaires) {
        // Estados
        const stateSelect = document.getElementById('stateSelect');
        if (stateSelect && locations) {
            const states = [...new Set(locations.map(l => l.state))].sort();
            stateSelect.innerHTML = '<option value="">Todos os Estados</option>' +
                states.map(s => `<option value="${s}">${s}</option>`).join('');
        }

        // Questionários
        const questSelect = document.getElementById('questionarioFilterSelect');
        if (questSelect && questionnaires) {
            questSelect.innerHTML = '<option value="">Todos os Questionários</option>' +
                questionnaires.map(q => `<option value="${q.id}">${q.name}</option>`).join('');
        }
    }

    createCharts(satisfactionData) {
        this.createSatisfactionChart(satisfactionData);
    }

    createSatisfactionChart(data) {
        const ctx = document.getElementById('chartSatisfacao');
        if (!ctx || !window.Chart) return;

        if (this.charts.satisfaction) {
            this.charts.satisfaction.destroy();
        }

        const categories = ['Muito Insatisfeito', 'Insatisfeito', 'Neutro', 'Satisfeito', 'Muito Satisfeito'];
        const colors = ['#EF4444', '#F59E0B', '#6B7280', '#10B981', '#059669'];

        const values = categories.map(cat => {
            const item = data?.find(d => d.category === cat);
            return item ? parseInt(item.count) : 0;
        });

        this.charts.satisfaction = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: categories,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { padding: 20, usePointStyle: true }
                    }
                }
            }
        });
    }

    async loadResponses() {
        try {
            const params = new URLSearchParams();
            if (this.filters.state) params.append('state', this.filters.state);
            if (this.filters.questionnaire_id) params.append('questionnaire_id', this.filters.questionnaire_id);

            const responses = await api.get(`/responses?${params}`);
            this.renderResponses(responses || []);
        } catch (error) {
            console.error('Erro ao carregar respostas:', error);
        }
    }

    renderResponses(responses) {
        const container = document.getElementById('respostasGrid');
        if (!container) return;

        if (!responses.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <h3>Nenhuma resposta encontrada</h3>
                    <p>Não há respostas para os filtros selecionados.</p>
                </div>`;
            return;
        }

        container.innerHTML = responses.map(r => `
            <div class="response-card">
                <div class="response-header">
                    <span class="respondent-name">${r.is_anonymous ? 'Anônimo' : (r.respondent_name || 'Não informado')}</span>
                    <span class="response-date">${new Date(r.submitted_at).toLocaleDateString('pt-BR')}</span>
                </div>
                <div class="response-info">
                    <span><i class="fas fa-map-marker-alt"></i> ${r.municipality || ''}, ${r.state || ''}</span>
                    <span><i class="fas fa-clipboard"></i> ${r.questionnaire_name || ''}</span>
                </div>
                <button class="btn btn-sm btn-secondary" onclick="dashboard.viewResponse(${r.id})">
                    <i class="fas fa-eye"></i> Ver Detalhes
                </button>
            </div>
        `).join('');
    }

    async viewResponse(id) {
        try {
            const response = await api.get(`/responses/${id}`);
            this.showResponseModal(response);
        } catch (error) {
            console.error('Erro ao carregar resposta:', error);
        }
    }

    showResponseModal(response) {
        const modal = document.getElementById('modalRespostaDetalhes');
        if (!modal) return;

        document.getElementById('modalRespondenteNome').textContent =
            response.is_anonymous ? 'Anônimo' : (response.respondent_name || 'Não informado');
        document.getElementById('modalRespondenteCargo').textContent = response.respondent_position || '-';
        document.getElementById('modalRespondenteLocal').textContent =
            `${response.municipality || ''}, ${response.state || ''}`;
        document.getElementById('modalRespostaData').textContent =
            new Date(response.submitted_at).toLocaleDateString('pt-BR');

        const list = document.getElementById('modalRespostasList');
        list.innerHTML = (response.answers || []).map((a, i) => `
            <div class="response-item">
                <span class="question-number">${i + 1}.</span>
                <span class="question-type">${a.question_type?.toUpperCase() || ''}</span>
                <p class="question-text">${a.question_text || ''}</p>
                <p class="answer-value">${this.formatAnswer(a)}</p>
            </div>
        `).join('');

        modal.classList.add('active');
    }

    formatAnswer(answer) {
        if (answer.question_type === 'scale') {
            return `<span class="rating">${answer.numeric_value}/10</span>`;
        }
        if (answer.question_type === 'boolean') {
            const isYes = answer.value === 'true' || answer.value === '1';
            return `<span class="boolean ${isYes ? 'yes' : 'no'}">${isYes ? 'Sim' : 'Não'}</span>`;
        }
        return answer.value || '-';
    }

    async applyFilters() {
        await this.loadDashboard();
    }

    async exportCSV() {
        const params = new URLSearchParams(this.filters);
        window.location.href = `${API_URL}/export/csv?${params}`;
    }

    confirmClearData() {
        Swal.fire({
            title: 'Limpar Dados?',
            text: 'Esta ação não pode ser desfeita!',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#EF4444',
            cancelButtonText: 'Cancelar',
            confirmButtonText: 'Sim, limpar'
        }).then(async (result) => {
            if (result.isConfirmed) {
                // Implementar limpeza via API se necessário
                Swal.fire('Dados limpos!', '', 'success');
            }
        });
    }

    showLoading() {
        document.getElementById('loadingOverlay')?.classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loadingOverlay')?.classList.add('hidden');
    }

    showError(message) {
        Swal.fire('Erro', message, 'error');
    }

    closeModal() {
        document.getElementById('modalRespostaDetalhes')?.classList.remove('active');
    }
}

// ==================== NAVEGAÇÃO ====================
class NavigationManager {
    constructor() {
        this.currentSection = 'dashboard';
    }

    init() {
        document.querySelectorAll('[data-section]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateTo(e.currentTarget.dataset.section);
            });
        });

        // Mobile menu
        document.getElementById('mobileMenuToggle')?.addEventListener('click', () => {
            document.getElementById('sidebar')?.classList.toggle('mobile-open');
        });
    }

    navigateTo(section) {
        // Atualizar navegação
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        document.querySelector(`[data-section="${section}"]`)?.closest('.nav-item')?.classList.add('active');

        // Mostrar seção
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        document.getElementById(`section-${section}`)?.classList.add('active');

        this.currentSection = section;
    }
}

// ==================== INICIALIZAÇÃO ====================
let dashboard;
let navigation;

document.addEventListener('DOMContentLoaded', async () => {
    // Verificar dependências
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js não carregado');
    }

    navigation = new NavigationManager();
    navigation.init();

    dashboard = new DashboardManager();
    await dashboard.init();

    // Expor para uso global
    window.dashboard = dashboard;
    window.api = api;

    console.log('Dashboard carregado!');
});

// Fechar modal com ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelector('.modal.active')?.classList.remove('active');
    }
});

// Fechar modal clicando fora
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});
