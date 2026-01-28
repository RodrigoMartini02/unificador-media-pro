/**
 * AnalyticsManager - Gerenciador de Análises Detalhadas
 * Controla a página de estatísticas avançadas
 */
class AnalyticsManager {
    constructor() {
        this.charts = {};
        this.currentQuestionnaire = null;
    }

    async init() {
        if (!AuthManager.checkAuth()) return;

        // Carregar lista de questionários
        await this.loadQuestionnaireList();

        // Setup eventos
        this.setupEventListeners();
    }

    setupEventListeners() {
        const questionnaireSelect = document.getElementById('analytics-questionnaire');
        if (questionnaireSelect) {
            questionnaireSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.loadQuestionnaireAnalysis(e.target.value);
                }
            });
        }
    }

    async loadQuestionnaireList() {
        try {
            const questionnaires = await QuestionnairesAPI.getAll();
            const select = document.getElementById('analytics-questionnaire');

            if (select) {
                select.innerHTML = '<option value="">Selecione um questionário</option>';
                questionnaires.forEach(q => {
                    const option = document.createElement('option');
                    option.value = q.id;
                    option.textContent = `${q.name} ${q.is_active ? '' : '(Inativo)'}`;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading questionnaires:', error);
        }
    }

    async loadQuestionnaireAnalysis(questionnaireId) {
        try {
            this.showLoading();
            const filters = window.appState.getFilters();

            // Buscar análise do questionário
            const analysis = await AnalyticsAPI.getQuestionnaireAnalysis(questionnaireId, filters);
            this.currentQuestionnaire = await QuestionnairesAPI.getById(questionnaireId);

            // Atualizar cards de resumo
            this.updateSummaryCards(analysis);

            // Criar gráfico radar com médias por pergunta
            this.createRadarChart(analysis.questionStats);

            // Criar gráficos individuais por pergunta
            await this.createQuestionCharts(questionnaireId, analysis.questionStats, filters);

        } catch (error) {
            console.error('Error loading questionnaire analysis:', error);
        } finally {
            this.hideLoading();
        }
    }

    updateSummaryCards(analysis) {
        const totalEl = document.getElementById('analytics-total');
        const avgEl = document.getElementById('analytics-avg');

        if (totalEl) totalEl.textContent = analysis.totalResponses;
        if (avgEl) avgEl.textContent = analysis.avgSatisfaction?.toFixed(1) || '-';
    }

    createRadarChart(questionStats) {
        const container = document.getElementById('radar-chart');
        if (!container) return;

        ChartFactory.destroy(this.charts.radar);
        container.innerHTML = '';

        if (questionStats && questionStats.length > 0) {
            this.charts.radar = ChartFactory.createQuestionnaireRadar(container, questionStats);
        }
    }

    async createQuestionCharts(questionnaireId, questionStats, filters) {
        const container = document.getElementById('question-charts');
        if (!container) return;

        container.innerHTML = '';

        // Destruir gráficos anteriores
        Object.keys(this.charts).forEach(key => {
            if (key.startsWith('question_')) {
                ChartFactory.destroy(this.charts[key]);
                delete this.charts[key];
            }
        });

        // Criar um gráfico para cada pergunta
        for (const question of questionStats) {
            try {
                const analysis = await AnalyticsAPI.getQuestionAnalysis(question.id, filters);

                const chartWrapper = document.createElement('div');
                chartWrapper.className = 'question-chart-wrapper';
                chartWrapper.innerHTML = `
                    <div class="chart-container" id="chart-question-${question.id}"></div>
                `;
                container.appendChild(chartWrapper);

                const chartContainer = document.getElementById(`chart-question-${question.id}`);

                if (question.type === 'scale') {
                    this.charts[`question_${question.id}`] = ChartFactory.createScaleQuestionChart(
                        chartContainer,
                        analysis.data,
                        question.text
                    );
                } else if (question.type === 'boolean') {
                    this.charts[`question_${question.id}`] = ChartFactory.createBooleanQuestionChart(
                        chartContainer,
                        analysis.data,
                        question.text
                    );
                } else if (question.type === 'text') {
                    // Para texto, mostrar lista de respostas
                    this.createTextResponsesList(chartContainer, analysis.data, question.text);
                }
            } catch (error) {
                console.error(`Error loading analysis for question ${question.id}:`, error);
            }
        }
    }

    createTextResponsesList(container, data, questionText) {
        container.innerHTML = `
            <div class="text-responses">
                <h4>${questionText}</h4>
                <div class="responses-list">
                    ${data.length > 0 ? data.map(r => `
                        <div class="response-item">
                            <p class="response-text">"${r.text}"</p>
                            <span class="response-meta">
                                ${r.municipality ? `${r.municipality}, ${r.state}` : 'Local não informado'}
                                - ${new Date(r.submitted_at).toLocaleDateString('pt-BR')}
                            </span>
                        </div>
                    `).join('') : '<p class="no-responses">Nenhuma resposta de texto encontrada.</p>'}
                </div>
            </div>
        `;
    }

    showLoading() {
        const loader = document.getElementById('analytics-loader');
        if (loader) loader.classList.remove('hidden');
    }

    hideLoading() {
        const loader = document.getElementById('analytics-loader');
        if (loader) loader.classList.add('hidden');
    }
}

// Exportar para uso global
window.AnalyticsManager = AnalyticsManager;
