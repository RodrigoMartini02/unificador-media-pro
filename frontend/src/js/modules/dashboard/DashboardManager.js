/**
 * DashboardManager - Gerenciador do Dashboard Principal
 * Controla a visualização de estatísticas e gráficos
 */
class DashboardManager {
    constructor() {
        this.charts = {};
        this.isLoading = false;
    }

    async init() {
        // Verificar autenticação
        if (!AuthManager.checkAuth()) return;

        // Carregar dados iniciais
        await this.loadDashboard();

        // Configurar listeners
        this.setupEventListeners();

        // Inscrever para mudanças de filtros
        window.appState.subscribe('filters', () => this.loadDashboard());
    }

    setupEventListeners() {
        // Filtro de período
        const periodSelect = document.getElementById('period-filter');
        if (periodSelect) {
            periodSelect.addEventListener('change', (e) => {
                window.appState.setFilters({ period: e.target.value });
            });
        }

        // Filtro de estado
        const stateSelect = document.getElementById('state-filter');
        if (stateSelect) {
            stateSelect.addEventListener('change', (e) => {
                window.appState.setFilters({ state: e.target.value || null });
                this.loadMunicipalityFilter(e.target.value);
            });
        }

        // Filtro de questionário
        const questionnaireSelect = document.getElementById('questionnaire-filter');
        if (questionnaireSelect) {
            questionnaireSelect.addEventListener('change', (e) => {
                window.appState.setFilters({ questionnaire_id: e.target.value || null });
            });
        }

        // Botão de limpar filtros
        const clearBtn = document.getElementById('clear-filters');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                window.appState.clearFilters();
                this.resetFilterSelects();
            });
        }

        // Botão de exportar CSV
        const exportBtn = document.getElementById('export-csv');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportCSV());
        }
    }

    async loadDashboard() {
        if (this.isLoading) return;
        this.isLoading = true;

        try {
            this.showLoading();
            const filters = window.appState.getFilters();

            // Carregar dados em paralelo
            const [overview, satisfaction, trends, locations] = await Promise.all([
                AnalyticsAPI.getOverview(filters),
                AnalyticsAPI.getSatisfaction(filters),
                AnalyticsAPI.getTrends(filters, filters.period),
                AnalyticsAPI.getLocationComparison(filters)
            ]);

            // Atualizar cards de estatísticas
            this.updateStatCards(overview);

            // Atualizar gráficos
            this.updateCharts(satisfaction, trends, locations);

            // Carregar filtros se ainda não carregados
            await this.loadFilters();

        } catch (error) {
            console.error('Error loading dashboard:', error);
            this.showError('Erro ao carregar dashboard');
        } finally {
            this.isLoading = false;
            this.hideLoading();
        }
    }

    updateStatCards(data) {
        const cards = {
            'total-responses': data.totalResponses,
            'today-responses': data.todayResponses,
            'total-locations': data.totalLocations,
            'avg-satisfaction': data.avgSatisfaction?.toFixed(1) || '0.0'
        };

        for (const [id, value] of Object.entries(cards)) {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = value;
                // Animação de atualização
                el.classList.add('updated');
                setTimeout(() => el.classList.remove('updated'), 500);
            }
        }
    }

    updateCharts(satisfaction, trends, locations) {
        // Destruir gráficos existentes
        Object.values(this.charts).forEach(chart => ChartFactory.destroy(chart));
        this.charts = {};

        // Gráfico de Satisfação
        const satisfactionContainer = document.getElementById('satisfaction-chart');
        if (satisfactionContainer && satisfaction.length > 0) {
            satisfactionContainer.innerHTML = '';
            this.charts.satisfaction = ChartFactory.createSatisfactionDonut(satisfactionContainer, satisfaction);
        }

        // Gráfico de Tendências
        const trendsContainer = document.getElementById('trends-chart');
        if (trendsContainer && trends.length > 0) {
            trendsContainer.innerHTML = '';
            this.charts.trends = ChartFactory.createTrendChart(trendsContainer, trends);
        }

        // Gráfico de Localizações
        const locationsContainer = document.getElementById('locations-chart');
        if (locationsContainer && locations.length > 0) {
            locationsContainer.innerHTML = '';
            this.charts.locations = ChartFactory.createLocationComparison(locationsContainer, locations.slice(0, 15));
        }
    }

    async loadFilters() {
        try {
            // Carregar estados
            const stateSelect = document.getElementById('state-filter');
            if (stateSelect && stateSelect.options.length <= 1) {
                const states = await LocationsAPI.getStates();
                states.forEach(state => {
                    const option = document.createElement('option');
                    option.value = state;
                    option.textContent = state;
                    stateSelect.appendChild(option);
                });
            }

            // Carregar questionários
            const questionnaireSelect = document.getElementById('questionnaire-filter');
            if (questionnaireSelect && questionnaireSelect.options.length <= 1) {
                const questionnaires = await QuestionnairesAPI.getAll();
                questionnaires.forEach(q => {
                    const option = document.createElement('option');
                    option.value = q.id;
                    option.textContent = q.name;
                    questionnaireSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading filters:', error);
        }
    }

    async loadMunicipalityFilter(state) {
        const municipalitySelect = document.getElementById('municipality-filter');
        if (!municipalitySelect) return;

        municipalitySelect.innerHTML = '<option value="">Todos os municípios</option>';

        if (state) {
            try {
                const municipalities = await LocationsAPI.getMunicipalities(state);
                municipalities.forEach(m => {
                    const option = document.createElement('option');
                    option.value = m.id;
                    option.textContent = m.municipality;
                    municipalitySelect.appendChild(option);
                });
            } catch (error) {
                console.error('Error loading municipalities:', error);
            }
        }
    }

    resetFilterSelects() {
        const selects = ['state-filter', 'municipality-filter', 'questionnaire-filter', 'period-filter'];
        selects.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.selectedIndex = 0;
        });
    }

    exportCSV() {
        const filters = window.appState.getFilters();
        const url = ExportAPI.getCSVUrl(filters);
        window.open(url, '_blank');
    }

    showLoading() {
        const loader = document.getElementById('dashboard-loader');
        if (loader) loader.classList.remove('hidden');
    }

    hideLoading() {
        const loader = document.getElementById('dashboard-loader');
        if (loader) loader.classList.add('hidden');
    }

    showError(message) {
        // Usar SweetAlert se disponível, senão alert
        if (window.Swal) {
            Swal.fire('Erro', message, 'error');
        } else {
            alert(message);
        }
    }
}

// Exportar para uso global
window.DashboardManager = DashboardManager;
