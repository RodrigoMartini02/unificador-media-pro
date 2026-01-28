// ========== 1. CONFIGURAÇÕES ==========

const VISUALIZER_CONFIG = {
    STORAGE_KEY: 'questionnaireSubmissions',
    TEMPLATES_KEY: 'questionarioTemplates'
};

// ========== 2. GERENCIADOR DE DADOS ==========

class QuestionarioVisualizerDataManager {
    constructor() {
        this.submissions = [];
        this.templates = [];
        this.charts = {};
        
        this.filtros = {
            estado: '',
            municipio: '',
            questionarioId: '',
            perguntaId: ''
        };
        
        this.container = null;
        this.dashboard = null;
        this.temDados = false;
        
        this.carregarDados();
        this.obterReferenciaDashboard();
    }
    
    carregarDados() {
        try {
            const submissionsData = localStorage.getItem(VISUALIZER_CONFIG.STORAGE_KEY);
            this.submissions = submissionsData ? JSON.parse(submissionsData) : [];
            
            const templatesData = localStorage.getItem(VISUALIZER_CONFIG.TEMPLATES_KEY);
            this.templates = templatesData ? JSON.parse(templatesData) : [];
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            this.submissions = [];
            this.templates = [];
        }
    }
    
    obterReferenciaDashboard() {
        if (window.dashboard) {
            this.dashboard = window.dashboard;
        }
    }
    
    obterFiltrosAtuaisDoDashboard() {
        if (this.dashboard && this.dashboard.dataManager) {
            const filters = this.dashboard.dataManager.filters;
            
            this.filtros.questionarioId = filters.templateId || '';
            this.filtros.estado = filters.currentState && filters.currentState !== 'todos_estados' 
                ? filters.currentState 
                : '';
            this.filtros.municipio = filters.currentMunicipality && filters.currentMunicipality !== 'todos' 
                ? filters.currentMunicipality 
                : '';
                
            this.temDados = this.dashboard.dataManager.filteredResponses.length > 0;
        }
    }
    
    filtrarSubmissoes() {
        this.obterFiltrosAtuaisDoDashboard();
        
        const submissoesFiltradas = this.submissions.filter(submission => {
            if (this.filtros.questionarioId && submission.templateId !== this.filtros.questionarioId) {
                return false;
            }
            
            const location = submission.location || submission.responses?.location || {};
            
            if (this.filtros.estado) {
                const estado = location.stateText || location.state || '';
                if (!estado || estado.toLowerCase() !== this.filtros.estado.toLowerCase()) {
                    return false;
                }
            }
            
            if (this.filtros.municipio) {
                const municipio = location.municipalityText || location.municipality || location.city || '';
                if (!municipio || municipio.toLowerCase() !== this.filtros.municipio.toLowerCase()) {
                    return false;
                }
            }
            
            return true;
        });
        
        this.temDados = submissoesFiltradas.length > 0;
        return submissoesFiltradas;
    }
    
    getTemplateById(templateId) {
        return this.templates.find(t => t.id === templateId);
    }
    
    getQuestionById(templateId, questionId) {
        const template = this.getTemplateById(templateId);
        return template ? template.questions.find(q => q.id === questionId) : null;
    }
}

// ========== 3. CALCULADORA DE ESTATÍSTICAS ==========

class QuestionarioStatsCalculator {
    constructor(dataManager) {
        this.dataManager = dataManager;
    }
    
    calcularDistribuicaoEscala(pergunta, submissoes) {
        const contagem = Array(10).fill(0);
        
        submissoes.forEach(submission => {
            const resposta = submission.responses[pergunta.id];
            
            if (resposta) {
                let valor;
                
                if (typeof resposta === 'object' && resposta.value !== undefined) {
                    valor = parseInt(resposta.value);
                } else {
                    valor = parseInt(resposta);
                }
                
                if (!isNaN(valor) && valor >= 1 && valor <= 10) {
                    contagem[valor - 1]++;
                }
            }
        });
        
        return {
            labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
            data: contagem
        };
    }
    
    calcularDistribuicaoMultipla(pergunta, submissoes, opcoes) {
        const contagem = Array(opcoes.length).fill(0);
        
        submissoes.forEach(submission => {
            const resposta = submission.responses[pergunta.id];
            
            if (resposta) {
                let valores = [];
                
                if (typeof resposta === 'object') {
                    if (resposta.value !== undefined) {
                        valores = Array.isArray(resposta.value) ? resposta.value : [resposta.value];
                    } else if (resposta.selectedChoices !== undefined) {
                        valores = Array.isArray(resposta.selectedChoices) ? 
                            resposta.selectedChoices : [resposta.selectedChoices];
                    }
                } else if (typeof resposta === 'string') {
                    valores = [resposta];
                } else if (Array.isArray(resposta)) {
                    valores = resposta;
                }
                
                valores.forEach(valor => {
                    const indice = opcoes.indexOf(valor);
                    if (indice !== -1) {
                        contagem[indice]++;
                    }
                });
            }
        });
        
        return {
            labels: opcoes,
            data: contagem
        };
    }
    
    calcularEstatisticas(distribuicao) {
        const total = distribuicao.reduce((soma, valor) => soma + valor, 0);
        
        if (total === 0) {
            return {
                total: 0,
                media: 0,
                moda: 'N/A',
                mediana: 'N/A'
            };
        }
        
        let somaPonderada = 0;
        
        distribuicao.forEach((contagem, indice) => {
            const valor = indice + 1;
            somaPonderada += valor * contagem;
        });
        
        const media = somaPonderada / total;
        
        let maxContagem = 0;
        let moda = 'N/A';
        
        distribuicao.forEach((contagem, indice) => {
            if (contagem > maxContagem) {
                maxContagem = contagem;
                moda = indice + 1;
            }
        });
        
        let mediana = 'N/A';
        
        if (total > 0) {
            const valores = [];
            
            distribuicao.forEach((contagem, indice) => {
                const valor = indice + 1;
                
                for (let i = 0; i < contagem; i++) {
                    valores.push(valor);
                }
            });
            
            valores.sort((a, b) => a - b);
            
            const meio = Math.floor(valores.length / 2);
            
            if (valores.length % 2 === 0) {
                mediana = (valores[meio - 1] + valores[meio]) / 2;
            } else {
                mediana = valores[meio];
            }
        }
        
        return {
            total,
            media,
            moda,
            mediana
        };
    }
}

// ========== 4. RENDERIZADOR DE GRÁFICOS ==========

class QuestionarioChartRenderer {
    constructor(dataManager, statsCalculator) {
        this.dataManager = dataManager;
        this.statsCalculator = statsCalculator;
        this.chartInstances = {};
        this.colorIndex = 0;
    }
    
    renderizarGraficoBarra(id, labels, data) {
        const canvas = document.getElementById(id);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        if (this.chartInstances[id]) {
            this.chartInstances[id].destroy();
        }
        
        this.chartInstances[id] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Respostas',
                    data: data
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            title: (tooltipItems) => {
                                return `Nota ${tooltipItems[0].label}`;
                            },
                            label: (context) => {
                                const value = context.raw || 0;
                                return `${value} resposta${value !== 1 ? 's' : ''}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });
    }
    
    renderizarGrafico(id, labels, data, tipo = 'pie') {
        const canvas = document.getElementById(id);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        if (this.chartInstances[id]) {
            this.chartInstances[id].destroy();
        }
        
        const opcoesEspecificas = {};
        
        if (tipo === 'bar') {
            opcoesEspecificas.indexAxis = labels.length > 5 ? 'y' : 'x';
            opcoesEspecificas.scales = {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            };
        }
        
        canvas.dataset.chartType = tipo;
        
        this.chartInstances[id] = new Chart(ctx, {
            type: tipo,
            data: {
                labels: labels,
                datasets: [{
                    label: 'Respostas',
                    data: data
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: tipo !== 'bar',
                        position: 'right'
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
                },
                ...opcoesEspecificas
            }
        });
    }
    
    alternarTipoGrafico(id, labels, data) {
        const canvas = document.getElementById(id);
        if (!canvas) return;
        
        const tiposGrafico = ['pie', 'bar', 'doughnut', 'polarArea'];
        
        const tipoAtual = canvas.dataset.chartType || 'pie';
        let proximoIndice = (tiposGrafico.indexOf(tipoAtual) + 1) % tiposGrafico.length;
        const proximoTipo = tiposGrafico[proximoIndice];
        
        this.renderizarGrafico(id, labels, data, proximoTipo);
        
        this.atualizarIconeBotao(canvas, proximoTipo);
    }
    
    atualizarIconeBotao(canvas, tipo) {
        const btnAlternar = canvas.closest('.questao-card').querySelector('.btn-alternar-grafico i');
        if (btnAlternar) {
            btnAlternar.className = this.getIconeParaTipoGrafico(tipo);
            
            btnAlternar.classList.add('rotating');
            setTimeout(() => {
                btnAlternar.classList.remove('rotating');
            }, 300);
        }
    }
    
    getIconeParaTipoGrafico(tipo) {
        switch(tipo) {
            case 'pie': return 'fas fa-chart-pie';
            case 'bar': return 'fas fa-chart-bar';
            case 'doughnut': return 'fas fa-circle-notch';
            case 'polarArea': return 'fas fa-circle';
            default: return 'fas fa-chart-pie';
        }
    }
    
    destruirGrafico(id) {
        if (this.chartInstances[id]) {
            this.chartInstances[id].destroy();
            delete this.chartInstances[id];
        }
    }
    
    destruirTodosGraficos() {
        Object.keys(this.chartInstances).forEach(id => {
            this.destruirGrafico(id);
        });
    }
}

// ========== 5. MANIPULADOR DE TEMPLATES/DOM ==========

class QuestionarioTemplateManager {
    constructor() {
        this.templatesContainer = document.querySelector('#templates');
    }
    
    obterTemplate(className) {
        return this.templatesContainer.querySelector(`.${className}.template-item`);
    }
    
    criarElementoDoTemplate(className) {
        const template = this.obterTemplate(className);
        if (!template) return null;
        
        const elemento = template.cloneNode(true);
        elemento.classList.remove('template-item');
        elemento.style.display = '';
        
        return elemento;
    }
    
    preencherCardQuestao(card, pergunta, indice, estatisticas) {
        const numeroPergunta = indice !== null ? `Q${indice}` : '';
        
        const titulo = card.querySelector('.questao-titulo');
        if (titulo) titulo.textContent = `${numeroPergunta ? `${numeroPergunta}: ` : ''}${pergunta.text}`;
        
        const canvas = card.querySelector('.questao-canvas');
        if (canvas) canvas.id = `grafico-${pergunta.templateId || 'temp'}-${pergunta.id}`;
        
        const stats = card.querySelectorAll('.questao-stats .stat-valor');
        if (stats.length >= 4) {
            stats[0].textContent = estatisticas.total;
            stats[1].textContent = estatisticas.media.toFixed(1);
            stats[2].textContent = estatisticas.moda;
            stats[3].textContent = typeof estatisticas.mediana === 'number' ? 
                estatisticas.mediana.toFixed(1) : estatisticas.mediana;
        }
        
        return card;
    }
    
    preencherCardQuestaoMultipla(card, pergunta, indice, estatisticas) {
        const numeroPergunta = indice !== null ? `Q${indice}` : '';
        
        const titulo = card.querySelector('.questao-titulo');
        if (titulo) titulo.textContent = `${numeroPergunta ? `${numeroPergunta}: ` : ''}${pergunta.text}`;
        
        const canvas = card.querySelector('.questao-canvas');
        if (canvas) canvas.id = `grafico-${pergunta.templateId || 'temp'}-${pergunta.id}`;
        
        const stats = card.querySelectorAll('.questao-stats-multipla .stat-valor');
        if (stats.length >= 3) {
            stats[0].textContent = estatisticas.total;
            stats[1].textContent = estatisticas.opcoes;
            stats[2].textContent = estatisticas.maisEscolhida;
        }
        
        return card;
    }
    
    criarMensagemInicial(mensagem) {
        const mensagemElemento = this.criarElementoDoTemplate('mensagem-inicial');
        if (!mensagemElemento) return null;
        
        const mensagemTexto = mensagemElemento.querySelector('p');
        if (mensagemTexto) {
            mensagemTexto.textContent = mensagem;
        }
        
        return mensagemElemento;
    }
}

// ========== 6. GERENCIADOR DE EVENTOS ==========

class QuestionarioEventManager {
    constructor(visualizer) {
        this.visualizer = visualizer;
        this.configurarEventos();
    }
    
    configurarEventos() {
        this.configurarEventosGlobais();
        this.configurarEventosFiltros();
        this.configurarEventosStorage();
    }
    
    configurarEventosGlobais() {
        window.addEventListener('questionarioFilterChanged', (e) => {
            const templateId = e.detail.templateId;
            this.visualizer.dataManager.filtros.questionarioId = templateId;
            this.visualizer.preencherSeletorPerguntas(templateId);
            this.visualizer.renderizarGraficos();
        });
        
        window.addEventListener('templateFilterChanged', (e) => {
            if (e.detail) {
                const templateId = e.detail.templateId || '';
                this.visualizer.dataManager.filtros.questionarioId = templateId;
                this.visualizer.preencherSeletorPerguntas(templateId);
                this.visualizer.renderizarGraficos();
            }
        });
        
        window.addEventListener('dashboardReset', (e) => {
            this.visualizer.dataManager.filtros = {
                estado: '',
                municipio: '',
                questionarioId: '',
                perguntaId: ''
            };
            
            if (e.detail && e.detail.isReset) {
                this.visualizer.dataManager.temDados = false;
            }
            
            const filtroPergunta = document.getElementById('filtroPergunta');
            if (filtroPergunta) {
                filtroPergunta.value = '';
            }
            
            this.visualizer.renderizarGraficos();
        });
        
        window.addEventListener('dashboardFiltersChanged', (e) => {
            if (e.detail) {
                if (e.detail.state !== undefined) {
                    this.visualizer.dataManager.filtros.estado = e.detail.state === 'todos_estados' ? '' : e.detail.state;
                }
                
                if (e.detail.municipality !== undefined) {
                    this.visualizer.dataManager.filtros.municipio = e.detail.municipality === 'todos' ? '' : e.detail.municipality;
                }
                
                if (e.detail.templateId !== undefined) {
                    this.visualizer.dataManager.filtros.questionarioId = e.detail.templateId || '';
                    this.visualizer.preencherSeletorPerguntas(e.detail.templateId);
                }
                
                if (e.detail.hasData !== undefined) {
                    this.visualizer.dataManager.temDados = e.detail.hasData;
                }
                
                this.visualizer.renderizarGraficos();
            }
        });
    }
    
    configurarEventosFiltros() {
        window.addEventListener('perguntaFilterChanged', (e) => {
            const perguntaId = e.detail.perguntaId;
            this.visualizer.dataManager.filtros.perguntaId = perguntaId;
            this.visualizer.renderizarGraficos();
        });
        
        window.addEventListener('estadoFilterChanged', (e) => {
            const estado = e.detail.estado === 'todos_estados' ? '' : e.detail.estado;
            this.visualizer.dataManager.filtros.estado = estado;
            this.visualizer.dataManager.temDados = e.detail.hasData !== undefined ? e.detail.hasData : this.visualizer.dataManager.temDados;
            this.visualizer.renderizarGraficos();
        });
        
        window.addEventListener('municipioFilterChanged', (e) => {
            const municipio = e.detail.municipio === 'todos' ? '' : e.detail.municipio;
            this.visualizer.dataManager.filtros.municipio = municipio;
            this.visualizer.dataManager.temDados = e.detail.hasData !== undefined ? e.detail.hasData : this.visualizer.dataManager.temDados;
            this.visualizer.renderizarGraficos();
        });
    }
    
    configurarEventosStorage() {
        window.addEventListener('storage', (e) => {
            if (e.key === VISUALIZER_CONFIG.STORAGE_KEY || e.key === VISUALIZER_CONFIG.TEMPLATES_KEY) {
                this.visualizer.dataManager.carregarDados();
                this.visualizer.renderizarGraficos();
            }
        });
    }
    
    configurarEventosCard(card, perguntaTexto) {
        const btnAlternar = card.querySelector('.btn-alternar-grafico');
        const canvas = card.querySelector('.questao-canvas');
        
        if (btnAlternar && canvas) {
            btnAlternar.addEventListener('click', () => {
                const chartData = this.obterDadosGrafico(canvas.id);
                if (chartData) {
                    this.visualizer.chartRenderer.alternarTipoGrafico(canvas.id, chartData.labels, chartData.data);
                }
            });
        }
    }
    
    obterDadosGrafico(canvasId) {
        const chartInstance = this.visualizer.chartRenderer.chartInstances[canvasId];
        if (chartInstance) {
            return {
                labels: chartInstance.data.labels,
                data: chartInstance.data.datasets[0].data
            };
        }
        return null;
    }
}

// ========== 7. VISUALIZADOR PRINCIPAL ==========

class QuestionarioVisualizer {
    constructor() {
        this.dataManager = new QuestionarioVisualizerDataManager();
        this.statsCalculator = new QuestionarioStatsCalculator(this.dataManager);
        this.chartRenderer = new QuestionarioChartRenderer(this.dataManager, this.statsCalculator);
        this.templateManager = new QuestionarioTemplateManager();
        this.eventManager = new QuestionarioEventManager(this);
        
        this.inicializar();
    }
    
    inicializar() {
        this.obterContainer();
        this.configurarSeletorPergunta();
        
        setTimeout(() => {
            this.renderizarGraficos();
        }, 500);
    }
    
    obterContainer() {
        this.container = document.querySelector('.questoes-visualizador-container');
        
        if (!this.container) {
            console.warn('Container do visualizador não encontrado');
            return;
        }
    }
    
    configurarSeletorPergunta() {
        setTimeout(() => {
            const seletor = document.getElementById('filtroPergunta');
            if (!seletor) return;
            
            seletor.addEventListener('change', () => {
                const perguntaId = seletor.value;
                
                window.dispatchEvent(new CustomEvent('perguntaFilterChanged', {
                    detail: { perguntaId }
                }));
            });
        }, 100);
    }
    
    preencherSeletorPerguntas(templateId) {
        const seletor = document.getElementById('filtroPergunta');
        if (!seletor) return;
        
        while (seletor.options.length > 1) {
            seletor.remove(1);
        }
        
        if (!templateId) return;
        
        const template = this.dataManager.getTemplateById(templateId);
        if (!template || !template.questions) return;
        
        const perguntasVisualizaveis = template.questions.filter(
            q => q.type === 'scale' || (q.type === 'multiple' && q.options?.choices?.length > 0)
        );
        
        perguntasVisualizaveis.forEach((pergunta, index) => {
            const option = document.createElement('option');
            option.value = pergunta.id;
            
            const tipoPrefixo = pergunta.type === 'scale' ? '[Escala] ' : '[Múltipla] ';
            
            option.textContent = `Q${index + 1}: ${tipoPrefixo}${pergunta.text}`;
            seletor.appendChild(option);
        });
    }
    
    renderizarGraficos() {
        const container = document.querySelector('.questoes-graficos-container');
        if (!container) return;
        
        this.limparContainer(container);
        
        this.dataManager.obterFiltrosAtuaisDoDashboard();
        
        const submissoesFiltradas = this.dataManager.filtrarSubmissoes();
        
        if (!this.dataManager.temDados) {
            this.mostrarMensagem(container, 'Nenhum questionário encontrado com os filtros aplicados.');
            return;
        }
        
        if (!this.dataManager.filtros.questionarioId) {
            this.mostrarMensagem(container, 'Selecione um questionário específico para visualizar os gráficos.');
            return;
        } else {
            this.renderizarGraficoTemplateEspecifico(container, submissoesFiltradas);
        }
    }
    
    limparContainer(container) {
        const existingCards = container.querySelectorAll('.questao-card:not(.template-item)');
        existingCards.forEach(card => card.remove());
        
        const existingMessages = container.querySelectorAll('.mensagem-inicial:not(.template-item)');
        existingMessages.forEach(msg => msg.remove());
    }
    
    mostrarMensagem(container, mensagem = 'Selecione um Questionário') {
        const mensagemElemento = this.templateManager.criarMensagemInicial(mensagem);
        if (mensagemElemento) {
            container.appendChild(mensagemElemento);
        }
    }
    
    renderizarGraficoTemplateEspecifico(container, submissoesFiltradas) {
        const template = this.dataManager.getTemplateById(this.dataManager.filtros.questionarioId);
        
        if (!template) {
            this.mostrarMensagem(container, 'Questionário não encontrado.');
            return;
        }
        
        const submissoesTemplate = submissoesFiltradas.filter(s => s.templateId === template.id);
        
        if (submissoesTemplate.length === 0) {
            this.mostrarMensagem(container, 'Nenhuma resposta encontrada para este questionário.');
            return;
        }
        
        if (this.dataManager.filtros.perguntaId) {
            this.renderizarGraficoPergunta(container, template, this.dataManager.filtros.perguntaId, submissoesTemplate);
        } else {
            this.renderizarGraficosTemplate(container, template, submissoesTemplate);
        }
    }
    
    renderizarGraficosTemplate(container, template, submissoes) {
        const perguntasEscala = template.questions.filter(q => q.type === 'scale');
        const perguntasMultipla = template.questions.filter(q => q.type === 'multiple' && q.options?.choices?.length > 0);
        
        if (perguntasEscala.length === 0 && perguntasMultipla.length === 0) {
            this.mostrarMensagem(container, 'Este questionário não possui perguntas de escala (1-10) ou de múltipla escolha.');
            return;
        }
        
        perguntasEscala.forEach((pergunta, index) => {
            this.renderizarGraficoEscala(container, template, pergunta.id, submissoes, index + 1);
        });
        
        perguntasMultipla.forEach((pergunta, index) => {
            this.renderizarGraficoMultiplaEscolha(
                container, 
                template, 
                pergunta.id, 
                submissoes, 
                perguntasEscala.length + index + 1
            );
        });
    }
    
    renderizarGraficoPergunta(container, template, perguntaId, submissoes, indice = null) {
        const pergunta = template.questions.find(q => q.id === perguntaId);
        
        if (!pergunta) return;
        
        if (pergunta.type === 'scale') {
            this.renderizarGraficoEscala(container, template, perguntaId, submissoes, indice);
        } else if (pergunta.type === 'multiple') {
            this.renderizarGraficoMultiplaEscolha(container, template, perguntaId, submissoes, indice);
        }
    }
    
    renderizarGraficoEscala(container, template, perguntaId, submissoes, indice = null) {
        const pergunta = template.questions.find(q => q.id === perguntaId);
        
        if (!pergunta || pergunta.type !== 'scale') return;
        
        const distribuicao = this.statsCalculator.calcularDistribuicaoEscala(pergunta, submissoes);
        const estatisticas = this.statsCalculator.calcularEstatisticas(distribuicao.data);
        
        const card = this.templateManager.criarElementoDoTemplate('questao-card');
        if (!card) return;
        
        this.templateManager.preencherCardQuestao(card, pergunta, indice, estatisticas);
        container.appendChild(card);
        
        const chartId = card.querySelector('.questao-canvas').id;
        this.chartRenderer.renderizarGraficoBarra(chartId, distribuicao.labels, distribuicao.data);
        
        this.eventManager.configurarEventosCard(card, pergunta.text);
    }
    
    renderizarGraficoMultiplaEscolha(container, template, perguntaId, submissoes, indice = null) {
        const pergunta = template.questions.find(q => q.id === perguntaId);
        
        if (!pergunta || pergunta.type !== 'multiple') return;
        
        const opcoes = pergunta.options?.choices || [];
        if (opcoes.length === 0) return;
        
        const distribuicao = this.statsCalculator.calcularDistribuicaoMultipla(pergunta, submissoes, opcoes);
        
        const total = distribuicao.data.reduce((sum, val) => sum + val, 0);
        const maisEscolhida = distribuicao.data.length > 0 ? 
            distribuicao.labels[distribuicao.data.indexOf(Math.max(...distribuicao.data))] : 
            'N/A';
        
        const estatisticasMultipla = {
            total: total,
            opcoes: opcoes.length,
            maisEscolhida: maisEscolhida
        };
        
        const card = this.templateManager.criarElementoDoTemplate('questao-card-multipla');
        if (!card) return;
        
        this.templateManager.preencherCardQuestaoMultipla(card, pergunta, indice, estatisticasMultipla);
        container.appendChild(card);
        
        const chartId = card.querySelector('.questao-canvas').id;
        this.chartRenderer.renderizarGrafico(chartId, distribuicao.labels, distribuicao.data, 'pie');
        
        this.eventManager.configurarEventosCard(card, pergunta.text);
    }
}

// ========== 8. INICIALIZAÇÃO ==========

class QuestionarioVisualizerApp {
    constructor() {
        this.visualizer = null;
        this.inicializar();
    }
    
    inicializar() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.criarVisualizer();
            });
        } else {
            this.criarVisualizer();
        }
    }
    
    criarVisualizer() {
        try {
            this.visualizer = new QuestionarioVisualizer();
            window.questionarioVisualizer = this.visualizer;
            
            console.log('Visualizador de questionários inicializado com sucesso');
        } catch (error) {
            console.error('Erro ao inicializar o visualizador:', error);
        }
    }
    
    destruir() {
        if (this.visualizer) {
            this.visualizer.chartRenderer.destruirTodosGraficos();
            this.visualizer = null;
            window.questionarioVisualizer = null;
        }
    }
}

// ========== 9. INSTANCIAÇÃO GLOBAL ==========

// Criar instância global do aplicativo
const questionarioVisualizerApp = new QuestionarioVisualizerApp();