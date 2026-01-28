// ========== BLOCO 1: CONFIGURAÇÕES ==========

const CONFIG = {
    SATISFACTION_THRESHOLD: 7,
    MAX_RECENT_RESPONSES: 5,
    STORAGE_KEY: 'questionnaireSubmissions',
    TEMPLATES_KEY: 'questionarioTemplates',
    CHART_ANIMATION_DURATION: 750
};

// ========== BLOCO 2: GERENCIADOR DE TEMPLATES ==========

class QuestionnaireTemplateManager {
    constructor() {
        this.templates = this.loadTemplates();
        this.activeTemplate = this.findActiveTemplate();
        this.questions = this.extractQuestionsFromActiveTemplate();
    }

    loadTemplates() {
        try {
            return JSON.parse(localStorage.getItem(CONFIG.TEMPLATES_KEY) || '[]');
        } catch (error) {
            console.error('Erro ao carregar templates:', error);
            return [];
        }
    }

    findActiveTemplate() {
        return this.templates.find(template => template.isActive);
    }

    extractQuestionsFromActiveTemplate() {
        if (!this.activeTemplate || !this.activeTemplate.questions) {
            return [];
        }
        return this.activeTemplate.questions;
    }

    getQuestionById(questionId) {
        return this.questions.find(q => q.id === questionId);
    }

    getTemplateById(templateId) {
        return this.templates.find(t => t.id === templateId);
    }

    getQuestionsFromTemplateId(templateId) {
        const template = this.getTemplateById(templateId);
        return template ? template.questions || [] : [];
    }
}

// ========== BLOCO 3: GERENCIADOR DE DADOS ==========

class DataManager {
    constructor() {
        this.templateManager = new QuestionnaireTemplateManager();
        this.responses = this.loadResponses();
        this.filteredResponses = [...this.responses];
        this.activeTemplateId = this.templateManager.activeTemplate?.id;
        this.filters = {
            currentState: null,
            currentMunicipality: null,
            dateRange: null,
            templateId: null
        };
    }

    loadResponses() {
        try {
            const submissions = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
            return this.processResponses(submissions);
        } catch (error) {
            console.error('Erro ao carregar respostas:', error);
            return [];
        }
    }

    processResponses(submissions) {
        return submissions.map(submission => {
            const templateId = submission.templateId;
            const template = this.templateManager.getTemplateById(templateId);
            const templateName = template?.name || 'Questionário não identificado';
            
            const location = submission.location || {};
            const submissionDate = new Date(submission.submissionDate);
            
            const processedResponses = {};
            let responseCount = 0;
            let totalScore = 0;
            
            if (template && template.questions) {
                template.questions.forEach((question) => {
                    const questionId = question.id;
                    const questionResponse = submission.responses[questionId];
                    
                    if (questionResponse) {
                        if (question.type === 'scale') {
                            const numValue = parseFloat(questionResponse.value);
                            if (!isNaN(numValue)) {
                                processedResponses[questionId] = {
                                    question: question.text,
                                    value: numValue,
                                    type: 'scale'
                                };
                                totalScore += numValue;
                                responseCount++;
                            }
                        } else if (question.type === 'boolean') {
                            const boolValue = questionResponse.value === true || questionResponse.value === 'true';
                            processedResponses[questionId] = {
                                question: question.text,
                                value: boolValue,
                                numericValue: boolValue ? 10 : 0,
                                type: 'boolean'
                            };
                            totalScore += boolValue ? 10 : 0;
                            responseCount++;
                        } else if (question.type === 'multiple') {
                            processedResponses[questionId] = {
                                question: question.text,
                                value: questionResponse.selectedChoices || questionResponse.value,
                                type: 'multiple'
                            };
                        } else if (question.type === 'text') {
                            processedResponses[questionId] = {
                                question: question.text,
                                value: questionResponse.value || '',
                                type: 'text'
                            };
                        }
                    }
                });
            }
            
            const averageScore = responseCount > 0 ? totalScore / responseCount : 0;
            
            let feedback = '';
            Object.keys(submission.responses).forEach(key => {
                const response = submission.responses[key];
                if (response && response.questionType === 'text') {
                    feedback = response.value || '';
                }
            });
            
            const identification = submission.responses.identification || {
                name: 'Anônimo',
                position: 'Não identificado'
            };
            
            return {
                id: submission.id,
                templateId,
                templateName,
                location,
                date: submissionDate,
                responses: processedResponses,
                averageScore,
                feedback,
                identification
            };
        });
    }

    filterByState(state) {
        this.filters.currentState = state;
        this.applyFilters();
        return this.filteredResponses;
    }

    filterByMunicipality(municipality) {
        this.filters.currentMunicipality = municipality;
        this.applyFilters();
        return this.filteredResponses;
    }

    filterByTemplate(templateId) {
        if (!templateId) {
            this.filters.templateId = null;
            this.filteredResponses = [...this.responses];
            return this.filteredResponses;
        }
    
        this.filters.templateId = templateId;
        this.filteredResponses = this.responses.filter(response => 
            response.templateId === templateId
        );
    
        return this.filteredResponses;
    }
    
    filterByDateRange(startDate, endDate) {
        this.filters.dateRange = { start: startDate, end: endDate };
        this.applyFilters();
        return this.filteredResponses;
    }

    applyFilters() {
        this.filteredResponses = [...this.responses];
        
        if (this.filters.templateId) {
            this.filteredResponses = this.filteredResponses.filter(response => 
                response.templateId === this.filters.templateId
            );
        }
        
        if (this.filters.currentState && this.filters.currentState !== 'todos_estados') {
            this.filteredResponses = this.filteredResponses.filter(response => {
                if (!response.location) return false;
                
                return response.location.state === this.filters.currentState || 
                       response.location.stateText === this.filters.currentState ||
                       (response.location.state && 
                        String(response.location.state).toLowerCase() === 
                        String(this.filters.currentState).toLowerCase());
            });
        }
        
        if (this.filters.currentMunicipality && this.filters.currentMunicipality !== 'todos') {
            this.filteredResponses = this.filteredResponses.filter(response => {
                if (!response.location) return false;
                
                return response.location.municipality === this.filters.currentMunicipality || 
                       response.location.municipalityText === this.filters.currentMunicipality ||
                       response.location.city === this.filters.currentMunicipality ||
                       (response.location.municipality && 
                        String(response.location.municipality).toLowerCase() === 
                        String(this.filters.currentMunicipality).toLowerCase());
            });
        }
        
        if (this.filters.dateRange) {
            const { start, end } = this.filters.dateRange;
            
            if (start) {
                const startDate = new Date(start);
                this.filteredResponses = this.filteredResponses.filter(response => 
                    response.date >= startDate
                );
            }
            
            if (end) {
                const endDate = new Date(end);
                endDate.setHours(23, 59, 59, 999);
                this.filteredResponses = this.filteredResponses.filter(response => 
                    response.date <= endDate
                );
            }
        }
        
        return this.filteredResponses;
    }

    clearFilters() {
        this.filters = {
            currentState: null,
            currentMunicipality: null,
            dateRange: null,
            templateId: null
        };
        this.filteredResponses = [...this.responses];
        return this.filteredResponses;
    }

    getTemplateQuestions(templateId = this.activeTemplateId) {
        return this.templateManager.getQuestionsFromTemplateId(templateId);
    }

    getRecentResponses(limit = CONFIG.MAX_RECENT_RESPONSES) {
        const sortedResponses = [...this.filteredResponses].sort((a, b) => b.date - a.date);
        return sortedResponses.slice(0, limit);
    }

    getResponsesWithFeedback() {
        return this.filteredResponses.filter(response => response.feedback && response.feedback.trim() !== '');
    }

    getGroupedResponses() {
        const groupedByTemplate = {};
        
        this.filteredResponses.forEach(response => {
            if (!groupedByTemplate[response.templateId]) {
                groupedByTemplate[response.templateId] = [];
            }
            groupedByTemplate[response.templateId].push(response);
        });
        
        return groupedByTemplate;
    }
}

// ========== BLOCO 4: ANALYTICS (CÁLCULOS) ==========

class Analytics {
    constructor(dataManager) {
        this.dataManager = dataManager;
    }

    calculateAverage(numbers) {
        if (!numbers || !numbers.length) return 0;
        const validNumbers = numbers.filter(n => typeof n === 'number' && !isNaN(n));
        if (!validNumbers.length) return 0;
        return validNumbers.reduce((sum, num) => sum + num, 0) / validNumbers.length;
    }

    getQuestionAveragesByTemplate(templateId) {
        const responses = this.dataManager.filteredResponses.filter(r => r.templateId === templateId);
        const questions = this.dataManager.getTemplateQuestions(templateId);
        
        if (!responses.length || !questions.length) {
            return { questionLabels: [], averages: [] };
        }
        
        const numericQuestions = questions.filter(q => q.type === 'scale' || q.type === 'boolean');
        
        const questionLabels = numericQuestions.map(q => q.text);
        const averages = numericQuestions.map(question => {
            const questionValues = responses
                .map(response => {
                    const questionResponse = response.responses[question.id];
                    if (question.type === 'scale' && questionResponse) {
                        return questionResponse.value;
                    } else if (question.type === 'boolean' && questionResponse) {
                        return questionResponse.numericValue;
                    }
                    return null;
                })
                .filter(value => value !== null && !isNaN(value));
            
            return this.calculateAverage(questionValues);
        });
        
        return { questionLabels, averages };
    }

    getQuestionDistribution(questionId, templateId) {
        const responses = this.dataManager.filteredResponses.filter(r => r.templateId === templateId);
        const question = this.dataManager.templateManager.getQuestionById(questionId);
        
        if (!question || !responses.length) {
            return { labels: [], data: [] };
        }
        
        if (question.type === 'scale') {
            const distribution = new Array(10).fill(0);
            
            responses.forEach(response => {
                const questionResponse = response.responses[questionId];
                if (questionResponse && typeof questionResponse.value === 'number') {
                    const value = Math.round(questionResponse.value);
                    if (value >= 1 && value <= 10) {
                        distribution[value - 1]++;
                    }
                }
            });
            
            return {
                labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
                data: distribution
            };
        } 
        else if (question.type === 'boolean') {
            let yesCount = 0;
            let noCount = 0;
            
            responses.forEach(response => {
                const questionResponse = response.responses[questionId];
                if (questionResponse) {
                    if (questionResponse.value === true) {
                        yesCount++;
                    } else {
                        noCount++;
                    }
                }
            });
            
            return {
                labels: ['Sim', 'Não'],
                data: [yesCount, noCount]
            };
        } 
        else if (question.type === 'multiple') {
            const options = question.options?.choices || [];
            const distribution = new Array(options.length).fill(0);
            
            responses.forEach(response => {
                const questionResponse = response.responses[questionId];
                if (questionResponse && Array.isArray(questionResponse.value)) {
                    questionResponse.value.forEach(choice => {
                        const optionIndex = options.indexOf(choice);
                        if (optionIndex !== -1) {
                            distribution[optionIndex]++;
                        }
                    });
                }
            });
            
            return {
                labels: options,
                data: distribution
            };
        }
        
        return { labels: [], data: [] };
    }

    getSatisfactionRate() {
        const responses = this.dataManager.filteredResponses;
        
        if (!responses.length) return 0;
        
        let totalRatings = 0;
        let satisfiedRatings = 0;
        
        responses.forEach(response => {
            Object.values(response.responses).forEach(questionResponse => {
                if (questionResponse.type === 'scale' && typeof questionResponse.value === 'number') {
                    totalRatings++;
                    if (questionResponse.value >= CONFIG.SATISFACTION_THRESHOLD) {
                        satisfiedRatings++;
                    }
                }
                else if (questionResponse.type === 'boolean') {
                    totalRatings++;
                    if (questionResponse.value === true) {
                        satisfiedRatings++;
                    }
                }
            });
        });
        
        return totalRatings > 0 ? (satisfiedRatings / totalRatings) * 100 : 0;
    }

    getTrend() {
        const responses = [...this.dataManager.filteredResponses]
            .sort((a, b) => a.date - b.date);
        
        if (responses.length < 2) return 0;
        
        const earliestResponses = responses.slice(0, Math.min(5, Math.ceil(responses.length / 4)));
        const latestResponses = responses.slice(-Math.min(5, Math.ceil(responses.length / 4)));
        
        const earliestAvg = this.calculateAverage(earliestResponses.map(r => r.averageScore));
        const latestAvg = this.calculateAverage(latestResponses.map(r => r.averageScore));
        
        if (earliestAvg === 0) return 0;
        
        return ((latestAvg - earliestAvg) / earliestAvg) * 100;
    }

    getRatingDistribution() {
        const responses = this.dataManager.filteredResponses;
        
        if (!responses.length) {
            return {
                labels: ['1-2', '3-4', '5-6', '7-8', '9-10'],
                data: [0, 0, 0, 0, 0]
            };
        }
        
        const allRatings = [];
        responses.forEach(response => {
            Object.values(response.responses).forEach(questionResponse => {
                if (questionResponse.type === 'scale' && typeof questionResponse.value === 'number') {
                    allRatings.push(questionResponse.value);
                }
                else if (questionResponse.type === 'boolean') {
                    allRatings.push(questionResponse.value ? 10 : 0);
                }
            });
        });
        
        const distribution = [
            allRatings.filter(r => r <= 2).length,
            allRatings.filter(r => r > 2 && r <= 4).length,
            allRatings.filter(r => r > 4 && r <= 6).length,
            allRatings.filter(r => r > 6 && r <= 8).length,
            allRatings.filter(r => r > 8 && r <= 10).length
        ];
        
        return {
            labels: ['1-2', '3-4', '5-6', '7-8', '9-10'],
            data: distribution
        };
    }

    getStatsByTemplate() {
        const groupedResponses = this.dataManager.getGroupedResponses();
        const stats = {};
        
        Object.keys(groupedResponses).forEach(templateId => {
            const responses = groupedResponses[templateId];
            const template = this.dataManager.templateManager.getTemplateById(templateId);
            
            if (!template) return;
            
            const { questionLabels, averages } = this.getQuestionAveragesByTemplate(templateId);
            
            let maxAvg = 0;
            let minAvg = 0;
            
            if (averages.length > 0) {
                maxAvg = Math.max(...averages);
                minAvg = Math.min(...averages);
            }
            
            const totalAverage = this.calculateAverage(responses.map(r => r.averageScore));
            
            let totalRatings = 0;
            let satisfiedRatings = 0;
            
            responses.forEach(response => {
                Object.values(response.responses).forEach(questionResponse => {
                    if (questionResponse.type === 'scale' && typeof questionResponse.value === 'number') {
                        totalRatings++;
                        if (questionResponse.value >= CONFIG.SATISFACTION_THRESHOLD) {
                            satisfiedRatings++;
                        }
                    }
                    else if (questionResponse.type === 'boolean') {
                        totalRatings++;
                        if (questionResponse.value === true) {
                            satisfiedRatings++;
                        }
                    }
                });
            });
            
            const satisfactionRate = totalRatings > 0 ? (satisfiedRatings / totalRatings) * 100 : 0;
            
            stats[templateId] = {
                templateName: template.name,
                responseCount: responses.length,
                averageScore: totalAverage,
                satisfactionRate,
                bestQuestion: questionLabels[averages.indexOf(maxAvg)] || 'N/A',
                bestQuestionScore: maxAvg || 0,
                worstQuestion: questionLabels[averages.indexOf(minAvg)] || 'N/A',
                worstQuestionScore: minAvg || 0
            };
        });
        
        return stats;
    }
}

// ========== BLOCO 5: RENDERIZADOR DE INTERFACE ==========

class DashboardRenderer {
    constructor(dataManager, analytics) {
        this.dataManager = dataManager;
        this.analytics = analytics;
    }

    renderStats() {
        const statsContainer = document.getElementById('generalStats');
        if (!statsContainer) return;

        const filteredResponses = this.dataManager.filteredResponses;
        
        if (!filteredResponses || !filteredResponses.length) {
            this.renderEmptyStats(statsContainer);
            return;
        }

        const statsByTemplate = this.analytics.getStatsByTemplate();
        
        if (Object.keys(statsByTemplate).length === 1) {
            this.renderSingleTemplateStats(statsContainer, statsByTemplate, filteredResponses.length);
        } else {
            this.renderMultipleTemplatesStats(statsContainer, statsByTemplate, filteredResponses.length);
        }
    }

    renderEmptyStats(container) {
        const template = document.querySelector('.empty-stats.template-item');
        if (!template) return;
        
        const clone = template.cloneNode(true);
        clone.classList.remove('template-item');
        clone.style.display = 'flex';
        
        container.innerHTML = '';
        container.appendChild(clone);
    }

    renderSingleTemplateStats(container, statsByTemplate, totalResponses) {
        const templateStats = statsByTemplate[Object.keys(statsByTemplate)[0]];
        const template = document.querySelector('.single-template-stats.template-item');
        if (!template) return;
        
        const clone = template.cloneNode(true);
        clone.classList.remove('template-item');
        clone.style.display = 'flex';
        
        clone.querySelector('.total-responses').textContent = totalResponses;
        clone.querySelector('.satisfaction-rate').textContent = `${templateStats.satisfactionRate.toFixed(1)}%`;
        clone.querySelector('.best-score').textContent = templateStats.bestQuestionScore.toFixed(1);
        clone.querySelector('.trend').textContent = `${this.analytics.getTrend() > 0 ? '+' : ''}${this.analytics.getTrend().toFixed(1)}%`;
        
        container.innerHTML = '';
        container.appendChild(clone);
    }

    renderMultipleTemplatesStats(container, statsByTemplate, totalResponses) {
        const template = document.querySelector('.multiple-templates-stats.template-item');
        if (!template) return;
        
        const clone = template.cloneNode(true);
        clone.classList.remove('template-item');
        clone.style.display = 'flex';
        
        let bestTemplateName = '';
        let bestTemplateScore = 0;
        
        Object.values(statsByTemplate).forEach(stats => {
            if (stats.averageScore > bestTemplateScore) {
                bestTemplateScore = stats.averageScore;
                bestTemplateName = stats.templateName;
            }
        });
        
        clone.querySelector('.total-responses').textContent = totalResponses;
        clone.querySelector('.satisfaction-rate').textContent = `${this.analytics.getSatisfactionRate().toFixed(1)}%`;
        clone.querySelector('.best-template').textContent = bestTemplateScore.toFixed(1);
        clone.querySelector('.best-template-label').textContent = `Melhor Questionário: ${bestTemplateName}`;
        clone.querySelector('.trend').textContent = `${this.analytics.getTrend() > 0 ? '+' : ''}${this.analytics.getTrend().toFixed(1)}%`;
        
        container.innerHTML = '';
        container.appendChild(clone);
    }

    renderLocationDisplay() {
        const display = document.getElementById('currentMunicipality');
        if (!display) return;

        const { currentState, currentMunicipality, templateId } = this.dataManager.filters;
        
        let displayText = '';
        
        if (templateId) {
            const template = this.dataManager.templateManager.getTemplateById(templateId);
            if (template) {
                displayText = template.name;
            }
        }
        
        if (!displayText) {
            if (currentState === 'todos_estados' || !currentState) {
                displayText = 'Todos os Estados';
            } else if (currentMunicipality === 'todos' || !currentMunicipality) {
                displayText = `Todos os Municípios - ${currentState}`;
            } else {
                displayText = currentMunicipality;
            }
        }
        
        display.textContent = displayText;
    }

    renderRecentResponses() {
        const container = document.getElementById('recentResponses');
        if (!container) return;

        const responses = this.dataManager.getRecentResponses();
        
        if (!responses.length) {
            const emptyTemplate = document.querySelector('.recent-responses-empty.template-item');
            if (emptyTemplate) {
                const clone = emptyTemplate.cloneNode(true);
                clone.classList.remove('template-item');
                clone.style.display = 'block';
                container.innerHTML = '';
                container.appendChild(clone);
            }
            return;
        }

        container.innerHTML = '';
        
        responses.forEach(response => {
            const template = document.querySelector('.recent-response-item.template-item');
            if (!template) return;
            
            const clone = template.cloneNode(true);
            clone.classList.remove('template-item');
            clone.style.display = 'block';
            
            clone.querySelector('.response-date').textContent = response.date.toLocaleDateString('pt-BR');
            clone.querySelector('.municipality').textContent = response.location?.municipalityText || "Não especificado";
            clone.querySelector('.rating-badge').textContent = `Média: ${response.averageScore.toFixed(1)}`;
            clone.querySelector('.template-name').textContent = response.templateName;
            
            container.appendChild(clone);
        });
    }

    renderFeedbacks() {
        const container = document.getElementById('feedbackContainer');
        if (!container) return;

        const feedbacks = this.dataManager.getResponsesWithFeedback();
        
        if (!feedbacks.length) {
            const emptyTemplate = document.querySelector('.feedbacks-empty.template-item');
            if (emptyTemplate) {
                const clone = emptyTemplate.cloneNode(true);
                clone.classList.remove('template-item');
                clone.style.display = 'block';
                container.innerHTML = '';
                container.appendChild(clone);
            }
            return;
        }

        container.innerHTML = '';
        
        feedbacks.slice(0, 10).forEach(feedback => {
            const template = document.querySelector('.feedback-item.template-item');
            if (!template) return;
            
            const clone = template.cloneNode(true);
            clone.classList.remove('template-item');
            clone.style.display = 'block';
            
            clone.querySelector('.municipality').textContent = feedback.location?.municipalityText || 'Não especificado';
            clone.querySelector('.date').textContent = feedback.date.toLocaleDateString('pt-BR');
            clone.querySelector('.feedback-content').textContent = feedback.feedback;
            clone.querySelector('.template-name').textContent = `Questionário: ${feedback.templateName}`;
            clone.querySelector('.average-rating').textContent = `Média: ${feedback.averageScore.toFixed(1)}`;
            
            container.appendChild(clone);
        });
    }

    renderQuestionnaireFilter() {
        const filterSelect = document.getElementById('questionarioFilterSelect');
        if (!filterSelect) return;
        
        while (filterSelect.options.length > 1) {
            filterSelect.remove(1);
        }
        
        const groupedResponses = this.dataManager.getGroupedResponses();
        
        Object.keys(groupedResponses).forEach(templateId => {
            const template = this.dataManager.templateManager.getTemplateById(templateId);
            if (!template) return;
            
            const option = document.createElement('option');
            option.value = templateId;
            option.textContent = `${template.name} (${groupedResponses[templateId].length})`;
            filterSelect.appendChild(option);
        });
    }

    renderStateOptions(stateSelect) {
        const allOption = document.createElement('option');
        allOption.value = 'todos_estados';
        allOption.textContent = 'Todos os Estados';
        stateSelect.appendChild(allOption);
        
        if (window.MUNICIPALITIES) {
            const states = Object.keys(window.MUNICIPALITIES);
            states.forEach(state => {
                const option = document.createElement('option');
                option.value = state;
                option.textContent = state;
                stateSelect.appendChild(option);
            });
        } else {
            const statesFromData = new Set();
            
            this.dataManager.responses.forEach(response => {
                if (response.location && response.location.state) {
                    statesFromData.add(response.location.state);
                }
                if (response.location && response.location.stateText) {
                    statesFromData.add(response.location.stateText);
                }
            });
            
            Array.from(statesFromData).sort().forEach(state => {
                const option = document.createElement('option');
                option.value = state;
                option.textContent = state;
                stateSelect.appendChild(option);
            });
        }
    }

    renderMunicipalityOptions(municipalitySelect, selectedState) {
        while (municipalitySelect.options.length > 0) {
            municipalitySelect.remove(0);
        }
        
        const allOption = document.createElement('option');
        allOption.value = 'todos';
        allOption.textContent = 'Todos os Municípios';
        municipalitySelect.appendChild(allOption);
        
        if (selectedState === 'todos_estados') {
            return;
        }
        
        if (window.MUNICIPALITIES && window.MUNICIPALITIES[selectedState]) {
            const municipalities = window.MUNICIPALITIES[selectedState];
            municipalities.forEach(municipality => {
                const option = document.createElement('option');
                option.value = municipality;
                option.textContent = municipality;
                municipalitySelect.appendChild(option);
            });
        } else {
            const municipalitiesFromData = new Set();
            
            this.dataManager.responses.forEach(response => {
                const respState = response.location?.state || response.location?.stateText;
                
                if (respState === selectedState) {
                    if (response.location?.municipality) {
                        municipalitiesFromData.add(response.location.municipality);
                    }
                    if (response.location?.municipalityText) {
                        municipalitiesFromData.add(response.location.municipalityText);
                    }
                    if (response.location?.city) {
                        municipalitiesFromData.add(response.location.city);
                    }
                }
            });
            
            Array.from(municipalitiesFromData).sort().forEach(municipality => {
                const option = document.createElement('option');
                option.value = municipality;
                option.textContent = municipality;
                municipalitySelect.appendChild(option);
            });
        }
    }
}

// ========== BLOCO 6: GERENCIADOR DE GRÁFICOS ==========

class ChartManager {
    constructor(dataManager, analytics) {
        this.dataManager = dataManager;
        this.analytics = analytics;
        this.charts = {};
    }

    initializeCharts() {
        this.destroyAllCharts();
        this.initializeOverviewCharts();
        this.initializeTemplateCharts();
    }

    destroyAllCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        this.charts = {};
    }

    initializeOverviewCharts() {
        this.initializeAverageChart();
        this.initializeDistributionChart();
    }

    initializeTemplateCharts() {
        const container = document.querySelector('.template-charts-container');
        if (!container) return;
        
        container.innerHTML = '';
        
        const groupedResponses = this.dataManager.getGroupedResponses();
        
        Object.keys(groupedResponses).forEach(templateId => {
            const template = this.dataManager.templateManager.getTemplateById(templateId);
            if (!template) return;
            
            this.createTemplateSection(container, templateId, template, groupedResponses[templateId].length);
        });
    }

    createTemplateSection(container, templateId, template, responseCount) {
        const sectionTemplate = document.querySelector('.template-section.template-item');
        if (!sectionTemplate) return;
        
        const section = sectionTemplate.cloneNode(true);
        section.classList.remove('template-item');
        section.style.display = 'block';
        section.id = `template-section-${templateId}`;
        
        section.querySelector('.template-name').textContent = template.name || 'Questionário';
        section.querySelector('.response-count').textContent = `(${responseCount} respostas)`;
        
        const chartsGrid = section.querySelector('.charts-grid');
        
        this.createTemplateAveragesChart(chartsGrid, templateId, template);
        this.createTemplateQuestionCharts(chartsGrid, templateId, template);
        
        container.appendChild(section);
    }

    createTemplateAveragesChart(container, templateId, template) {
        const chartTemplate = document.querySelector('.template-chart-card.template-item');
        if (!chartTemplate) return;
        
        const chartCard = chartTemplate.cloneNode(true);
        chartCard.classList.remove('template-item');
        chartCard.style.display = 'block';
        
        const canvas = chartCard.querySelector('.template-chart-canvas');
        canvas.id = `templateAvgChart-${templateId}`;
        
        container.appendChild(chartCard);
        
        const ctx = canvas.getContext('2d');
        const chartId = `templateAvgChart-${templateId}`;
        
        const { questionLabels, averages } = this.analytics.getQuestionAveragesByTemplate(templateId);
        
        this.charts[chartId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: questionLabels.map((label, i) => `Q${i + 1}`),
                datasets: [{
                    label: 'Média',
                    data: averages,
                    backgroundColor: '#2563eb',
                    borderColor: '#2563eb',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: CONFIG.CHART_ANIMATION_DURATION
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 10,
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: (items) => {
                                const idx = parseInt(items[0].label.replace('Q', '')) - 1;
                                return questionLabels[idx] || 'Pergunta não encontrada';
                            }
                        }
                    }
                }
            }
        });
    }

    createTemplateQuestionCharts(container, templateId, template) {
        const questions = template.questions || [];
        
        const visualizableQuestions = questions.filter(q => 
            q.type === 'scale' || q.type === 'boolean' || q.type === 'multiple'
        );
        
        visualizableQuestions.forEach((question, index) => {
            const chartTemplate = document.querySelector('.question-chart-card.template-item');
            if (!chartTemplate) return;
            
            const questionCard = chartTemplate.cloneNode(true);
            questionCard.classList.remove('template-item');
            questionCard.style.display = 'block';
            
            questionCard.querySelector('.question-chart-title').textContent = `Q${index + 1}: ${question.text}`;
            
            const canvas = questionCard.querySelector('.question-chart-canvas');
            canvas.id = `question-${templateId}-${question.id}`;
            
            container.appendChild(questionCard);
            
            this.createQuestionChart(templateId, question);
        });
    }

    createQuestionChart(templateId, question) {
        const chartId = `question-${templateId}-${question.id}`;
        const canvas = document.getElementById(chartId);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        const distribution = this.analytics.getQuestionDistribution(question.id, templateId);
        
        let chartType = 'bar';
        let chartOptions = {};
        
        if (question.type === 'boolean' || question.type === 'multiple') {
            chartType = 'pie';
            chartOptions = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            boxWidth: 15,
                            padding: 10
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total ? Math.round((value / total) * 100) : 0;
                                return `${context.label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            };
        } else {
            chartOptions = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.parsed.y} resposta(s)`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            };
        }
        
        let backgroundColor = '#2563eb';
        if (chartType === 'pie') {
            backgroundColor = ['#7c3aed', '#a855f7', '#d946ef', '#f43f5e', '#f97316', '#facc15', '#fef08a'].slice(0, distribution.labels.length);
        }
        
        this.charts[chartId] = new Chart(ctx, {
            type: chartType,
            data: {
                labels: distribution.labels,
                datasets: [{
                    label: 'Respostas',
                    data: distribution.data,
                    backgroundColor: backgroundColor,
                    borderColor: '#2563eb',
                    borderWidth: 1
                }]
            },
            options: chartOptions
        });
    }

    initializeAverageChart() {
        const averageChartElement = document.getElementById('averageChart');
        if (!averageChartElement) return;

        const ctx = averageChartElement.getContext('2d');
        
        const groupedResponses = this.dataManager.getGroupedResponses();
        
        const templates = [];
        const templateAverages = [];
        
        Object.keys(groupedResponses).forEach(templateId => {
            const template = this.dataManager.templateManager.getTemplateById(templateId);
            if (!template) return;
            
            templates.push(template.name || 'Questionário sem nome');
            
            const responses = groupedResponses[templateId];
            const avgScore = this.analytics.calculateAverage(
                responses.map(r => r.averageScore)
            );
            
            templateAverages.push(avgScore);
        });

        this.charts.average = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: templates,
                datasets: [{
                    label: 'Média Geral',
                    data: templateAverages,
                    backgroundColor: ['#2563eb', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9', '#6366f1'].slice(0, templates.length),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: CONFIG.CHART_ANIMATION_DURATION
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 10,
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Nota média: ${context.parsed.y.toFixed(1)}/10`;
                            }
                        }
                    }
                }
            }
        });
    }

    initializeDistributionChart() {
        const distributionChartElement = document.getElementById('distributionChart');
        if (!distributionChartElement) return;

        const ctx = distributionChartElement.getContext('2d');
        
        const distribution = this.analytics.getRatingDistribution();

        this.charts.distribution = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: distribution.labels,
                datasets: [{
                    data: distribution.data,
                    backgroundColor: ['#7c3aed', '#a855f7', '#d946ef', '#f43f5e', '#f97316', '#facc15', '#fef08a'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: CONFIG.CHART_ANIMATION_DURATION
                },
                plugins: {
                    legend: {
                        position: 'right'
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return `${context.label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    updateCharts() {
        try {
            this.initializeCharts();
        } catch (error) {
            console.error('Erro ao atualizar gráficos:', error);
        }
    }
}

// ========== BLOCO 7: CONTROLADOR PRINCIPAL ==========

class Dashboard {
    constructor() {
        this.initialize();
    }

    initialize() {
        this.dataManager = new DataManager();
        this.analytics = new Analytics(this.dataManager);
        this.renderer = new DashboardRenderer(this.dataManager, this.analytics);
        this.chartManager = new ChartManager(this.dataManager, this.analytics);
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeComponents());
        } else {
            this.initializeComponents();
        }
    }

    initializeComponents() {
        try {
            this.setupEventListeners();
            this.setupLocationFilters();
            this.updateDashboard();
        } catch (error) {
            console.error("Erro ao inicializar componentes do Dashboard:", error);
        }
    }

    updateDashboard() {
        this.renderer.renderStats();
        this.renderer.renderLocationDisplay();
        this.renderer.renderRecentResponses();
        this.renderer.renderFeedbacks();
        this.renderer.renderQuestionnaireFilter();
        
        setTimeout(() => {
            this.chartManager.updateCharts();
        }, 10);
    }

    setupEventListeners() {
        window.addEventListener('storage', (e) => {
            if (e.key === CONFIG.STORAGE_KEY || e.key === CONFIG.TEMPLATES_KEY) {
                this.dataManager = new DataManager();
                this.analytics = new Analytics(this.dataManager);
                this.renderer = new DashboardRenderer(this.dataManager, this.analytics);
                this.chartManager = new ChartManager(this.dataManager, this.analytics);
                this.updateDashboard();
            }
        });

        window.addEventListener('questionnaireLocationChanged', (e) => {
            if (e.detail) {
                const stateSelect = document.getElementById('stateSelect');
                const municipalitySelect = document.getElementById('municipalitySelect');
                
                if (stateSelect && e.detail.state) {
                    stateSelect.value = e.detail.state;
                    stateSelect.dispatchEvent(new Event('change'));
                    
                    setTimeout(() => {
                        if (municipalitySelect && e.detail.municipality) {
                            municipalitySelect.value = e.detail.municipality;
                            municipalitySelect.dispatchEvent(new Event('change'));
                        }
                    }, 200);
                }
            }
        });

        const refreshButton = document.querySelector('.refresh-button');
        if (refreshButton) {
            refreshButton.addEventListener('click', () => {
                this.resetFilters();
            });
        }

        const questionnaireFilter = document.getElementById('questionarioFilterSelect');
        if (questionnaireFilter) {
            questionnaireFilter.addEventListener('change', (e) => {
                const templateId = e.target.value;
                
                if (templateId && templateId.trim() !== '') {
                    this.dataManager.filterByTemplate(templateId);
                } else {
                    this.dataManager.filters.templateId = null;
                    this.dataManager.filteredResponses = [...this.dataManager.responses];
                }
                
                this.updateDashboard();
                this.notifyFilterChange(templateId);
            });
        }

        const periodSelector = document.querySelector('.period-selector');
        if (periodSelector) {
            periodSelector.addEventListener('change', (e) => {
                const periodDays = parseInt(e.target.value);
                
                if (isNaN(periodDays) || e.target.value === 'all') {
                    this.dataManager.filters.dateRange = null;
                } else {
                    const endDate = new Date();
                    const startDate = new Date();
                    startDate.setDate(startDate.getDate() - periodDays);
                    
                    this.dataManager.filterByDateRange(startDate, endDate);
                }
                
                this.dataManager.applyFilters();
                this.updateDashboard();
            });
        }
    }

    setupLocationFilters() {
        const stateSelect = document.getElementById('stateSelect');
        if (stateSelect) {
            if (stateSelect.options.length <= 1) {
                this.renderer.renderStateOptions(stateSelect);
            }
            
            stateSelect.addEventListener('change', (e) => {
                const selectedState = e.target.value;
                
                this.dataManager.filterByState(selectedState);
                this.updateMunicipalityOptions(selectedState);
                this.updateDashboard();
                
                window.dispatchEvent(new CustomEvent('estadoFilterChanged', {
                    detail: { 
                        estado: selectedState,
                        hasData: this.dataManager.filteredResponses.length > 0
                    }
                }));
            });
        }
        
        const municipalitySelect = document.getElementById('municipalitySelect');
        if (municipalitySelect) {
            municipalitySelect.addEventListener('change', (e) => {
                const selectedMunicipality = e.target.value;
                
                this.dataManager.filterByMunicipality(selectedMunicipality);
                this.updateDashboard();
                
                window.dispatchEvent(new CustomEvent('municipioFilterChanged', {
                    detail: { 
                        municipio: selectedMunicipality,
                        hasData: this.dataManager.filteredResponses.length > 0
                    }
                }));
            });
        }
    }

    updateMunicipalityOptions(selectedState) {
        const municipalitySelect = document.getElementById('municipalitySelect');
        if (!municipalitySelect) return;
        
        this.renderer.renderMunicipalityOptions(municipalitySelect, selectedState);
        municipalitySelect.value = 'todos';
        this.dataManager.filterByMunicipality('todos');
    }

    resetFilters() {
        this.dataManager.clearFilters();
        
        const stateSelect = document.getElementById('stateSelect');
        if (stateSelect) {
            stateSelect.value = 'todos_estados';
            stateSelect.dispatchEvent(new Event('change'));
        }
        
        const questionnaireFilter = document.getElementById('questionarioFilterSelect');
        if (questionnaireFilter) {
            questionnaireFilter.value = '';
        }
        
        const periodSelector = document.querySelector('.period-selector');
        if (periodSelector) {
            periodSelector.value = 'all';
        }
        
        this.updateDashboard();
        
        window.dispatchEvent(new CustomEvent('dashboardReset', {
            detail: { 
                success: true, 
                timestamp: new Date().getTime(),
                totalResponses: this.dataManager.responses.length,
                isReset: true
            }
        }));
    }

    notifyFilterChange(templateId) {
        window.dispatchEvent(new CustomEvent('templateFilterChanged', {
            detail: { 
                templateId: templateId || null,
                totalResponses: this.dataManager.filteredResponses.length
            }
        }));
    }
}

// ========== BLOCO 8: FUNÇÕES AUXILIARES ==========

function limparDadosQuestionario() {
    if (confirm('ATENÇÃO: Esta ação irá excluir permanentemente TODAS as respostas dos questionários. Essa ação não pode ser desfeita. Deseja continuar?')) {
        try {
            localStorage.removeItem(CONFIG.STORAGE_KEY);
            alert('Todos os dados de questionários foram excluídos com sucesso!');
            
            if (window.dashboard) {
                window.dashboard.dataManager = new DataManager();
                window.dashboard.analytics = new Analytics(window.dashboard.dataManager);
                window.dashboard.renderer = new DashboardRenderer(window.dashboard.dataManager, window.dashboard.analytics);
                window.dashboard.chartManager = new ChartManager(window.dashboard.dataManager, window.dashboard.analytics);
                window.dashboard.updateDashboard();
            } else {
                window.location.reload();
            }
        } catch (error) {
            console.error('Erro ao limpar dados:', error);
            alert('Ocorreu um erro ao limpar os dados: ' + error.message);
        }
    }
}

function exportarDadosQuestionario() {
    try {
        const submissions = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
        
        if (submissions.length === 0) {
            alert('Não há dados para exportar.');
            return;
        }
        
        const dataStr = JSON.stringify(submissions, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `questionarios_export_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => URL.revokeObjectURL(url), 100);
        
    } catch (error) {
        console.error('Erro ao exportar dados:', error);
        alert('Erro ao exportar dados: ' + error.message);
    }
}

function notifyQuestionnaireVisualizer() {
    const hasData = window.dashboard?.dataManager?.filteredResponses?.length > 0;
    const hasTemplateSelected = Boolean(window.dashboard?.dataManager?.filters?.templateId);
    
    const event = new CustomEvent('dashboardFiltersChanged', {
        detail: {
            state: window.dashboard?.dataManager?.filters?.currentState || null,
            municipality: window.dashboard?.dataManager?.filters?.currentMunicipality || null,
            templateId: window.dashboard?.dataManager?.filters?.templateId || null,
            hasData: hasData,
            hasTemplateSelected: hasTemplateSelected
        }
    });
    
    window.dispatchEvent(event);
}

// ========== BLOCO 9: INICIALIZAÇÃO ==========

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('dados.html')) {
        try {
            window.dashboard = new Dashboard();
            
            const originalUpdateDashboard = window.dashboard.updateDashboard;
            window.dashboard.updateDashboard = function() {
                originalUpdateDashboard.call(this);
                notifyQuestionnaireVisualizer();
            };
            
        } catch (error) {
            console.error("Erro ao inicializar Dashboard:", error);
            alert("Ocorreu um erro ao inicializar o Dashboard. Verifique o console para mais detalhes.");
        }
    }
});

window.addEventListener('questionnaireVisualizerFilterChanged', function(e) {
    if (window.dashboard) {
        if (e.detail.templateId !== undefined) {
            const questionarioFilter = document.getElementById('questionarioFilterSelect');
            if (questionarioFilter && questionarioFilter.value !== e.detail.templateId) {
                questionarioFilter.value = e.detail.templateId || '';
                window.dashboard.dataManager.filterByTemplate(e.detail.templateId);
            }
        }
        
        if (e.detail.state !== undefined) {
            const stateSelect = document.getElementById('stateSelect');
            if (stateSelect && stateSelect.value !== e.detail.state) {
                stateSelect.value = e.detail.state || 'todos_estados';
                window.dashboard.dataManager.filterByState(e.detail.state);
            }
        }
        
        if (e.detail.municipality !== undefined) {
            const municipalitySelect = document.getElementById('municipalitySelect');
            if (municipalitySelect && municipalitySelect.value !== e.detail.municipality) {
                municipalitySelect.value = e.detail.municipality || 'todos';
                window.dashboard.dataManager.filterByMunicipality(e.detail.municipality);
            }
        }
        
        if (e.detail.templateId !== undefined || e.detail.state !== undefined || e.detail.municipality !== undefined) {
            window.dashboard.updateDashboard();
        }
    }
});

window.Dashboard = Dashboard;
window.limparDadosQuestionario = limparDadosQuestionario;
window.exportarDadosQuestionario = exportarDadosQuestionario;