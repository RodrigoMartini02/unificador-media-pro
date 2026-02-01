/**
 * Dashboard de Pesquisa de Satisfação
 * Código limpo com separação de responsabilidades
 */

// ==================== CONFIGURAÇÃO ====================
const API_URL = '/api';
const IBGE_API_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades';

// ==================== UTILITÁRIOS ====================
const Utils = {
    // Toast notifications (canto superior direito)
    toast: {
        success: (msg) => Utils.showToast(msg, 'success'),
        error: (msg) => Utils.showToast(msg, 'error'),
        warning: (msg) => Utils.showToast(msg, 'warning'),
        info: (msg) => Utils.showToast(msg, 'info')
    },

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer') || Utils.createToastContainer();
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const icon = document.createElement('i');
        icon.className = `fas ${icons[type]}`;

        const span = document.createElement('span');
        span.textContent = message;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'toast-close';
        closeBtn.onclick = () => toast.remove();

        const closeIcon = document.createElement('i');
        closeIcon.className = 'fas fa-times';
        closeBtn.appendChild(closeIcon);

        toast.appendChild(icon);
        toast.appendChild(span);
        toast.appendChild(closeBtn);

        container.appendChild(toast);

        setTimeout(() => toast.remove(), 4000);
        requestAnimationFrame(() => toast.classList.add('show'));
    },

    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
        return container;
    },

    // Confirmar ação (usa modal nativo simplificado)
    async confirm(title, message) {
        return new Promise(resolve => {
            const modal = document.getElementById('confirmModal');
            const titleEl = modal.querySelector('.confirm-title');
            const messageEl = modal.querySelector('.confirm-message');
            const confirmBtn = modal.querySelector('.confirm-yes');
            const cancelBtn = modal.querySelector('.confirm-no');

            titleEl.textContent = title;
            messageEl.textContent = message;
            Utils.openModal(modal);

            const cleanup = () => {
                Utils.closeModal(modal);
                confirmBtn.removeEventListener('click', onConfirm);
                cancelBtn.removeEventListener('click', onCancel);
            };

            const onConfirm = () => { cleanup(); resolve(true); };
            const onCancel = () => { cleanup(); resolve(false); };

            confirmBtn.addEventListener('click', onConfirm);
            cancelBtn.addEventListener('click', onCancel);
        });
    },

    // Formatar data
    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('pt-BR');
    },

    // Obter elemento do template
    cloneTemplate(templateId) {
        const template = document.getElementById(templateId);
        return template ? template.content.cloneNode(true) : null;
    },

    // Definir texto em elemento
    setText(parent, selector, text) {
        const el = parent.querySelector(selector);
        if (el) el.textContent = text;
    },

    // Mostrar/ocultar elemento
    show(el) { el?.classList.remove('hidden'); },
    hide(el) { el?.classList.add('hidden'); },
    toggle(el, show) { show ? Utils.show(el) : Utils.hide(el); },

    // Abrir/fechar modal (usando hidden ao inves de active)
    openModal(modal) {
        if (typeof modal === 'string') modal = document.getElementById(modal);
        modal?.classList.remove('hidden');
    },
    closeModal(modal) {
        if (typeof modal === 'string') modal = document.getElementById(modal);
        modal?.classList.add('hidden');
    },

    // Popular select com opções
    populateSelect(select, options, placeholder = 'Selecione...') {
        if (!select) return;
        select.textContent = '';

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = placeholder;
        select.appendChild(defaultOption);

        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            if (opt.data) {
                Object.keys(opt.data).forEach(key => {
                    option.dataset[key] = opt.data[key];
                });
            }
            select.appendChild(option);
        });
    },

    // Limpar container
    clearContainer(container) {
        if (container) container.textContent = '';
    }
};

// ==================== API DO IBGE ====================
const ibgeApi = {
    async getEstados() {
        try {
            const response = await fetch(`${IBGE_API_URL}/estados?orderBy=nome`);
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar estados:', error);
            return [];
        }
    },

    async getMunicipios(ufId) {
        try {
            const response = await fetch(`${IBGE_API_URL}/estados/${ufId}/municipios?orderBy=nome`);
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar municípios:', error);
            return [];
        }
    }
};

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

            const data = await response.json();

            if (!response.ok) {
                console.warn(`API ${endpoint}:`, data);
                return null;
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            return null;
        }
    },

    get: (endpoint) => api.request(endpoint),
    post: (endpoint, data) => api.request(endpoint, { method: 'POST', body: JSON.stringify(data) }),
    put: (endpoint, data) => api.request(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
    patch: (endpoint, data) => api.request(endpoint, { method: 'PATCH', body: JSON.stringify(data) }),
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

// ==================== GERENCIADOR DO DASHBOARD AVANÇADO ====================
class DashboardManager {
    constructor() {
        this.charts = {};
        this.filters = { state: '', questionnaire_id: '', period: 'all' };
        this.currentView = 'macro'; // macro, state, questionnaire
        this.currentState = null;
        this.currentQuestionnaire = null;
        this.data = {};
    }

    async init() {
        if (!api.isAuthenticated()) {
            window.location.href = 'quest.html';
            return;
        }
        this.bindEvents();
        await this.loadMacroView();
    }

    bindEvents() {
        // Filtros
        document.getElementById('stateSelect')?.addEventListener('change', (e) => {
            this.filters.state = e.target.value;
            this.loadMacroView();
        });

        document.getElementById('questionarioFilterSelect')?.addEventListener('change', (e) => {
            this.filters.questionnaire_id = e.target.value;
            this.loadMacroView();
        });

        document.querySelector('.period-selector')?.addEventListener('change', (e) => {
            this.filters.period = e.target.value;
            this.loadMacroView();
        });

        // Navegação
        document.getElementById('btnVoltarMacro')?.addEventListener('click', () => this.goBack());
        document.getElementById('exportButton')?.addEventListener('click', () => this.exportCSV());
        document.getElementById('logoutBtn')?.addEventListener('click', () => api.logout());

        // Modal de análise de pergunta
        document.getElementById('modalQuestionAnalysisOverlay')?.addEventListener('click', () => {
            Utils.closeModal('modalQuestionAnalysis');
        });
        document.getElementById('modalQuestionAnalysisClose')?.addEventListener('click', () => {
            Utils.closeModal('modalQuestionAnalysis');
        });
        document.getElementById('modalQuestionAnalysisFechar')?.addEventListener('click', () => {
            Utils.closeModal('modalQuestionAnalysis');
        });
    }

    // ==================== NAVEGAÇÃO ====================
    showView(viewName) {
        document.querySelectorAll('.dashboard-view').forEach(v => v.classList.add('hidden'));
        document.getElementById(`view${viewName.charAt(0).toUpperCase() + viewName.slice(1)}`)?.classList.remove('hidden');

        const breadcrumb = document.getElementById('dashboardBreadcrumb');
        if (viewName === 'macro') {
            breadcrumb?.classList.add('hidden');
        } else {
            breadcrumb?.classList.remove('hidden');
        }

        this.currentView = viewName;
    }

    goBack() {
        if (this.currentView === 'state') {
            this.showView('macro');
            this.loadMacroView();
        } else if (this.currentView === 'questionnaire') {
            if (this.currentState) {
                this.showView('state');
                this.loadStateView(this.currentState);
            } else {
                this.showView('macro');
                this.loadMacroView();
            }
        }
    }

    updateBreadcrumb(text) {
        document.getElementById('breadcrumbCurrent').textContent = text;
    }

    // ==================== VISÃO MACRO ====================
    async loadMacroView() {
        try {
            this.showLoading();
            this.showView('macro');

            const [macro, nps, critical, satisfaction, trends, locations, questionnaires] = await Promise.all([
                api.get('/analytics/macro'),
                api.get('/analytics/nps'),
                api.get('/analytics/critical'),
                api.get('/analytics/satisfaction'),
                api.get('/analytics/trends?period=30d'),
                api.get('/locations'),
                api.get('/questionnaires')
            ]);

            this.data = { macro, nps, critical, satisfaction, trends, locations, questionnaires };

            this.updateMacroStats(macro, nps, critical);
            this.populateFilters(locations || [], questionnaires || []);
            this.createNpsGauge(nps);
            this.createQuestionnaireComparison(macro?.questionnaireStats || []);
            this.createTrendsChart(trends || []);
            this.createStateTreemap(macro?.stateStats || []);
            this.createSatisfactionDonut(satisfaction || []);
            this.renderCriticalAlerts(critical || []);

        } catch (error) {
            console.error('Erro ao carregar dashboard:', error);
            Utils.toast.error('Erro ao carregar dados');
        } finally {
            this.hideLoading();
        }
    }

    updateMacroStats(macro, nps, critical) {
        const totals = macro?.totals || {};

        document.getElementById('totalRespostas').textContent = totals.totalResponses || 0;
        document.getElementById('totalLocais').textContent = `${totals.totalStates || 0}/${totals.totalLocations || 0}`;
        document.getElementById('totalAlertas').textContent = (critical || []).length;

        const avg = totals.avgSatisfaction || 0;
        const avgEl = document.getElementById('mediaSatisfacao');
        if (avgEl) {
            avgEl.textContent = avg.toFixed(1);
            avgEl.className = avg >= 7 ? 'stat-value positive' : avg >= 5 ? 'stat-value' : 'stat-value negative';
        }

        // NPS
        const npsValue = nps?.nps || 0;
        const npsEl = document.getElementById('npsScore');
        const npsBadge = document.getElementById('npsBadge');
        if (npsEl) {
            npsEl.textContent = npsValue;
            npsEl.className = npsValue >= 50 ? 'stat-value nps-value positive' :
                              npsValue >= 0 ? 'stat-value nps-value neutral' : 'stat-value nps-value negative';
        }
        if (npsBadge) {
            npsBadge.textContent = npsValue >= 50 ? 'Excelente' : npsValue >= 0 ? 'Bom' : 'Crítico';
            npsBadge.className = `nps-badge ${npsValue >= 50 ? 'nps-excellent' : npsValue >= 0 ? 'nps-good' : 'nps-critical'}`;
        }
    }

    populateFilters(locations, questionnaires) {
        const stateSelect = document.getElementById('stateSelect');
        if (stateSelect && locations) {
            const states = [...new Set(locations.map(l => l.state))].filter(Boolean).sort();
            Utils.populateSelect(stateSelect, states.map(s => ({ value: s, label: s })), 'Todos os Estados');
        }

        const questSelect = document.getElementById('questionarioFilterSelect');
        if (questSelect && questionnaires) {
            Utils.populateSelect(questSelect, questionnaires.map(q => ({ value: q.id, label: q.name })), 'Todos os Questionários');
        }
    }

    // ==================== GRÁFICOS MACRO ====================
    createNpsGauge(nps) {
        const container = document.getElementById('npsGauge');
        if (!container) return;

        this.destroyChart('npsGauge');

        const npsValue = nps?.nps || 0;
        const options = {
            series: [npsValue + 100], // NPS vai de -100 a 100, normalizamos para 0-200
            chart: {
                type: 'radialBar',
                height: 250,
                offsetY: -10
            },
            plotOptions: {
                radialBar: {
                    startAngle: -135,
                    endAngle: 135,
                    hollow: { size: '70%' },
                    track: {
                        background: '#e7e7e7',
                        strokeWidth: '100%'
                    },
                    dataLabels: {
                        name: {
                            show: true,
                            fontSize: '14px',
                            color: '#888',
                            offsetY: 60
                        },
                        value: {
                            show: true,
                            fontSize: '32px',
                            fontWeight: 700,
                            color: npsValue >= 50 ? '#10b981' : npsValue >= 0 ? '#f59e0b' : '#ef4444',
                            offsetY: 10,
                            formatter: () => npsValue
                        }
                    }
                }
            },
            fill: {
                type: 'gradient',
                gradient: {
                    shade: 'dark',
                    type: 'horizontal',
                    colorStops: [
                        { offset: 0, color: '#ef4444' },
                        { offset: 50, color: '#f59e0b' },
                        { offset: 100, color: '#10b981' }
                    ]
                }
            },
            labels: ['NPS Score']
        };

        this.charts.npsGauge = new ApexCharts(container, options);
        this.charts.npsGauge.render();
    }

    createQuestionnaireComparison(questionnaireStats) {
        const container = document.getElementById('questionnaireComparison');
        if (!container) return;

        this.destroyChart('questionnaireComparison');

        const data = (questionnaireStats || []).slice(0, 10);
        if (!data.length) {
            container.innerHTML = '<div class="empty-chart"><i class="fas fa-chart-bar"></i><p>Sem dados</p></div>';
            return;
        }

        const options = {
            series: [{
                name: 'Respostas',
                data: data.map(q => parseInt(q.total_responses) || 0)
            }, {
                name: 'Satisfação',
                data: data.map(q => parseFloat(q.avg_satisfaction)?.toFixed(1) || 0)
            }],
            chart: {
                type: 'bar',
                height: 300,
                toolbar: { show: false },
                events: {
                    dataPointSelection: (event, chartContext, config) => {
                        const questionnaire = data[config.dataPointIndex];
                        if (questionnaire) {
                            this.loadQuestionnaireView(questionnaire.id, questionnaire.name);
                        }
                    }
                }
            },
            plotOptions: {
                bar: {
                    horizontal: true,
                    barHeight: '70%',
                    dataLabels: { position: 'top' }
                }
            },
            colors: ['#3b82f6', '#10b981'],
            dataLabels: { enabled: false },
            xaxis: {
                categories: data.map(q => q.name?.substring(0, 25) || 'Sem nome')
            },
            yaxis: [
                { title: { text: 'Respostas' } },
                { opposite: true, title: { text: 'Satisfação' }, max: 10 }
            ],
            tooltip: {
                shared: true,
                intersect: false
            },
            legend: { position: 'top' }
        };

        this.charts.questionnaireComparison = new ApexCharts(container, options);
        this.charts.questionnaireComparison.render();
    }

    createTrendsChart(trends) {
        const container = document.getElementById('trendsChart');
        if (!container) return;

        this.destroyChart('trendsChart');

        const data = trends || [];
        if (!data.length) {
            container.innerHTML = '<div class="empty-chart"><i class="fas fa-chart-line"></i><p>Sem dados de tendência</p></div>';
            return;
        }

        const options = {
            series: [{
                name: 'Respostas',
                type: 'column',
                data: data.map(t => parseInt(t.count) || 0)
            }, {
                name: 'Satisfação Média',
                type: 'line',
                data: data.map(t => parseFloat(t.avg_satisfaction)?.toFixed(1) || 0)
            }],
            chart: {
                height: 300,
                toolbar: { show: false }
            },
            stroke: { width: [0, 3] },
            colors: ['#3b82f6', '#10b981'],
            xaxis: {
                categories: data.map(t => t.date),
                labels: { rotate: -45 }
            },
            yaxis: [
                { title: { text: 'Respostas' } },
                { opposite: true, title: { text: 'Satisfação' }, max: 10, min: 0 }
            ],
            tooltip: { shared: true },
            legend: { position: 'top' }
        };

        this.charts.trendsChart = new ApexCharts(container, options);
        this.charts.trendsChart.render();
    }

    createStateTreemap(stateStats) {
        const container = document.getElementById('stateTreemap');
        if (!container) return;

        this.destroyChart('stateTreemap');

        const data = (stateStats || []).filter(s => s.state && s.total_responses > 0);
        if (!data.length) {
            container.innerHTML = '<div class="empty-chart"><i class="fas fa-map"></i><p>Sem dados por estado</p></div>';
            return;
        }

        const options = {
            series: [{
                data: data.map(s => ({
                    x: s.state,
                    y: parseInt(s.total_responses) || 0,
                    fillColor: this.getSatisfactionColor(parseFloat(s.avg_satisfaction) || 0)
                }))
            }],
            chart: {
                type: 'treemap',
                height: 300,
                toolbar: { show: false },
                events: {
                    dataPointSelection: (event, chartContext, config) => {
                        const state = data[config.dataPointIndex];
                        if (state) {
                            this.loadStateView(state.state);
                        }
                    }
                }
            },
            plotOptions: {
                treemap: {
                    distributed: true,
                    enableShades: false
                }
            },
            tooltip: {
                y: {
                    formatter: (value, { dataPointIndex }) => {
                        const state = data[dataPointIndex];
                        const avg = parseFloat(state?.avg_satisfaction)?.toFixed(1) || 0;
                        return `${value} respostas (Média: ${avg})`;
                    }
                }
            }
        };

        this.charts.stateTreemap = new ApexCharts(container, options);
        this.charts.stateTreemap.render();
    }

    createSatisfactionDonut(satisfaction) {
        const container = document.getElementById('satisfactionDonut');
        if (!container) return;

        this.destroyChart('satisfactionDonut');

        const categories = ['Muito Insatisfeito', 'Insatisfeito', 'Neutro', 'Satisfeito', 'Muito Satisfeito'];
        const colors = ['#ef4444', '#f59e0b', '#6b7280', '#10b981', '#059669'];
        const safeData = Array.isArray(satisfaction) ? satisfaction : [];

        const values = categories.map(cat => {
            const item = safeData.find(d => d.category === cat);
            return item ? parseInt(item.count) : 0;
        });

        if (values.every(v => v === 0)) {
            container.innerHTML = '<div class="empty-chart"><i class="fas fa-chart-pie"></i><p>Sem dados</p></div>';
            return;
        }

        const options = {
            series: values,
            chart: {
                type: 'donut',
                height: 300
            },
            labels: categories,
            colors: colors,
            legend: {
                position: 'bottom',
                fontSize: '12px'
            },
            plotOptions: {
                pie: {
                    donut: {
                        size: '65%',
                        labels: {
                            show: true,
                            total: {
                                show: true,
                                label: 'Total',
                                fontSize: '14px',
                                fontWeight: 600
                            }
                        }
                    }
                }
            },
            responsive: [{
                breakpoint: 480,
                options: { legend: { position: 'bottom' } }
            }]
        };

        this.charts.satisfactionDonut = new ApexCharts(container, options);
        this.charts.satisfactionDonut.render();
    }

    renderCriticalAlerts(critical) {
        const container = document.getElementById('criticalAlerts');
        const emptyMsg = document.getElementById('emptyAlerts');
        if (!container) return;

        Utils.clearContainer(container);

        if (!critical || !critical.length) {
            Utils.hide(container);
            Utils.show(emptyMsg);
            return;
        }

        Utils.show(container);
        Utils.hide(emptyMsg);

        critical.forEach(q => {
            const alert = document.createElement('div');
            alert.className = `critical-alert severity-${q.severity}`;
            alert.innerHTML = `
                <div class="alert-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="alert-content">
                    <div class="alert-question">${q.text}</div>
                    <div class="alert-meta">
                        <span class="questionnaire-name">${q.questionnaire_name}</span>
                        <span class="response-count">${q.total_responses} respostas</span>
                    </div>
                </div>
                <div class="alert-score">
                    <span class="score-value">${parseFloat(q.avg_satisfaction).toFixed(1)}</span>
                    <span class="score-label">média</span>
                </div>
            `;
            alert.addEventListener('click', () => {
                this.showQuestionAnalysis(q.id, q.questionnaire_id);
            });
            container.appendChild(alert);
        });
    }

    // ==================== VISÃO POR ESTADO ====================
    async loadStateView(state) {
        try {
            this.showLoading();
            this.currentState = state;
            this.showView('state');
            this.updateBreadcrumb(state);

            const analysis = await api.get(`/analytics/state/${encodeURIComponent(state)}`);
            if (!analysis) {
                Utils.toast.error('Erro ao carregar dados do estado');
                return;
            }

            // Atualizar header
            document.getElementById('stateTitle').textContent = state;
            document.getElementById('stateResponses').textContent = analysis.overview?.totalResponses || 0;
            document.getElementById('stateAvg').textContent = (analysis.overview?.avgSatisfaction || 0).toFixed(1);

            const vsOverall = parseFloat(analysis.overview?.vsOverall) || 0;
            const vsEl = document.getElementById('stateVsOverall');
            if (vsEl) {
                vsEl.innerHTML = `vs Geral: <strong class="${vsOverall >= 0 ? 'text-success' : 'text-danger'}">${vsOverall >= 0 ? '+' : ''}${vsOverall}</strong>`;
            }

            // Gráficos
            this.createMunicipalityRanking(analysis.municipalityRanking || []);
            this.createStateSatisfaction(analysis.satisfaction || []);
            this.createStateTrends(analysis.trends || []);
            this.createStateNpsGauge(analysis.nps);

        } catch (error) {
            console.error('Erro ao carregar estado:', error);
            Utils.toast.error('Erro ao carregar dados do estado');
        } finally {
            this.hideLoading();
        }
    }

    createMunicipalityRanking(ranking) {
        const container = document.getElementById('municipalityRanking');
        if (!container) return;

        this.destroyChart('municipalityRanking');

        if (!ranking.length) {
            container.innerHTML = '<div class="empty-chart"><i class="fas fa-trophy"></i><p>Sem municípios</p></div>';
            return;
        }

        const data = ranking.slice(0, 10);
        const options = {
            series: [{
                name: 'Satisfação',
                data: data.map(m => parseFloat(m.avg_satisfaction)?.toFixed(1) || 0)
            }],
            chart: {
                type: 'bar',
                height: 300,
                toolbar: { show: false }
            },
            plotOptions: {
                bar: { horizontal: true, barHeight: '60%' }
            },
            colors: data.map(m => this.getSatisfactionColor(parseFloat(m.avg_satisfaction) || 0)),
            dataLabels: {
                enabled: true,
                formatter: val => val.toFixed(1)
            },
            xaxis: {
                categories: data.map(m => m.municipality),
                max: 10
            }
        };

        this.charts.municipalityRanking = new ApexCharts(container, options);
        this.charts.municipalityRanking.render();
    }

    createStateSatisfaction(satisfaction) {
        const container = document.getElementById('stateSatisfaction');
        if (!container) return;

        this.destroyChart('stateSatisfaction');

        const categories = ['Muito Insatisfeito', 'Insatisfeito', 'Neutro', 'Satisfeito', 'Muito Satisfeito'];
        const colors = ['#ef4444', '#f59e0b', '#6b7280', '#10b981', '#059669'];
        const values = categories.map(cat => {
            const item = (satisfaction || []).find(d => d.category === cat);
            return item ? parseInt(item.count) : 0;
        });

        const options = {
            series: values,
            chart: { type: 'pie', height: 280 },
            labels: categories,
            colors: colors,
            legend: { position: 'bottom', fontSize: '11px' }
        };

        this.charts.stateSatisfaction = new ApexCharts(container, options);
        this.charts.stateSatisfaction.render();
    }

    createStateTrends(trends) {
        const container = document.getElementById('stateTrends');
        if (!container) return;

        this.destroyChart('stateTrends');

        if (!trends.length) {
            container.innerHTML = '<div class="empty-chart"><i class="fas fa-chart-area"></i><p>Sem dados</p></div>';
            return;
        }

        const options = {
            series: [{
                name: 'Respostas',
                data: trends.map(t => parseInt(t.count) || 0)
            }],
            chart: {
                type: 'area',
                height: 250,
                toolbar: { show: false }
            },
            colors: ['#3b82f6'],
            fill: {
                type: 'gradient',
                gradient: { opacityFrom: 0.5, opacityTo: 0.1 }
            },
            xaxis: { categories: trends.map(t => t.date) },
            stroke: { curve: 'smooth', width: 2 }
        };

        this.charts.stateTrends = new ApexCharts(container, options);
        this.charts.stateTrends.render();
    }

    createStateNpsGauge(nps) {
        const container = document.getElementById('stateNpsGauge');
        if (!container) return;

        this.destroyChart('stateNpsGauge');

        const npsValue = nps?.nps || 0;
        const options = {
            series: [npsValue + 100],
            chart: { type: 'radialBar', height: 200 },
            plotOptions: {
                radialBar: {
                    startAngle: -135,
                    endAngle: 135,
                    hollow: { size: '65%' },
                    dataLabels: {
                        name: { show: true, fontSize: '12px', offsetY: 50 },
                        value: {
                            show: true,
                            fontSize: '24px',
                            fontWeight: 700,
                            color: npsValue >= 50 ? '#10b981' : npsValue >= 0 ? '#f59e0b' : '#ef4444',
                            offsetY: 5,
                            formatter: () => npsValue
                        }
                    }
                }
            },
            fill: { colors: [npsValue >= 50 ? '#10b981' : npsValue >= 0 ? '#f59e0b' : '#ef4444'] },
            labels: ['NPS']
        };

        this.charts.stateNpsGauge = new ApexCharts(container, options);
        this.charts.stateNpsGauge.render();
    }

    // ==================== VISÃO POR QUESTIONÁRIO ====================
    async loadQuestionnaireView(questionnaireId, name) {
        try {
            this.showLoading();
            this.currentQuestionnaire = { id: questionnaireId, name };
            this.showView('questionnaire');
            this.updateBreadcrumb(name || 'Questionário');

            const [analysis, questions] = await Promise.all([
                api.get(`/analytics/questionnaire/${questionnaireId}`),
                api.get(`/analytics/questionnaire/${questionnaireId}/questions`)
            ]);

            if (!analysis) {
                Utils.toast.error('Erro ao carregar questionário');
                return;
            }

            // Header
            document.getElementById('questionnaireTitle').textContent = name || 'Questionário';
            document.getElementById('qResponses').textContent = analysis.totalResponses || 0;
            document.getElementById('qAvg').textContent = (analysis.avgSatisfaction || 0).toFixed(1);

            // Gráficos
            this.createQuestionsBarChart(questions || []);
            this.createQuestionsRadar(questions || []);

        } catch (error) {
            console.error('Erro ao carregar questionário:', error);
        } finally {
            this.hideLoading();
        }
    }

    createQuestionsBarChart(questions) {
        const container = document.getElementById('questionsBarChart');
        if (!container) return;

        this.destroyChart('questionsBarChart');

        const scaleQuestions = questions.filter(q => q.type === 'scale' && q.avg_satisfaction);
        if (!scaleQuestions.length) {
            container.innerHTML = '<div class="empty-chart"><i class="fas fa-question-circle"></i><p>Sem perguntas de escala</p></div>';
            return;
        }

        const options = {
            series: [{
                name: 'Média',
                data: scaleQuestions.map(q => parseFloat(q.avg_satisfaction)?.toFixed(1) || 0)
            }],
            chart: {
                type: 'bar',
                height: 350,
                toolbar: { show: false },
                events: {
                    dataPointSelection: (event, chartContext, config) => {
                        const question = scaleQuestions[config.dataPointIndex];
                        if (question) {
                            this.showQuestionAnalysis(question.id, this.currentQuestionnaire?.id);
                        }
                    }
                }
            },
            plotOptions: {
                bar: { horizontal: true, barHeight: '50%' }
            },
            colors: scaleQuestions.map(q => q.isCritical ? '#ef4444' : this.getSatisfactionColor(parseFloat(q.avg_satisfaction) || 0)),
            dataLabels: {
                enabled: true,
                formatter: val => val.toFixed(1),
                style: { colors: ['#fff'] }
            },
            xaxis: {
                categories: scaleQuestions.map((q, i) => `${i + 1}. ${q.text?.substring(0, 40)}...`),
                max: 10
            },
            tooltip: {
                y: {
                    formatter: (val, { dataPointIndex }) => {
                        const q = scaleQuestions[dataPointIndex];
                        return `${val} (${q.total_responses} respostas)`;
                    }
                }
            }
        };

        this.charts.questionsBarChart = new ApexCharts(container, options);
        this.charts.questionsBarChart.render();
    }

    createQuestionsRadar(questions) {
        const container = document.getElementById('questionsRadar');
        if (!container) return;

        this.destroyChart('questionsRadar');

        const scaleQuestions = questions.filter(q => q.type === 'scale' && q.avg_satisfaction).slice(0, 8);
        if (scaleQuestions.length < 3) {
            container.innerHTML = '<div class="empty-chart"><i class="fas fa-spider"></i><p>Mínimo 3 perguntas</p></div>';
            return;
        }

        const options = {
            series: [{
                name: 'Média',
                data: scaleQuestions.map(q => parseFloat(q.avg_satisfaction)?.toFixed(1) || 0)
            }],
            chart: { type: 'radar', height: 300, toolbar: { show: false } },
            xaxis: {
                categories: scaleQuestions.map((q, i) => `P${i + 1}`)
            },
            yaxis: { max: 10 },
            colors: ['#3b82f6'],
            markers: { size: 4 },
            fill: { opacity: 0.3 }
        };

        this.charts.questionsRadar = new ApexCharts(container, options);
        this.charts.questionsRadar.render();
    }

    // ==================== MODAL DE ANÁLISE DE PERGUNTA ====================
    async showQuestionAnalysis(questionId, questionnaireId) {
        try {
            const [analysis, stateComparison] = await Promise.all([
                api.get(`/analytics/questions/${questionId}`),
                api.get(`/analytics/questions/${questionId}/states`)
            ]);

            if (!analysis) return;

            const modal = document.getElementById('modalQuestionAnalysis');
            document.getElementById('questionAnalysisTitle').textContent = 'Análise da Pergunta';
            document.getElementById('questionAnalysisText').textContent = analysis.question?.text || '';
            document.getElementById('questionAnalysisType').textContent = this.getTypeLabel(analysis.question?.type);

            const data = analysis.data || [];
            document.getElementById('questionAnalysisCount').textContent = data.reduce((sum, d) => sum + parseInt(d.count || 0), 0);

            if (analysis.question?.type === 'scale') {
                const avg = data.reduce((sum, d) => sum + (d.value * d.count), 0) / data.reduce((sum, d) => sum + d.count, 0);
                document.getElementById('questionAnalysisAvg').textContent = avg.toFixed(1);
            } else {
                document.getElementById('questionAnalysisAvg').textContent = '-';
            }

            this.createQuestionDistributionChart(analysis.question?.type, data);
            this.createQuestionStateComparison(stateComparison || []);

            Utils.openModal(modal);
        } catch (error) {
            console.error('Erro ao carregar análise:', error);
        }
    }

    createQuestionDistributionChart(type, data) {
        const container = document.getElementById('questionDistributionChart');
        if (!container) return;

        this.destroyChart('questionDistributionChart');

        if (type === 'scale') {
            const options = {
                series: [{ name: 'Respostas', data: data.map(d => parseInt(d.count)) }],
                chart: { type: 'bar', height: 250, toolbar: { show: false } },
                colors: data.map(d => this.getSatisfactionColor(d.value)),
                xaxis: { categories: data.map(d => d.value) },
                plotOptions: { bar: { distributed: true } }
            };
            this.charts.questionDistributionChart = new ApexCharts(container, options);
            this.charts.questionDistributionChart.render();
        } else if (type === 'boolean') {
            const options = {
                series: data.map(d => parseInt(d.count)),
                chart: { type: 'pie', height: 250 },
                labels: data.map(d => d.value === 'true' ? 'Sim' : 'Não'),
                colors: ['#10b981', '#ef4444']
            };
            this.charts.questionDistributionChart = new ApexCharts(container, options);
            this.charts.questionDistributionChart.render();
        }
    }

    createQuestionStateComparison(stateData) {
        const container = document.getElementById('questionStateComparison');
        if (!container) return;

        this.destroyChart('questionStateComparison');

        if (!stateData.length) {
            container.innerHTML = '<p class="text-muted">Sem dados por estado</p>';
            return;
        }

        const options = {
            series: [{ name: 'Média', data: stateData.map(s => parseFloat(s.avg_satisfaction)?.toFixed(1) || 0) }],
            chart: { type: 'bar', height: 200, toolbar: { show: false } },
            colors: stateData.map(s => this.getSatisfactionColor(parseFloat(s.avg_satisfaction))),
            xaxis: { categories: stateData.map(s => s.state) },
            plotOptions: { bar: { distributed: true } },
            yaxis: { max: 10 }
        };

        this.charts.questionStateComparison = new ApexCharts(container, options);
        this.charts.questionStateComparison.render();
    }

    // ==================== HELPERS ====================
    getSatisfactionColor(value) {
        if (value >= 8) return '#059669';
        if (value >= 6) return '#10b981';
        if (value >= 4) return '#f59e0b';
        return '#ef4444';
    }

    getTypeLabel(type) {
        const labels = { scale: 'Escala', boolean: 'Sim/Não', text: 'Texto', multiple: 'Múltipla' };
        return labels[type] || type;
    }

    destroyChart(chartName) {
        if (this.charts[chartName]) {
            this.charts[chartName].destroy();
            this.charts[chartName] = null;
        }
    }

    exportCSV() {
        const params = new URLSearchParams(this.filters);
        window.location.href = `${API_URL}/export/csv?${params}`;
    }

    showLoading() { Utils.show(document.getElementById('loadingOverlay')); }
    hideLoading() { Utils.hide(document.getElementById('loadingOverlay')); }
}

// ==================== GERENCIADOR DE SUGESTÕES ====================
class SuggestionsManager {
    constructor() {
        this.filters = { questionnaire_id: '' };
    }

    async init() {
        this.bindEvents();
        await this.load();
    }

    bindEvents() {
        document.getElementById('filtroQuestionarioSugestoes')?.addEventListener('change', (e) => {
            this.filters.questionnaire_id = e.target.value;
            this.load();
        });

        document.getElementById('sortOrderSugestoes')?.addEventListener('change', () => {
            this.load();
        });
    }

    async load() {
        try {
            Utils.show(document.getElementById('loadingSugestoes'));
            Utils.hide(document.getElementById('emptySugestoes'));

            const params = new URLSearchParams();
            if (this.filters.questionnaire_id) {
                params.append('questionnaire_id', this.filters.questionnaire_id);
            }

            const result = await api.get(`/suggestions?${params}`);
            const suggestions = result?.data || result || [];

            // Atualizar contador
            const countEl = document.getElementById('totalSugestoesCount');
            if (countEl) {
                const total = result?.pagination?.total || suggestions.length;
                countEl.textContent = `${total} sugestões`;
            }

            this.render(suggestions);
        } catch (error) {
            console.error('Erro ao carregar sugestões:', error);
            Utils.toast.error('Erro ao carregar sugestões');
        } finally {
            Utils.hide(document.getElementById('loadingSugestoes'));
        }
    }

    render(suggestions) {
        const container = document.getElementById('sugestoesGrid');
        if (!container) return;

        Utils.clearContainer(container);

        if (!suggestions.length) {
            Utils.show(document.getElementById('emptySugestoes'));
            return;
        }

        Utils.hide(document.getElementById('emptySugestoes'));

        suggestions.forEach(s => {
            const card = Utils.cloneTemplate('template-sugestao-card');
            if (!card) return;

            const autorNome = s.is_anonymous ? 'Anônimo' : (s.respondent_name || 'Não informado');
            const autorCargo = s.respondent_position || '-';
            const local = s.municipality && s.state ? `${s.municipality}, ${s.state}` : '-';

            Utils.setText(card, '.autor-nome', autorNome);
            Utils.setText(card, '.autor-cargo', autorCargo);
            Utils.setText(card, '.local-text', local);
            Utils.setText(card, '.data-text', Utils.formatDate(s.submitted_at));
            Utils.setText(card, '.pergunta-titulo', s.question_text || '');
            Utils.setText(card, '.sugestao-texto', s.suggestion_text);
            Utils.setText(card, '.nome-text', s.questionnaire_name || '');

            container.appendChild(card);
        });
    }

    async populateFilters(questionnaires) {
        const select = document.getElementById('filtroQuestionarioSugestoes');
        if (select && questionnaires) {
            Utils.populateSelect(
                select,
                questionnaires.map(q => ({ value: q.id, label: q.name })),
                'Todos os Questionários'
            );
        }
    }
}

// ==================== GERENCIADOR DE RESPOSTAS ====================
class ResponsesManager {
    constructor() {
        this.filters = { questionnaire_id: '', state: '' };
        this.responses = [];
    }

    async init() {
        this.bindEvents();
        await this.load();
        await this.populateFilters();
    }

    bindEvents() {
        document.getElementById('filtroQuestionarioRespostas')?.addEventListener('change', (e) => {
            this.filters.questionnaire_id = e.target.value;
            this.load();
        });

        document.getElementById('filtroEstadoRespostas')?.addEventListener('change', (e) => {
            this.filters.state = e.target.value;
            this.load();
        });

        document.getElementById('sortOrderRespostas')?.addEventListener('change', () => {
            this.load();
        });
    }

    async load() {
        try {
            Utils.show(document.getElementById('loadingRespostas'));
            Utils.hide(document.getElementById('emptyRespostas'));

            const params = new URLSearchParams();
            if (this.filters.questionnaire_id) {
                params.append('questionnaire_id', this.filters.questionnaire_id);
            }
            if (this.filters.state) {
                params.append('state', this.filters.state);
            }

            const result = await api.get(`/responses?${params}`);
            this.responses = result?.data || result || [];

            // Atualizar contador
            const countEl = document.getElementById('totalRespostasCount');
            if (countEl) {
                const total = result?.pagination?.total || this.responses.length;
                countEl.textContent = `${total} respostas`;
            }

            this.render();
        } catch (error) {
            console.error('Erro ao carregar respostas:', error);
            Utils.toast.error('Erro ao carregar respostas');
        } finally {
            Utils.hide(document.getElementById('loadingRespostas'));
        }
    }

    render() {
        const container = document.getElementById('respostasGrid');
        if (!container) return;

        Utils.clearContainer(container);

        // Aplicar ordenação
        const sortOrder = document.getElementById('sortOrderRespostas')?.value || 'newest';
        const sortedResponses = [...this.responses].sort((a, b) => {
            const dateA = new Date(a.submitted_at);
            const dateB = new Date(b.submitted_at);
            return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
        });

        if (!sortedResponses.length) {
            Utils.show(document.getElementById('emptyRespostas'));
            return;
        }

        Utils.hide(document.getElementById('emptyRespostas'));

        sortedResponses.forEach(r => {
            const card = Utils.cloneTemplate('template-resposta-card');
            if (!card) return;

            const nome = r.is_anonymous ? 'Anônimo' : (r.respondent_name || 'Não informado');
            const cargo = r.respondent_position || '-';
            const local = r.municipality && r.state ? `${r.municipality}, ${r.state}` : '-';

            Utils.setText(card, '.respondente-nome', nome);
            Utils.setText(card, '.respondente-cargo', cargo);
            Utils.setText(card, '.local-text', local);
            Utils.setText(card, '.data-text', Utils.formatDate(r.submitted_at));
            Utils.setText(card, '.questionario-text', r.questionnaire_name || 'Questionário');

            // Evento para ver detalhes
            card.querySelector('.btn-ver-detalhes')?.addEventListener('click', () => {
                this.showDetails(r.id);
            });

            container.appendChild(card);
        });
    }

    async showDetails(responseId) {
        try {
            const response = await api.get(`/responses/${responseId}`);
            if (!response) {
                Utils.toast.error('Erro ao carregar detalhes');
                return;
            }

            // Preencher modal
            const nome = response.is_anonymous ? 'Anônimo' : (response.respondent_name || 'Não informado');
            document.getElementById('modalRespondenteNome').textContent = nome;
            document.getElementById('modalRespondenteCargo').textContent = response.respondent_position || '-';

            const local = response.municipality && response.state ? `${response.municipality}, ${response.state}` : '-';
            document.getElementById('modalRespostaLocal').textContent = local;
            document.getElementById('modalRespostaData').textContent = Utils.formatDate(response.submitted_at);

            // Renderizar respostas
            const listContainer = document.getElementById('modalRespostasList');
            Utils.clearContainer(listContainer);

            const tipoLabels = { scale: 'Escala', boolean: 'Sim/Não', text: 'Texto', multiple: 'Múltipla' };
            const answers = response.answers || [];

            answers.forEach((answer, index) => {
                const item = Utils.cloneTemplate('template-resposta-detalhe');
                if (!item) return;

                Utils.setText(item, '.pergunta-numero', `${index + 1}.`);
                Utils.setText(item, '.pergunta-tipo-badge', tipoLabels[answer.type] || answer.type);
                Utils.setText(item, '.pergunta-texto', answer.question_text || '');

                // Formatar valor da resposta
                let valorFormatado = answer.value || '-';
                if (answer.type === 'boolean') {
                    valorFormatado = answer.value === 'true' ? 'Sim' : 'Não';
                } else if (answer.type === 'scale' && answer.numeric_value) {
                    valorFormatado = `${answer.numeric_value}/10`;
                }

                Utils.setText(item, '.resposta-valor', valorFormatado);
                listContainer.appendChild(item);
            });

            Utils.openModal('modalDetalhesResposta');
        } catch (error) {
            console.error('Erro ao carregar detalhes:', error);
            Utils.toast.error('Erro ao carregar detalhes da resposta');
        }
    }

    async populateFilters() {
        // Populate questionário filter
        const questionnaires = await api.get('/questionnaires');
        const questSelect = document.getElementById('filtroQuestionarioRespostas');
        if (questSelect && questionnaires) {
            Utils.populateSelect(
                questSelect,
                questionnaires.map(q => ({ value: q.id, label: q.name })),
                'Todos os Questionários'
            );
        }

        // Populate estado filter
        const locations = await api.get('/locations');
        const stateSelect = document.getElementById('filtroEstadoRespostas');
        if (stateSelect && locations) {
            const states = [...new Set(locations.map(l => l.state))].filter(Boolean).sort();
            Utils.populateSelect(
                stateSelect,
                states.map(s => ({ value: s, label: s })),
                'Todos os Estados'
            );
        }
    }
}

// ==================== GERENCIADOR DE LOCAIS ====================
class LocalManager {
    constructor() {
        this.estados = [];
        this.selectedUF = null;
    }

    async init() {
        await this.loadEstados();
        this.bindEvents();
        await this.loadVinculos();
    }

    async loadEstados() {
        this.estados = await ibgeApi.getEstados();
        const select = document.getElementById('selectEstado');
        if (!select) return;

        Utils.populateSelect(
            select,
            this.estados.map(e => ({
                value: e.id,
                label: e.nome,
                data: { sigla: e.sigla, nome: e.nome }
            })),
            'Selecione o estado'
        );
    }

    bindEvents() {
        document.getElementById('selectEstado')?.addEventListener('change', async (e) => {
            const option = e.target.selectedOptions[0];
            this.selectedUF = { id: e.target.value, sigla: option?.dataset.sigla, nome: option?.dataset.nome };
            await this.loadMunicipios(e.target.value);
        });

        // Abrir modal de novo vinculo
        document.getElementById('btnNovoVinculo')?.addEventListener('click', () => {
            Utils.openModal('modalNovoVinculo');
        });

        // Fechar modal de novo vinculo
        document.getElementById('modalNovoVinculoClose')?.addEventListener('click', () => {
            Utils.closeModal('modalNovoVinculo');
        });
        document.getElementById('modalNovoVinculoCancel')?.addEventListener('click', () => {
            Utils.closeModal('modalNovoVinculo');
        });
        document.getElementById('modalNovoVinculoOverlay')?.addEventListener('click', () => {
            Utils.closeModal('modalNovoVinculo');
        });

        // Salvar vinculo via botao do modal
        document.getElementById('modalNovoVinculoSave')?.addEventListener('click', async () => {
            await this.vincularLocal();
        });

        document.getElementById('formDefinirLocal')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.vincularLocal();
        });
    }

    async loadMunicipios(ufId) {
        const select = document.getElementById('selectMunicipio');
        if (!select) return;

        if (!ufId) {
            Utils.populateSelect(select, [], 'Selecione o município');
            select.disabled = true;
            return;
        }

        Utils.populateSelect(select, [], 'Carregando...');
        select.disabled = true;

        const municipios = await ibgeApi.getMunicipios(ufId);
        Utils.populateSelect(
            select,
            municipios.map(m => ({ value: m.nome, label: m.nome })),
            'Selecione o município'
        );
        select.disabled = false;
    }

    async vincularLocal() {
        const questionarioId = document.getElementById('selectQuestionario')?.value;
        const municipio = document.getElementById('selectMunicipio')?.value;
        const estado = this.selectedUF?.nome;

        if (!questionarioId || !municipio || !estado) {
            Utils.toast.warning('Preencha todos os campos');
            return;
        }

        const result = await api.patch(`/questionnaires/${questionarioId}/location`, { state: estado, municipality: municipio });

        if (result && !result.error) {
            Utils.toast.success('Local vinculado com sucesso!');
            await this.loadVinculos();
            document.getElementById('formDefinirLocal')?.reset();
            document.getElementById('selectMunicipio').disabled = true;
            Utils.closeModal('modalNovoVinculo');
        } else {
            Utils.toast.error('Erro ao vincular local');
        }
    }

    async loadVinculos() {
        const questionnaires = await api.get('/questionnaires');
        this.renderVinculos(questionnaires || []);
    }

    renderVinculos(questionnaires) {
        const tbody = document.getElementById('corpoTabelaVinculos');
        const emptyMsg = document.getElementById('emptyVinculos');
        if (!tbody) return;

        const comLocal = questionnaires.filter(q => q.state && q.municipality);

        Utils.clearContainer(tbody);

        if (!comLocal.length) {
            Utils.show(emptyMsg);
            return;
        }

        Utils.hide(emptyMsg);

        comLocal.forEach(q => {
            const row = Utils.cloneTemplate('templateVinculoRow');
            if (!row) return;

            Utils.setText(row, '.vinculo-questionario', q.name);
            Utils.setText(row, '.vinculo-estado', q.state);
            Utils.setText(row, '.vinculo-municipio', q.municipality);
            Utils.setText(row, '.vinculo-data', Utils.formatDate(q.created_at));

            const statusBadge = row.querySelector('.status-badge');
            if (statusBadge) {
                statusBadge.textContent = q.is_active ? 'Ativo' : 'Inativo';
                statusBadge.className = `status-badge ${q.is_active ? 'status-ativo' : 'status-inativo'}`;
            }

            // Event listeners para botões de ação
            row.querySelector('.btn-edit')?.addEventListener('click', () => this.editarVinculo(q));
            row.querySelector('.btn-toggle')?.addEventListener('click', () => this.toggleVinculoStatus(q.id));
            row.querySelector('.btn-delete')?.addEventListener('click', () => this.removerLocal(q.id));
            row.querySelector('.btn-copy-link')?.addEventListener('click', () => this.copiarLinkQuestionario(q.id));
            tbody.appendChild(row);
        });
    }

    async removerLocal(questionarioId) {
        const confirmed = await Utils.confirm('Remover local?', 'O questionário ficará sem local definido');
        if (!confirmed) return;

        await api.patch(`/questionnaires/${questionarioId}/location`, { state: null, municipality: null });
        Utils.toast.success('Local removido');
        await this.loadVinculos();
    }

    async editarVinculo(questionario) {
        // Abre o modal de novo vinculo preenchido para edição
        Utils.openModal('modalNovoVinculo');

        // Preenche o select de questionário
        const selectQuestionario = document.getElementById('selectQuestionario');
        if (selectQuestionario) {
            selectQuestionario.value = questionario.id;
        }

        Utils.toast.info('Edite os dados e salve');
    }

    async toggleVinculoStatus(questionarioId) {
        const result = await api.patch(`/questionnaires/${questionarioId}/toggle`);
        if (result) {
            Utils.toast.success(`Vínculo ${result.is_active ? 'ativado' : 'desativado'}`);
            await this.loadVinculos();
        }
    }

    copiarLinkQuestionario(questionarioId) {
        const baseUrl = window.location.origin;
        const link = `${baseUrl}/quest.html?q=${questionarioId}`;

        navigator.clipboard.writeText(link).then(() => {
            Utils.toast.success('Link copiado para a área de transferência!');
        }).catch(() => {
            // Fallback para navegadores que não suportam clipboard API
            const input = document.createElement('input');
            input.value = link;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            Utils.toast.success('Link copiado!');
        });
    }
}

// ==================== GERENCIADOR DE QUESTIONÁRIOS ====================
class QuestionnaireManager {
    constructor() {
        this.questionnaires = [];
        this.selectedId = null;
        this.questions = [];
    }

    async init() {
        this.bindEvents();
        await this.load();
    }

    bindEvents() {
        // Modal Novo Questionario - Abrir
        document.getElementById('btnNovoQuestionario')?.addEventListener('click', () => {
            Utils.openModal('modalNovoQuestionario');
        });

        // Modal Novo Questionario - Fechar
        document.getElementById('modalNovoQuestionarioClose')?.addEventListener('click', () => {
            Utils.closeModal('modalNovoQuestionario');
        });
        document.getElementById('modalNovoQuestionarioCancel')?.addEventListener('click', () => {
            Utils.closeModal('modalNovoQuestionario');
        });
        document.getElementById('modalNovoQuestionarioOverlay')?.addEventListener('click', () => {
            Utils.closeModal('modalNovoQuestionario');
        });

        // Modal Novo Questionario - Salvar
        document.getElementById('modalNovoQuestionarioSave')?.addEventListener('click', async () => {
            await this.criar();
        });

        document.getElementById('formCriarQuestionario')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.criar();
        });

        // Modal Adicionar Pergunta - Abrir
        document.getElementById('btnAdicionarPergunta')?.addEventListener('click', () => {
            if (this.selectedId) {
                Utils.openModal('modalAdicionarPergunta');
            } else {
                Utils.toast.warning('Selecione um questionario primeiro');
            }
        });

        // Modal Adicionar Pergunta - Fechar
        document.getElementById('modalAdicionarPerguntaClose')?.addEventListener('click', () => {
            Utils.closeModal('modalAdicionarPergunta');
        });
        document.getElementById('modalAdicionarPerguntaCancel')?.addEventListener('click', () => {
            Utils.closeModal('modalAdicionarPergunta');
        });
        document.getElementById('modalAdicionarPerguntaOverlay')?.addEventListener('click', () => {
            Utils.closeModal('modalAdicionarPergunta');
        });

        // Modal Adicionar Pergunta - Salvar
        document.getElementById('modalAdicionarPerguntaSave')?.addEventListener('click', async () => {
            await this.adicionarPergunta();
        });

        document.getElementById('formAdicionarPergunta')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.adicionarPergunta();
        });

        document.getElementById('tipoPergunta')?.addEventListener('change', (e) => {
            Utils.toggle(document.getElementById('grupoEscala'), e.target.value === 'escala');
        });

        // Modal Editar Pergunta - Fechar
        document.getElementById('editPerguntaModalClose')?.addEventListener('click', () => {
            Utils.closeModal('editPerguntaModal');
        });
        document.getElementById('editPerguntaModalCancel')?.addEventListener('click', () => {
            Utils.closeModal('editPerguntaModal');
        });
    }

    async load() {
        const data = await api.get('/questionnaires');
        this.questionnaires = Array.isArray(data) ? data : [];
        this.render();
        this.populateSelect();
    }

    render() {
        const container = document.getElementById('listaQuestionarios');
        const emptyMsg = document.getElementById('emptyQuestionarios');
        if (!container) return;

        Utils.clearContainer(container);

        if (!this.questionnaires.length) {
            Utils.show(emptyMsg);
            return;
        }

        Utils.hide(emptyMsg);

        this.questionnaires.forEach(q => {
            const item = Utils.cloneTemplate('templateQuestionarioItem');
            if (!item) return;

            const div = item.querySelector('.questionario-item');
            div.dataset.id = q.id;
            if (this.selectedId === q.id) div.classList.add('selected');

            Utils.setText(item, '.questionario-nome', q.name);
            Utils.setText(item, '.questionario-total', `${q.question_count || 0} perguntas`);

            const statusBadge = item.querySelector('.status-badge');
            if (statusBadge) {
                statusBadge.textContent = q.is_active ? 'Ativo' : 'Inativo';
                statusBadge.className = `status-badge ${q.is_active ? 'status-ativo' : 'status-inativo'}`;
            }

            // Event listeners
            item.querySelector('.questionario-info')?.addEventListener('click', () => this.selecionar(q.id));
            item.querySelector('.btn-add-pergunta')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectedId = q.id;
                Utils.setText(document, '#badgeQuestionarioAtual', q.name);
                Utils.openModal('modalAdicionarPergunta');
            });
            item.querySelector('.btn-toggle')?.addEventListener('click', (e) => { e.stopPropagation(); this.toggleActive(q.id); });
            item.querySelector('.btn-delete')?.addEventListener('click', (e) => { e.stopPropagation(); this.excluir(q.id); });

            container.appendChild(item);
        });
    }

    populateSelect() {
        const select = document.getElementById('selectQuestionario');
        if (!select) return;
        Utils.populateSelect(
            select,
            this.questionnaires.map(q => ({ value: q.id, label: q.name })),
            'Selecione o questionário'
        );
    }

    async criar() {
        const input = document.getElementById('nomeQuestionario');
        const nome = input?.value?.trim();

        if (!nome) {
            Utils.toast.warning('Digite o nome do questionário');
            return;
        }

        const result = await api.post('/questionnaires', { name: nome });
        if (result && !result.error) {
            Utils.toast.success('Questionário criado!');
            input.value = '';
            Utils.closeModal('modalNovoQuestionario');
            await this.load();
            this.selecionar(result.id);
        } else {
            Utils.toast.error('Erro ao criar questionário');
        }
    }

    async selecionar(id) {
        const data = await api.get(`/questionnaires/${id}`);
        if (!data) return;

        this.selectedId = id;
        this.questions = data.questions || [];

        Utils.show(document.getElementById('cardPerguntas'));
        Utils.setText(document, '#badgeQuestionarioAtual', data.name);
        Utils.setText(document, '#badgeNomeQuestionario', data.name);

        this.render();
        this.renderPerguntas();
    }

    renderPerguntas() {
        const container = document.getElementById('listaPerguntas');
        const emptyMsg = document.getElementById('emptyPerguntas');
        if (!container) return;

        Utils.clearContainer(container);

        if (!this.questions.length) {
            Utils.show(emptyMsg);
            return;
        }

        Utils.hide(emptyMsg);

        const tipoLabels = { scale: 'Escala', boolean: 'Sim/Não', text: 'Texto', multiple: 'Múltipla' };

        this.questions.forEach((q, index) => {
            const item = Utils.cloneTemplate('templatePerguntaItem');
            if (!item) return;

            item.querySelector('.pergunta-item').dataset.id = q.id;
            Utils.setText(item, '.pergunta-numero', `${index + 1}.`);
            Utils.setText(item, '.pergunta-tipo', tipoLabels[q.type] || q.type);
            Utils.setText(item, '.pergunta-texto', q.text);

            item.querySelector('.btn-edit')?.addEventListener('click', () => this.editarPergunta(q));
            item.querySelector('.btn-delete')?.addEventListener('click', () => this.excluirPergunta(q.id));

            container.appendChild(item);
        });
    }

    async adicionarPergunta() {
        if (!this.selectedId) {
            Utils.toast.warning('Selecione um questionário primeiro');
            return;
        }

        const textoInput = document.getElementById('textoPergunta');
        const tipoSelect = document.getElementById('tipoPergunta');
        const escalaSelect = document.getElementById('valorEscala');

        const texto = textoInput?.value?.trim();
        const tipo = tipoSelect?.value;

        if (!texto || !tipo) {
            Utils.toast.warning('Preencha todos os campos');
            return;
        }

        const tipoMap = { escala: 'scale', simnao: 'boolean', texto: 'text' };
        const options = tipo === 'escala' ? { max: parseInt(escalaSelect?.value) || 10 } : {};

        const result = await api.post(`/questionnaires/${this.selectedId}/questions`, {
            text: texto,
            type: tipoMap[tipo] || tipo,
            options,
            is_required: true
        });

        if (result && !result.error) {
            Utils.toast.success('Pergunta adicionada!');
            textoInput.value = '';
            tipoSelect.value = '';
            Utils.hide(document.getElementById('grupoEscala'));
            Utils.closeModal('modalAdicionarPergunta');
            await this.selecionar(this.selectedId);
            await this.load();
        } else {
            Utils.toast.error('Erro ao adicionar pergunta');
        }
    }

    async editarPergunta(pergunta) {
        const modal = document.getElementById('editPerguntaModal');
        const textoInput = document.getElementById('editPerguntaTexto');
        const tipoSelect = document.getElementById('editPerguntaTipo');
        const saveBtn = document.getElementById('editPerguntaSave');

        textoInput.value = pergunta.text;
        tipoSelect.value = pergunta.type;
        Utils.openModal(modal);

        const save = async () => {
            const texto = textoInput.value.trim();
            const tipo = tipoSelect.value;

            if (!texto) {
                Utils.toast.warning('Digite o texto da pergunta');
                return;
            }

            const result = await api.put(
                `/questionnaires/${this.selectedId}/questions/${pergunta.id}`,
                { text: texto, type: tipo }
            );

            if (result && !result.error) {
                Utils.toast.success('Pergunta atualizada!');
                Utils.closeModal(modal);
                await this.selecionar(this.selectedId);
            } else {
                Utils.toast.error('Erro ao atualizar pergunta');
            }

            saveBtn.removeEventListener('click', save);
        };

        saveBtn.addEventListener('click', save);
    }

    async excluirPergunta(questionId) {
        const confirmed = await Utils.confirm('Excluir pergunta?', 'Esta ação não pode ser desfeita');
        if (!confirmed) return;

        await api.delete(`/questionnaires/${this.selectedId}/questions/${questionId}`);
        Utils.toast.success('Pergunta excluída');
        await this.selecionar(this.selectedId);
        await this.load();
    }

    async excluir(id) {
        const confirmed = await Utils.confirm('Excluir questionário?', 'Esta ação não pode ser desfeita');
        if (!confirmed) return;

        await api.delete(`/questionnaires/${id}`);
        Utils.toast.success('Questionário excluído');

        if (this.selectedId === id) {
            this.selectedId = null;
            Utils.hide(document.getElementById('cardPerguntas'));
        }

        await this.load();
    }

    async toggleActive(id) {
        const result = await api.patch(`/questionnaires/${id}/toggle`);
        if (result) {
            Utils.toast.success(`Questionário ${result.is_active ? 'ativado' : 'desativado'}`);
            await this.load();
        }
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

        // Toggle sidebar para menu mobile - usando ID unico
        document.getElementById('mobileMenuToggle')?.addEventListener('click', () => {
            document.getElementById('sidebar')?.classList.toggle('mobile-open');
        });

        // Toggle sidebar para botoes com data-toggle-sidebar
        document.querySelectorAll('[data-toggle-sidebar]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('sidebar')?.classList.toggle('mobile-open');
            });
        });
    }

    navigateTo(section) {
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        document.querySelector(`[data-section="${section}"]`)?.closest('.nav-item')?.classList.add('active');

        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        document.getElementById(`section-${section}`)?.classList.add('active');

        this.currentSection = section;
    }
}

// ==================== INICIALIZAÇÃO ====================
let dashboard, navigation, localManager, questionnaireManager, suggestionsManager, responsesManager;

document.addEventListener('DOMContentLoaded', async () => {
    navigation = new NavigationManager();
    navigation.init();

    dashboard = new DashboardManager();
    await dashboard.init();

    questionnaireManager = new QuestionnaireManager();
    await questionnaireManager.init();

    localManager = new LocalManager();
    await localManager.init();

    suggestionsManager = new SuggestionsManager();
    await suggestionsManager.init();

    responsesManager = new ResponsesManager();
    await responsesManager.init();

    // Popular filtro de questionários nas sugestões
    const questionnaires = await api.get('/questionnaires');
    if (questionnaires) {
        suggestionsManager.populateFilters(questionnaires);
    }

    // Expor para uso global
    window.dashboard = dashboard;
    window.api = api;
    window.localManager = localManager;
    window.questionnaireManager = questionnaireManager;
    window.suggestionsManager = suggestionsManager;
    window.responsesManager = responsesManager;

    // Fechar modais com ESC (suporta hidden e active)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // Fechar modais que usam hidden
            document.querySelectorAll('.modal:not(.hidden)').forEach(m => {
                if (!m.classList.contains('hidden')) {
                    Utils.closeModal(m);
                }
            });
            // Fechar modais que usam active (compatibilidade)
            document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
        }
    });

    // Event listeners para fechar modal detalhes resposta
    document.getElementById('modalDetalhesRespostaOverlay')?.addEventListener('click', () => {
        Utils.closeModal('modalDetalhesResposta');
    });
    document.getElementById('modalDetalhesRespostaClose')?.addEventListener('click', () => {
        Utils.closeModal('modalDetalhesResposta');
    });
    document.getElementById('modalDetalhesRespostaFechar')?.addEventListener('click', () => {
        Utils.closeModal('modalDetalhesResposta');
    });

    console.log('Dashboard carregado!');
});
