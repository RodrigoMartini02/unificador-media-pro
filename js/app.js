/**
 * Dashboard de Pesquisa de Satisfação
 * Sistema completo para gerenciamento e análise de dados de pesquisa
 * @version 1.0.0
 * @author Desenvolvedor JavaScript & Data Scientist
 */

// ==================== CONFIGURAÇÕES GLOBAIS ====================
const CONFIG = {
    STORAGE_KEYS: {
        RESPOSTAS: 'pesquisa_respostas',
        QUESTIONARIOS: 'pesquisa_questionarios',
        LOCAIS: 'pesquisa_locais',
        CONFIGURACOES: 'pesquisa_config'
    },
    CHARTS: {
        COLORS: {
            PRIMARY: '#3B82F6',
            SUCCESS: '#10B981',
            WARNING: '#F59E0B',
            DANGER: '#EF4444',
            INFO: '#06B6D4',
            GRADIENT: ['#3B82F6', '#1D4ED8', '#1E40AF', '#1E3A8A']
        }
    }
};

// ==================== SISTEMA DE DADOS ====================
class DataManager {
    constructor() {
        this.initializeStorage();
    }

    initializeStorage() {
        // Verifica se já existem dados, se não, cria estrutura inicial
        if (!localStorage.getItem(CONFIG.STORAGE_KEYS.RESPOSTAS)) {
            this.createSampleData();
        }
    }

    createSampleData() {
        // Dados de exemplo para demonstração
        const sampleRespostas = [
            {
                id: '1',
                nome: 'João Silva',
                cargo: 'Desenvolvedor',
                estado: 'SP',
                municipio: 'São Paulo',
                questionario: 'Satisfação Geral',
                data: new Date('2024-10-20').toISOString(),
                respostas: [
                    { pergunta: 'Como você avalia nosso serviço?', valor: '5', tipo: 'likert' },
                    { pergunta: 'Recomendaria para outros?', valor: 'Sim', tipo: 'boolean' },
                    { pergunta: 'Sugestões de melhoria', valor: 'Melhorar a interface do sistema', tipo: 'text' }
                ]
            },
            {
                id: '2',
                nome: 'Maria Santos',
                cargo: 'Analista',
                estado: 'RJ',
                municipio: 'Rio de Janeiro',
                questionario: 'Avaliação de Produto',
                data: new Date('2024-10-22').toISOString(),
                respostas: [
                    { pergunta: 'Qualidade do produto', valor: '4', tipo: 'likert' },
                    { pergunta: 'Facilidade de uso', valor: '5', tipo: 'likert' },
                    { pergunta: 'Comentários adicionais', valor: 'Produto excelente, mas poderia ser mais rápido', tipo: 'text' }
                ]
            }
        ];

        const sampleQuestionarios = [
            {
                id: '1',
                nome: 'Satisfação Geral',
                perguntas: [
                    { id: '1', texto: 'Como você avalia nosso serviço?', tipo: 'likert', obrigatoria: true },
                    { id: '2', texto: 'Recomendaria para outros?', tipo: 'boolean', obrigatoria: true },
                    { id: '3', texto: 'Sugestões de melhoria', tipo: 'text', obrigatoria: false }
                ]
            },
            {
                id: '2',
                nome: 'Avaliação de Produto',
                perguntas: [
                    { id: '1', texto: 'Qualidade do produto', tipo: 'likert', obrigatoria: true },
                    { id: '2', texto: 'Facilidade de uso', tipo: 'likert', obrigatoria: true },
                    { id: '3', texto: 'Comentários adicionais', tipo: 'text', obrigatoria: false }
                ]
            }
        ];

        const sampleLocais = [
            { id: '1', estado: 'SP', municipio: 'São Paulo' },
            { id: '2', estado: 'RJ', municipio: 'Rio de Janeiro' },
            { id: '3', estado: 'MG', municipio: 'Belo Horizonte' },
            { id: '4', estado: 'RS', municipio: 'Porto Alegre' }
        ];

        localStorage.setItem(CONFIG.STORAGE_KEYS.RESPOSTAS, JSON.stringify(sampleRespostas));
        localStorage.setItem(CONFIG.STORAGE_KEYS.QUESTIONARIOS, JSON.stringify(sampleQuestionarios));
        localStorage.setItem(CONFIG.STORAGE_KEYS.LOCAIS, JSON.stringify(sampleLocais));
    }

    // Métodos para gerenciar respostas
    getRespostas() {
        return JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.RESPOSTAS) || '[]');
    }

    addResposta(resposta) {
        const respostas = this.getRespostas();
        resposta.id = Date.now().toString();
        resposta.data = new Date().toISOString();
        respostas.push(resposta);
        localStorage.setItem(CONFIG.STORAGE_KEYS.RESPOSTAS, JSON.stringify(respostas));
        return resposta;
    }

    // Métodos para gerenciar questionários
    getQuestionarios() {
        return JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.QUESTIONARIOS) || '[]');
    }

    addQuestionario(questionario) {
        const questionarios = this.getQuestionarios();
        questionario.id = Date.now().toString();
        questionarios.push(questionario);
        localStorage.setItem(CONFIG.STORAGE_KEYS.QUESTIONARIOS, JSON.stringify(questionarios));
        return questionario;
    }

    // Métodos para gerenciar locais
    getLocais() {
        return JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.LOCAIS) || '[]');
    }

    addLocal(local) {
        const locais = this.getLocais();
        local.id = Date.now().toString();
        locais.push(local);
        localStorage.setItem(CONFIG.STORAGE_KEYS.LOCAIS, JSON.stringify(locais));
        return local;
    }

    // Limpar todos os dados
    clearAllData() {
        Object.values(CONFIG.STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        this.createSampleData();
    }
}

// ==================== SISTEMA DE NAVEGAÇÃO ====================
class NavigationManager {
    constructor() {
        this.currentSection = 'dashboard';
        this.initializeNavigation();
        this.setupSidebarToggle();
        this.setupMobileMenu();
    }

    initializeNavigation() {
        // Event listeners para navegação
        document.querySelectorAll('[data-section]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.currentTarget.getAttribute('data-section');
                this.navigateToSection(section);
            });
        });
    }

    navigateToSection(sectionName) {
        // Remove active class de todos os links e seções
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));

        // Adiciona active class ao link atual
        const activeLink = document.querySelector(`[data-section="${sectionName}"]`);
        if (activeLink) {
            activeLink.closest('.nav-item').classList.add('active');
        }

        // Mostra a seção atual
        const targetSection = document.getElementById(`section-${sectionName}`);
        if (targetSection) {
            targetSection.classList.add('active');
            this.currentSection = sectionName;
        }

        // Executa ações específicas da seção
        this.handleSectionSpecificActions(sectionName);
    }

    handleSectionSpecificActions(sectionName) {
        switch (sectionName) {
            case 'dashboard':
                window.dashboardManager?.loadDashboard();
                break;
            case 'sugestoes':
                window.suggestionsManager?.loadSuggestions();
                break;
            case 'definir-local':
                window.locationManager?.loadLocations();
                break;
            case 'questionarios':
                window.questionnaireManager?.loadQuestionnaires();
                break;
            case 'locais':
                window.locationManager?.loadLocationForm();
                break;
            case 'criar-questionario':
                window.questionnaireManager?.loadQuestionnaireForm();
                break;
        }
    }

    setupSidebarToggle() {
        const toggleBtn = document.getElementById('sidebarToggle');
        const sidebar = document.getElementById('sidebar');
        
        if (toggleBtn && sidebar) {
            toggleBtn.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
            });
        }
    }

    setupMobileMenu() {
        const mobileToggle = document.getElementById('mobileMenuToggle');
        const sidebar = document.getElementById('sidebar');
        
        if (mobileToggle && sidebar) {
            mobileToggle.addEventListener('click', () => {
                sidebar.classList.toggle('mobile-open');
            });
        }
    }
}

// ==================== GERENCIADOR DO DASHBOARD ====================
class DashboardManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.charts = {};
        this.filters = {
            estado: '',
            municipio: '',
            questionario: '',
            pergunta: '',
            periodo: 'all'
        };
        this.initializeDashboard();
    }

    initializeDashboard() {
        this.setupFilters();
        this.setupExport();
        this.setupModal();
        this.loadDashboard();
    }

    setupFilters() {
        // Filtros de localização
        const stateSelect = document.getElementById('stateSelect');
        const municipalitySelect = document.getElementById('municipalitySelect');
        const questionarioSelect = document.getElementById('questionarioFilterSelect');
        const perguntaSelect = document.getElementById('filtroPergunta');
        const periodSelect = document.querySelector('.period-selector');

        if (stateSelect) {
            stateSelect.addEventListener('change', (e) => {
                this.filters.estado = e.target.value;
                this.updateMunicipalityFilter();
                this.applyFilters();
            });
        }

        if (municipalitySelect) {
            municipalitySelect.addEventListener('change', (e) => {
                this.filters.municipio = e.target.value;
                this.applyFilters();
            });
        }

        if (questionarioSelect) {
            questionarioSelect.addEventListener('change', (e) => {
                this.filters.questionario = e.target.value;
                this.updatePerguntaFilter();
                this.applyFilters();
            });
        }

        if (perguntaSelect) {
            perguntaSelect.addEventListener('change', (e) => {
                this.filters.pergunta = e.target.value;
                this.applyFilters();
            });
        }

        if (periodSelect) {
            periodSelect.addEventListener('change', (e) => {
                this.filters.periodo = e.target.value;
                this.applyFilters();
            });
        }
    }

    loadDashboard() {
        this.populateFilters();
        this.updateStats();
        this.createCharts();
        this.loadRespostas();
    }

    populateFilters() {
        const locais = this.dataManager.getLocais();
        const questionarios = this.dataManager.getQuestionarios();

        // Popular estados
        const stateSelect = document.getElementById('stateSelect');
        if (stateSelect) {
            const estados = [...new Set(locais.map(local => local.estado))];
            stateSelect.innerHTML = '<option value="">Todos os Estados</option>';
            estados.forEach(estado => {
                stateSelect.innerHTML += `<option value="${estado}">${estado}</option>`;
            });
        }

        // Popular questionários
        const questionarioSelect = document.getElementById('questionarioFilterSelect');
        if (questionarioSelect) {
            questionarioSelect.innerHTML = '<option value="">Todos os Questionários</option>';
            questionarios.forEach(quest => {
                questionarioSelect.innerHTML += `<option value="${quest.nome}">${quest.nome}</option>`;
            });
        }
    }

    updateMunicipalityFilter() {
        const locais = this.dataManager.getLocais();
        const municipalitySelect = document.getElementById('municipalitySelect');
        
        if (municipalitySelect) {
            let municipios = locais.map(local => local.municipio);
            
            if (this.filters.estado) {
                municipios = locais
                    .filter(local => local.estado === this.filters.estado)
                    .map(local => local.municipio);
            }

            municipalitySelect.innerHTML = '<option value="">Todos os Municípios</option>';
            [...new Set(municipios)].forEach(municipio => {
                municipalitySelect.innerHTML += `<option value="${municipio}">${municipio}</option>`;
            });
        }
    }

    updatePerguntaFilter() {
        const questionarios = this.dataManager.getQuestionarios();
        const perguntaSelect = document.getElementById('filtroPergunta');
        
        if (perguntaSelect && this.filters.questionario) {
            const questionario = questionarios.find(q => q.nome === this.filters.questionario);
            
            perguntaSelect.innerHTML = '<option value="">Todas as Perguntas</option>';
            if (questionario) {
                questionario.perguntas.forEach(pergunta => {
                    perguntaSelect.innerHTML += `<option value="${pergunta.texto}">${pergunta.texto}</option>`;
                });
            }
        }
    }

    getFilteredData() {
        let respostas = this.dataManager.getRespostas();

        // Filtrar por período
        if (this.filters.periodo !== 'all') {
            const days = parseInt(this.filters.periodo);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            
            respostas = respostas.filter(resposta => 
                new Date(resposta.data) >= cutoffDate
            );
        }

        // Aplicar outros filtros
        if (this.filters.estado) {
            respostas = respostas.filter(r => r.estado === this.filters.estado);
        }
        if (this.filters.municipio) {
            respostas = respostas.filter(r => r.municipio === this.filters.municipio);
        }
        if (this.filters.questionario) {
            respostas = respostas.filter(r => r.questionario === this.filters.questionario);
        }

        return respostas;
    }

    updateStats() {
        const respostas = this.getFilteredData();
        
        // Estatísticas básicas
        document.getElementById('totalRespostas').textContent = respostas.length;
        
        const questionarios = [...new Set(respostas.map(r => r.questionario))];
        document.getElementById('totalQuestionarios').textContent = questionarios.length;
        
        const locais = [...new Set(respostas.map(r => `${r.municipio}, ${r.estado}`))];
        document.getElementById('totalLocais').textContent = locais.length;

        // Calcular média de satisfação (assumindo escala 1-5)
        const satisfactionRatings = respostas.flatMap(r => 
            r.respostas
                .filter(resp => resp.tipo === 'likert' && !isNaN(resp.valor))
                .map(resp => parseInt(resp.valor))
        );
        
        const avgSatisfaction = satisfactionRatings.length > 0 
            ? (satisfactionRatings.reduce((a, b) => a + b, 0) / satisfactionRatings.length).toFixed(1)
            : '0.0';
        
        document.getElementById('mediaSatisfacao').textContent = avgSatisfaction;
    }

    createCharts() {
        this.createSatisfactionChart();
        this.createLocationChart();
        this.createTimeChart();
        this.createQuestionnaireChart();
    }

    createSatisfactionChart() {
        const ctx = document.getElementById('chartSatisfacao');
        if (!ctx) return;

        const respostas = this.getFilteredData();
        const satisfactionData = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

        respostas.forEach(resposta => {
            resposta.respostas.forEach(resp => {
                if (resp.tipo === 'likert' && !isNaN(resp.valor)) {
                    const rating = parseInt(resp.valor);
                    if (rating >= 1 && rating <= 5) {
                        satisfactionData[rating]++;
                    }
                }
            });
        });

        if (this.charts.satisfaction) {
            this.charts.satisfaction.destroy();
        }

        this.charts.satisfaction = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['1 - Muito Insatisfeito', '2 - Insatisfeito', '3 - Neutro', '4 - Satisfeito', '5 - Muito Satisfeito'],
                datasets: [{
                    data: Object.values(satisfactionData),
                    backgroundColor: [
                        '#EF4444',
                        '#F59E0B',
                        '#6B7280',
                        '#10B981',
                        '#059669'
                    ],
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
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }

    createLocationChart() {
        const ctx = document.getElementById('chartLocalizacao');
        if (!ctx) return;

        const respostas = this.getFilteredData();
        const locationData = {};

        respostas.forEach(resposta => {
            const key = `${resposta.municipio}, ${resposta.estado}`;
            locationData[key] = (locationData[key] || 0) + 1;
        });

        const sortedData = Object.entries(locationData)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);

        if (this.charts.location) {
            this.charts.location.destroy();
        }

        this.charts.location = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sortedData.map(([location]) => location),
                datasets: [{
                    label: 'Número de Respostas',
                    data: sortedData.map(([, count]) => count),
                    backgroundColor: CONFIG.CHARTS.COLORS.PRIMARY,
                    borderColor: CONFIG.CHARTS.COLORS.PRIMARY,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
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
            }
        });
    }

    createTimeChart() {
        const ctx = document.getElementById('chartTempo');
        if (!ctx) return;

        const respostas = this.getFilteredData();
        const timeData = {};

        respostas.forEach(resposta => {
            const date = new Date(resposta.data).toLocaleDateString('pt-BR');
            timeData[date] = (timeData[date] || 0) + 1;
        });

        const sortedDates = Object.keys(timeData).sort((a, b) => 
            new Date(a.split('/').reverse().join('-')) - new Date(b.split('/').reverse().join('-'))
        );

        if (this.charts.time) {
            this.charts.time.destroy();
        }

        this.charts.time = new Chart(ctx, {
            type: 'line',
            data: {
                labels: sortedDates,
                datasets: [{
                    label: 'Respostas por Dia',
                    data: sortedDates.map(date => timeData[date]),
                    borderColor: CONFIG.CHARTS.COLORS.INFO,
                    backgroundColor: CONFIG.CHARTS.COLORS.INFO + '20',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
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
            }
        });
    }

    createQuestionnaireChart() {
        const ctx = document.getElementById('chartQuestionarios');
        if (!ctx) return;

        const respostas = this.getFilteredData();
        const questionnaireData = {};

        respostas.forEach(resposta => {
            questionnaireData[resposta.questionario] = (questionnaireData[resposta.questionario] || 0) + 1;
        });

        if (this.charts.questionnaire) {
            this.charts.questionnaire.destroy();
        }

        this.charts.questionnaire = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: Object.keys(questionnaireData),
                datasets: [{
                    data: Object.values(questionnaireData),
                    backgroundColor: CONFIG.CHARTS.COLORS.GRADIENT,
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
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }

    loadRespostas() {
        const respostas = this.getFilteredData();
        const container = document.getElementById('respostasGrid');
        
        if (!container) return;

        container.innerHTML = '';

        if (respostas.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <h3>Nenhuma resposta encontrada</h3>
                    <p>Não há respostas que correspondam aos filtros selecionados.</p>
                </div>
            `;
            return;
        }

        respostas.forEach(resposta => {
            const card = this.createRespostaCard(resposta);
            container.appendChild(card);
        });
    }

    createRespostaCard(resposta) {
        const template = document.getElementById('template-resposta-card');
        const card = template.content.cloneNode(true);

        card.querySelector('.respondente-nome').textContent = resposta.nome;
        card.querySelector('.respondente-cargo').textContent = resposta.cargo;
        card.querySelector('.local-text').textContent = `${resposta.municipio}, ${resposta.estado}`;
        card.querySelector('.data-text').textContent = new Date(resposta.data).toLocaleDateString('pt-BR');
        card.querySelector('.questionario-text').textContent = resposta.questionario;

        const btnDetalhes = card.querySelector('.btn-ver-detalhes');
        btnDetalhes.addEventListener('click', () => {
            this.showRespostaDetails(resposta);
        });

        return card;
    }

    showRespostaDetails(resposta) {
        const modal = document.getElementById('modalRespostaDetalhes');
        if (!modal) return;

        // Preencher informações do respondente
        document.getElementById('modalRespondenteNome').textContent = resposta.nome;
        document.getElementById('modalRespondenteCargo').textContent = resposta.cargo;
        document.getElementById('modalRespondenteLocal').textContent = `${resposta.municipio}, ${resposta.estado}`;
        document.getElementById('modalRespostaData').textContent = new Date(resposta.data).toLocaleDateString('pt-BR');

        // Preencher respostas
        const respostasList = document.getElementById('modalRespostasList');
        respostasList.innerHTML = '';

        resposta.respostas.forEach((resp, index) => {
            const item = this.createRespostaDetalheItem(resp, index + 1);
            respostasList.appendChild(item);
        });

        modal.classList.add('active');
    }

    createRespostaDetalheItem(resposta, numero) {
        const template = document.getElementById('template-resposta-detalhe');
        const item = template.content.cloneNode(true);

        item.querySelector('.pergunta-numero').textContent = `${numero}.`;
        item.querySelector('.pergunta-tipo-badge').textContent = resposta.tipo.toUpperCase();
        item.querySelector('.pergunta-texto').textContent = resposta.pergunta;
        
        const valorElement = item.querySelector('.resposta-valor');
        if (resposta.tipo === 'likert') {
            valorElement.innerHTML = `<span class="rating-value">${resposta.valor}/5</span>`;
        } else if (resposta.tipo === 'boolean') {
            valorElement.innerHTML = `<span class="boolean-value ${resposta.valor.toLowerCase()}">${resposta.valor}</span>`;
        } else {
            valorElement.innerHTML = `<span class="text-value">${resposta.valor}</span>`;
        }

        return item;
    }

    setupModal() {
        const modal = document.getElementById('modalRespostaDetalhes');
        const closeBtn = document.getElementById('btnFecharModal');
        const closeIcon = modal?.querySelector('.modal-close');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.classList.remove('active');
            });
        }

        if (closeIcon) {
            closeIcon.addEventListener('click', () => {
                modal.classList.remove('active');
            });
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        }
    }

    setupExport() {
        const exportBtn = document.getElementById('exportButton');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportData();
            });
        }
    }

    exportData() {
        const respostas = this.getFilteredData();
        
        // Converter para CSV
        const headers = ['Nome', 'Cargo', 'Estado', 'Município', 'Questionário', 'Data', 'Pergunta', 'Resposta', 'Tipo'];
        const rows = [];

        respostas.forEach(resposta => {
            resposta.respostas.forEach(resp => {
                rows.push([
                    resposta.nome,
                    resposta.cargo,
                    resposta.estado,
                    resposta.municipio,
                    resposta.questionario,
                    new Date(resposta.data).toLocaleDateString('pt-BR'),
                    resp.pergunta,
                    resp.valor,
                    resp.tipo
                ]);
            });
        });

        const csvContent = [headers, ...rows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');

        // Download do arquivo
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `pesquisa_dados_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        Swal.fire({
            icon: 'success',
            title: 'Dados Exportados!',
            text: 'O arquivo CSV foi baixado com sucesso.',
            timer: 2000,
            showConfirmButton: false
        });
    }

    applyFilters() {
        this.updateStats();
        this.createCharts();
        this.loadRespostas();
    }
}

// ==================== GERENCIADOR DE SUGESTÕES ====================
class SuggestionsManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
    }

    loadSuggestions() {
        const respostas = this.dataManager.getRespostas();
        const container = document.getElementById('sugestoesGrid');
        
        if (!container) return;

        container.innerHTML = '';

        // Filtrar apenas respostas de texto que podem ser sugestões
        const sugestoes = respostas.flatMap(resposta => 
            resposta.respostas
                .filter(resp => resp.tipo === 'text' && resp.valor.trim().length > 0)
                .map(resp => ({
                    ...resp,
                    nome: resposta.nome,
                    cargo: resposta.cargo,
                    estado: resposta.estado,
                    municipio: resposta.municipio,
                    questionario: resposta.questionario,
                    data: resposta.data
                }))
        );

        if (sugestoes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-lightbulb"></i>
                    <h3>Nenhuma sugestão encontrada</h3>
                    <p>Não há sugestões de melhoria disponíveis no momento.</p>
                </div>
            `;
            return;
        }

        sugestoes.forEach(sugestao => {
            const card = this.createSugestaoCard(sugestao);
            container.appendChild(card);
        });
    }

    createSugestaoCard(sugestao) {
        const template = document.getElementById('template-sugestao-card');
        const card = template.content.cloneNode(true);

        card.querySelector('.autor-nome').textContent = sugestao.nome;
        card.querySelector('.autor-cargo').textContent = sugestao.cargo;
        card.querySelector('.local-text').textContent = `${sugestao.municipio}, ${sugestao.estado}`;
        card.querySelector('.data-text').textContent = new Date(sugestao.data).toLocaleDateString('pt-BR');
        card.querySelector('.pergunta-titulo').textContent = sugestao.pergunta;
        card.querySelector('.sugestao-texto').textContent = sugestao.valor;
        card.querySelector('.nome-text').textContent = sugestao.questionario;

        return card;
    }
}

// ==================== INICIALIZAÇÃO DA APLICAÇÃO ====================
class App {
    constructor() {
        this.dataManager = new DataManager();
        this.navigationManager = new NavigationManager();
        this.dashboardManager = new DashboardManager(this.dataManager);
        this.suggestionsManager = new SuggestionsManager(this.dataManager);
        
        this.setupGlobalEventListeners();
        this.exposeToWindow();
    }

    setupGlobalEventListeners() {
        // Botão limpar dados
        const limparDadosBtn = document.getElementById('limparDados');
        if (limparDadosBtn) {
            limparDadosBtn.addEventListener('click', () => {
                this.handleClearData();
            });
        }

        // Tecla ESC para fechar modais
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const activeModal = document.querySelector('.modal.active');
                if (activeModal) {
                    activeModal.classList.remove('active');
                }
            }
        });
    }

    handleClearData() {
        Swal.fire({
            title: 'Limpar Dados',
            text: 'Tem certeza que deseja limpar todos os dados? Esta ação não pode ser desfeita.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#EF4444',
            cancelButtonColor: '#6B7280',
            confirmButtonText: 'Sim, limpar dados',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                this.dataManager.clearAllData();
                this.dashboardManager.loadDashboard();
                
                Swal.fire({
                    icon: 'success',
                    title: 'Dados Limpos!',
                    text: 'Todos os dados foram removidos e dados de exemplo foram carregados.',
                    timer: 2000,
                    showConfirmButton: false
                });
            }
        });
    }

    exposeToWindow() {
        // Expor managers para uso global
        window.dataManager = this.dataManager;
        window.dashboardManager = this.dashboardManager;
        window.suggestionsManager = this.suggestionsManager;
        window.navigationManager = this.navigationManager;
    }
}

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', () => {
    // Verificar se as dependências estão carregadas
    if (typeof Chart === 'undefined') {
        console.error('Chart.js não está carregado. Verifique se o CDN está funcionando.');
        return;
    }

    if (typeof Swal === 'undefined') {
        console.error('SweetAlert2 não está carregado. Verifique se o CDN está funcionando.');
        return;
    }

    // Inicializar aplicação
    window.app = new App();
    
    console.log('🚀 Dashboard de Pesquisa de Satisfação carregado com sucesso!');
});

// ==================== FUNÇÕES UTILITÁRIAS ====================
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('pt-BR');
}

function generateId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Exportar para uso global
window.CONFIG = CONFIG;
window.formatDate = formatDate;
window.generateId = generateId;
window.debounce = debounce;