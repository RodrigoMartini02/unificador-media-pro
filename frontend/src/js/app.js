/**
 * App.js - Aplicação Principal do Dashboard
 * Inicializa todos os módulos e gerencia a navegação
 */

// Configuração da aplicação
const APP_CONFIG = {
    API_BASE_URL: '/api',
    ITEMS_PER_PAGE: 10
};

/**
 * Classe principal da aplicação
 */
class App {
    constructor() {
        this.currentSection = 'dashboard';
        this.dashboardManager = null;
        this.analyticsManager = null;
        this.charts = {};
    }

    async init() {
        // Verificar autenticação
        if (!AuthManager.isAuthenticated()) {
            this.showLoginModal();
            return;
        }

        // Carregar dados do usuário
        await this.loadUserInfo();

        // Inicializar módulos
        this.initNavigation();
        await this.loadDashboard();

        // Setup eventos globais
        this.setupGlobalEvents();

        console.log('Application initialized');
    }

    async loadUserInfo() {
        try {
            const user = await AuthAPI.me();
            const userNameEl = document.getElementById('user-name');
            if (userNameEl) userNameEl.textContent = user.name;
        } catch (error) {
            console.error('Error loading user info:', error);
            AuthManager.logout();
        }
    }

    initNavigation() {
        // Navegação da sidebar
        document.querySelectorAll('[data-section]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.currentTarget.dataset.section;
                this.navigateTo(section);
            });
        });

        // Mobile menu toggle
        const menuToggle = document.getElementById('menu-toggle');
        if (menuToggle) {
            menuToggle.addEventListener('click', () => {
                document.querySelector('.sidebar')?.classList.toggle('open');
            });
        }
    }

    async navigateTo(section) {
        // Atualizar estado
        this.currentSection = section;
        window.appState.setCurrentSection(section);

        // Atualizar navegação ativa
        document.querySelectorAll('[data-section]').forEach(link => {
            link.classList.toggle('active', link.dataset.section === section);
        });

        // Esconder todas as seções
        document.querySelectorAll('.main-section').forEach(sec => {
            sec.classList.add('hidden');
        });

        // Mostrar seção selecionada
        const sectionEl = document.getElementById(`section-${section}`);
        if (sectionEl) {
            sectionEl.classList.remove('hidden');
        }

        // Carregar dados da seção
        await this.loadSectionData(section);
    }

    async loadSectionData(section) {
        switch (section) {
            case 'dashboard':
                await this.loadDashboard();
                break;
            case 'questionnaires':
                await this.loadQuestionnaires();
                break;
            case 'responses':
                await this.loadResponses();
                break;
            case 'locations':
                await window.locationManager?.init();
                break;
            case 'analytics':
                await this.loadAnalytics();
                break;
        }
    }

    async loadDashboard() {
        try {
            this.showLoading();
            const filters = window.appState.getFilters();

            // Carregar estatísticas gerais
            const overview = await AnalyticsAPI.getOverview(filters);
            this.updateStatCards(overview);

            // Carregar dados para gráficos
            const [satisfaction, trends, locations] = await Promise.all([
                AnalyticsAPI.getSatisfaction(filters),
                AnalyticsAPI.getTrends(filters),
                AnalyticsAPI.getLocationComparison(filters)
            ]);

            // Renderizar gráficos
            this.renderDashboardCharts(satisfaction, trends, locations);

            // Carregar filtros
            await this.loadFilterOptions();

        } catch (error) {
            console.error('Error loading dashboard:', error);
        } finally {
            this.hideLoading();
        }
    }

    updateStatCards(overview) {
        document.getElementById('stat-total-responses').textContent = overview.totalResponses || 0;
        document.getElementById('stat-today-responses').textContent = overview.todayResponses || 0;
        document.getElementById('stat-total-locations').textContent = overview.totalLocations || 0;

        const avgEl = document.getElementById('stat-avg-satisfaction');
        if (avgEl) {
            const avg = overview.avgSatisfaction || 0;
            avgEl.textContent = avg.toFixed(1);
            avgEl.className = `stat-value ${avg >= 7 ? 'positive' : avg >= 5 ? 'neutral' : 'negative'}`;
        }
    }

    renderDashboardCharts(satisfaction, trends, locations) {
        // Destruir gráficos existentes
        Object.values(this.charts).forEach(chart => ChartFactory.destroy(chart));
        this.charts = {};

        // Gráfico de satisfação (donut)
        const satisfactionContainer = document.getElementById('chart-satisfaction');
        if (satisfactionContainer && satisfaction?.length > 0) {
            satisfactionContainer.innerHTML = '';
            this.charts.satisfaction = ChartFactory.createSatisfactionDonut(satisfactionContainer, satisfaction);
        }

        // Gráfico de tendência
        const trendsContainer = document.getElementById('chart-trends');
        if (trendsContainer && trends?.length > 0) {
            trendsContainer.innerHTML = '';
            this.charts.trends = ChartFactory.createTrendChart(trendsContainer, trends);
        }

        // Gráfico de comparação por localização
        const locationsContainer = document.getElementById('chart-locations');
        if (locationsContainer && locations?.length > 0) {
            locationsContainer.innerHTML = '';
            this.charts.locations = ChartFactory.createLocationComparison(locationsContainer, locations);
        }
    }

    async loadFilterOptions() {
        try {
            // Carregar estados
            const states = await LocationsAPI.getStates();
            const stateSelect = document.getElementById('filter-state');
            if (stateSelect) {
                stateSelect.innerHTML = '<option value="">Todos os Estados</option>';
                states.forEach(state => {
                    const option = document.createElement('option');
                    option.value = state;
                    option.textContent = state;
                    stateSelect.appendChild(option);
                });
            }

            // Carregar questionários
            const questionnaires = await QuestionnairesAPI.getAll();
            const questSelect = document.getElementById('filter-questionnaire');
            if (questSelect) {
                questSelect.innerHTML = '<option value="">Todos os Questionários</option>';
                questionnaires.forEach(q => {
                    const option = document.createElement('option');
                    option.value = q.id;
                    option.textContent = q.name;
                    questSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading filter options:', error);
        }
    }

    async loadQuestionnaires() {
        try {
            this.showLoading();
            const questionnaires = await QuestionnairesAPI.getAll();
            this.renderQuestionnairesList(questionnaires);
        } catch (error) {
            console.error('Error loading questionnaires:', error);
        } finally {
            this.hideLoading();
        }
    }

    renderQuestionnairesList(questionnaires) {
        const container = document.getElementById('questionnaires-list');
        if (!container) return;

        if (questionnaires.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clipboard-list"></i>
                    <p>Nenhum questionário cadastrado.</p>
                    <button class="btn btn-primary" onclick="app.showQuestionnaireModal()">
                        <i class="fas fa-plus"></i> Criar Questionário
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = questionnaires.map(q => `
            <div class="questionnaire-card ${q.is_active ? '' : 'inactive'}">
                <div class="questionnaire-header">
                    <h3>${q.name}</h3>
                    <span class="status-badge ${q.is_active ? 'active' : 'inactive'}">
                        ${q.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                </div>
                <p class="questionnaire-description">${q.description || 'Sem descrição'}</p>
                <div class="questionnaire-meta">
                    <span><i class="fas fa-calendar"></i> ${new Date(q.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
                <div class="questionnaire-actions">
                    <button class="btn btn-sm btn-secondary" onclick="app.editQuestionnaire(${q.id})">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn btn-sm btn-${q.is_active ? 'warning' : 'success'}" onclick="app.toggleQuestionnaire(${q.id})">
                        <i class="fas fa-${q.is_active ? 'pause' : 'play'}"></i> ${q.is_active ? 'Desativar' : 'Ativar'}
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="app.deleteQuestionnaire(${q.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    async loadResponses() {
        try {
            this.showLoading();
            const filters = window.appState.getFilters();
            const responses = await ResponsesAPI.getAll(filters);
            this.renderResponsesList(responses);
        } catch (error) {
            console.error('Error loading responses:', error);
        } finally {
            this.hideLoading();
        }
    }

    renderResponsesList(responses) {
        const container = document.getElementById('responses-list');
        if (!container) return;

        if (responses.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>Nenhuma resposta encontrada.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table class="responses-table">
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Questionário</th>
                        <th>Local</th>
                        <th>Respondente</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${responses.map(r => `
                        <tr>
                            <td>${new Date(r.submitted_at).toLocaleString('pt-BR')}</td>
                            <td>${r.questionnaire_name || '-'}</td>
                            <td>${r.municipality ? `${r.municipality}, ${r.state}` : '-'}</td>
                            <td>${r.is_anonymous ? '<em>Anônimo</em>' : (r.respondent_name || '-')}</td>
                            <td>
                                <button class="btn btn-sm btn-secondary" onclick="app.viewResponse(${r.id})">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button class="btn btn-sm btn-danger" onclick="app.deleteResponse(${r.id})">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    async loadAnalytics() {
        if (!window.analyticsManager) {
            window.analyticsManager = new AnalyticsManager();
        }
        await window.analyticsManager.init();
    }

    // ========== Ações de Questionários ==========

    showQuestionnaireModal(questionnaire = null) {
        const modal = document.getElementById('questionnaire-modal');
        const form = document.getElementById('questionnaire-form');
        const title = document.getElementById('modal-questionnaire-title');

        if (questionnaire) {
            title.textContent = 'Editar Questionário';
            document.getElementById('questionnaire-id').value = questionnaire.id;
            document.getElementById('questionnaire-name').value = questionnaire.name;
            document.getElementById('questionnaire-description').value = questionnaire.description || '';
        } else {
            title.textContent = 'Novo Questionário';
            form.reset();
            document.getElementById('questionnaire-id').value = '';
        }

        modal?.classList.remove('hidden');
    }

    async editQuestionnaire(id) {
        try {
            const questionnaire = await QuestionnairesAPI.getById(id);
            this.showQuestionnaireModal(questionnaire);
        } catch (error) {
            console.error('Error loading questionnaire:', error);
            Swal.fire('Erro', 'Erro ao carregar questionário', 'error');
        }
    }

    async toggleQuestionnaire(id) {
        try {
            await QuestionnairesAPI.toggle(id);
            await this.loadQuestionnaires();
        } catch (error) {
            console.error('Error toggling questionnaire:', error);
            Swal.fire('Erro', 'Erro ao alterar status do questionário', 'error');
        }
    }

    async deleteQuestionnaire(id) {
        const result = await Swal.fire({
            title: 'Excluir questionário?',
            text: 'Esta ação não pode ser desfeita. As respostas serão mantidas.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonText: 'Cancelar',
            confirmButtonText: 'Excluir'
        });

        if (result.isConfirmed) {
            try {
                await QuestionnairesAPI.delete(id);
                await this.loadQuestionnaires();
                Swal.fire('Excluído!', 'Questionário excluído com sucesso.', 'success');
            } catch (error) {
                console.error('Error deleting questionnaire:', error);
                Swal.fire('Erro', 'Erro ao excluir questionário', 'error');
            }
        }
    }

    // ========== Ações de Respostas ==========

    async viewResponse(id) {
        try {
            const response = await ResponsesAPI.getById(id);
            this.showResponseModal(response);
        } catch (error) {
            console.error('Error loading response:', error);
            Swal.fire('Erro', 'Erro ao carregar resposta', 'error');
        }
    }

    showResponseModal(response) {
        const modal = document.getElementById('response-modal');
        const content = document.getElementById('response-detail-content');

        content.innerHTML = `
            <div class="response-detail">
                <div class="response-header">
                    <h3>${response.questionnaire_name}</h3>
                    <span class="response-date">${new Date(response.submitted_at).toLocaleString('pt-BR')}</span>
                </div>

                <div class="response-info">
                    <p><strong>Local:</strong> ${response.municipality ? `${response.municipality}, ${response.state}` : 'Não informado'}</p>
                    <p><strong>Respondente:</strong> ${response.is_anonymous ? 'Anônimo' : (response.respondent_name || 'Não informado')}</p>
                    ${response.respondent_position ? `<p><strong>Cargo:</strong> ${response.respondent_position}</p>` : ''}
                </div>

                <h4>Respostas:</h4>
                <div class="answers-list">
                    ${response.answers?.map(a => `
                        <div class="answer-item">
                            <p class="question-text">${a.question_text}</p>
                            <p class="answer-value">
                                ${this.formatAnswerValue(a)}
                            </p>
                        </div>
                    `).join('') || '<p>Sem respostas</p>'}
                </div>
            </div>
        `;

        modal?.classList.remove('hidden');
    }

    formatAnswerValue(answer) {
        if (answer.question_type === 'scale') {
            return `<span class="scale-value">${answer.numeric_value}/10</span>`;
        } else if (answer.question_type === 'boolean') {
            const isYes = answer.value === 'true' || answer.value === '1';
            return `<span class="boolean-value ${isYes ? 'yes' : 'no'}">${isYes ? 'Sim' : 'Não'}</span>`;
        }
        return answer.value || '-';
    }

    async deleteResponse(id) {
        const result = await Swal.fire({
            title: 'Excluir resposta?',
            text: 'Esta ação não pode ser desfeita.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonText: 'Cancelar',
            confirmButtonText: 'Excluir'
        });

        if (result.isConfirmed) {
            try {
                await ResponsesAPI.delete(id);
                await this.loadResponses();
                Swal.fire('Excluída!', 'Resposta excluída com sucesso.', 'success');
            } catch (error) {
                console.error('Error deleting response:', error);
                Swal.fire('Erro', 'Erro ao excluir resposta', 'error');
            }
        }
    }

    // ========== Filtros ==========

    setupGlobalEvents() {
        // Filtro de estado
        document.getElementById('filter-state')?.addEventListener('change', async (e) => {
            window.appState.setFilters({ state: e.target.value || null });
            await this.applyFilters();
        });

        // Filtro de questionário
        document.getElementById('filter-questionnaire')?.addEventListener('change', async (e) => {
            window.appState.setFilters({ questionnaire_id: e.target.value || null });
            await this.applyFilters();
        });

        // Filtro de período
        document.getElementById('filter-period')?.addEventListener('change', async (e) => {
            const period = e.target.value;
            let date_from = null;

            if (period) {
                const now = new Date();
                const days = parseInt(period);
                date_from = new Date(now.setDate(now.getDate() - days)).toISOString().split('T')[0];
            }

            window.appState.setFilters({ date_from, period });
            await this.applyFilters();
        });

        // Botão de limpar filtros
        document.getElementById('clear-filters')?.addEventListener('click', async () => {
            window.appState.clearFilters();
            document.getElementById('filter-state').value = '';
            document.getElementById('filter-questionnaire').value = '';
            document.getElementById('filter-period').value = '';
            await this.applyFilters();
        });

        // Exportar CSV
        document.getElementById('export-csv')?.addEventListener('click', () => this.exportCSV());

        // Logout
        document.getElementById('logout-btn')?.addEventListener('click', () => {
            AuthManager.logout();
        });

        // Fechar modais
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.modal')?.classList.add('hidden');
            });
        });
    }

    async applyFilters() {
        if (this.currentSection === 'dashboard') {
            await this.loadDashboard();
        } else if (this.currentSection === 'responses') {
            await this.loadResponses();
        } else if (this.currentSection === 'analytics') {
            await this.loadAnalytics();
        }
    }

    exportCSV() {
        const filters = window.appState.getFilters();
        const params = new URLSearchParams();

        Object.entries(filters).forEach(([key, value]) => {
            if (value) params.append(key, value);
        });

        window.location.href = `${APP_CONFIG.API_BASE_URL}/export/csv?${params.toString()}`;
    }

    // ========== UI Helpers ==========

    showLoginModal() {
        document.getElementById('login-modal')?.classList.remove('hidden');
        document.getElementById('main-content')?.classList.add('hidden');
    }

    hideLoginModal() {
        document.getElementById('login-modal')?.classList.add('hidden');
        document.getElementById('main-content')?.classList.remove('hidden');
    }

    showLoading() {
        document.getElementById('global-loader')?.classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('global-loader')?.classList.add('hidden');
    }

    closeModal(modalId) {
        document.getElementById(modalId)?.classList.add('hidden');
    }
}

// Instância global da aplicação
window.app = new App();

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.app.init();
});
