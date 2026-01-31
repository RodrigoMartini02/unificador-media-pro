/**
 * Dashboard de Pesquisa de Satisfação - Refatorado
 * Conecta com API backend para gerenciamento de dados
 */

// ==================== CONFIGURAÇÃO ====================
const API_URL = '/api';
const IBGE_API_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades';

// ==================== API DO IBGE ====================
const ibgeApi = {
    async getEstados() {
        try {
            const response = await fetch(`${IBGE_API_URL}/estados?orderBy=nome`);
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar estados do IBGE:', error);
            return [];
        }
    },

    async getMunicipios(ufId) {
        try {
            const response = await fetch(`${IBGE_API_URL}/estados/${ufId}/municipios?orderBy=nome`);
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar municípios do IBGE:', error);
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

            // Se a resposta não for ok, retornar null ou array vazio dependendo do endpoint
            if (!response.ok) {
                console.warn(`API ${endpoint} returned ${response.status}:`, data);
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

            this.updateStats(overview || {});
            this.populateFilters(locations || [], questionnaires || []);
            this.createCharts(satisfaction || []);
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

        // Garantir que data é um array
        const safeData = Array.isArray(data) ? data : [];

        const values = categories.map(cat => {
            const item = safeData.find(d => d.category === cat);
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

// ==================== GERENCIADOR DE LOCAIS ====================
class LocalManager {
    constructor() {
        this.estados = [];
        this.selectedUF = null;
    }

    async init() {
        await this.loadEstados();
        this.setupEventListeners();
        await this.loadLocaisCadastrados();
    }

    async loadEstados() {
        this.estados = await ibgeApi.getEstados();
        this.populateEstadoSelect();
    }

    populateEstadoSelect() {
        const select = document.getElementById('selectEstado');
        if (!select) return;

        select.innerHTML = '<option value="">Selecione o estado</option>' +
            this.estados.map(e => `<option value="${e.id}" data-sigla="${e.sigla}" data-nome="${e.nome}">${e.nome}</option>`).join('');
    }

    setupEventListeners() {
        // Mudança de estado - carregar municípios
        const estadoSelect = document.getElementById('selectEstado');
        if (estadoSelect) {
            estadoSelect.addEventListener('change', async (e) => {
                const option = e.target.selectedOptions[0];
                this.selectedUF = {
                    id: e.target.value,
                    sigla: option?.dataset.sigla,
                    nome: option?.dataset.nome
                };
                await this.loadMunicipios(e.target.value);
            });
        }

        // Formulário de definir local
        const form = document.getElementById('formDefinirLocal');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.vincularLocal();
            });
        }
    }

    async loadMunicipios(ufId) {
        const select = document.getElementById('selectMunicipio');
        if (!select) return;

        if (!ufId) {
            select.innerHTML = '<option value="">Selecione o município</option>';
            select.disabled = true;
            return;
        }

        select.innerHTML = '<option value="">Carregando...</option>';
        select.disabled = true;

        const municipios = await ibgeApi.getMunicipios(ufId);

        select.innerHTML = '<option value="">Selecione o município</option>' +
            municipios.map(m => `<option value="${m.nome}">${m.nome}</option>`).join('');
        select.disabled = false;
    }

    async vincularLocal() {
        const questionarioSelect = document.getElementById('selectQuestionario');
        const municipioSelect = document.getElementById('selectMunicipio');

        const questionarioId = questionarioSelect?.value;
        const municipio = municipioSelect?.value;
        const estado = this.selectedUF?.nome;

        if (!questionarioId || !municipio || !estado) {
            Swal.fire('Atenção', 'Preencha todos os campos', 'warning');
            return;
        }

        try {
            // Vincular o local ao questionário via API
            const result = await api.patch(`/questionnaires/${questionarioId}/location`, {
                state: estado,
                municipality: municipio
            });

            if (result && !result.error) {
                Swal.fire('Sucesso', 'Local vinculado ao questionário com sucesso!', 'success');
                await this.loadLocaisCadastrados();

                // Limpar formulário
                document.getElementById('formDefinirLocal')?.reset();
                document.getElementById('selectMunicipio').innerHTML = '<option value="">Selecione o município</option>';
                document.getElementById('selectMunicipio').disabled = true;
            } else {
                throw new Error(result?.error || 'Erro ao vincular');
            }
        } catch (error) {
            console.error('Erro ao vincular local:', error);
            Swal.fire('Erro', 'Não foi possível vincular o local ao questionário', 'error');
        }
    }

    async loadLocaisCadastrados() {
        try {
            // Carregar questionários com seus locais vinculados
            const questionnaires = await api.get('/questionnaires');
            this.renderLocaisCadastrados(questionnaires || []);
        } catch (error) {
            console.error('Erro ao carregar vínculos:', error);
        }
    }

    renderLocaisCadastrados(questionnaires) {
        const tbody = document.getElementById('corpoTabelaVinculos');
        const emptyMsg = document.getElementById('emptyVinculos');

        if (!tbody) return;

        // Filtrar apenas questionários com local definido
        const comLocal = questionnaires.filter(q => q.state && q.municipality);

        if (!comLocal.length) {
            tbody.innerHTML = '';
            if (emptyMsg) emptyMsg.style.display = 'block';
            return;
        }

        if (emptyMsg) emptyMsg.style.display = 'none';

        tbody.innerHTML = comLocal.map(q => `
            <tr class="vinculo-row">
                <td class="vinculo-questionario">${q.name}</td>
                <td class="vinculo-estado">${q.state}</td>
                <td class="vinculo-municipio">${q.municipality}</td>
                <td class="vinculo-status">
                    <span class="status-badge ${q.is_active ? 'status-ativo' : 'status-inativo'}">${q.is_active ? 'Ativo' : 'Inativo'}</span>
                </td>
                <td class="vinculo-data">${new Date(q.created_at).toLocaleDateString('pt-BR')}</td>
                <td class="vinculo-acoes">
                    <button class="btn-icon btn-delete" title="Remover local" onclick="localManager.removerLocal(${q.id})">
                        <i class="fas fa-unlink"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async removerLocal(questionarioId) {
        const result = await Swal.fire({
            title: 'Remover local do questionário?',
            text: 'O questionário ficará sem local definido',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#EF4444',
            cancelButtonText: 'Cancelar',
            confirmButtonText: 'Sim, remover'
        });

        if (result.isConfirmed) {
            try {
                // Definir location_id como null
                await api.patch(`/questionnaires/${questionarioId}/location`, {
                    state: null,
                    municipality: null
                });
                Swal.fire('Removido!', 'Local desvinculado do questionário', 'success');
                await this.loadLocaisCadastrados();
            } catch (error) {
                Swal.fire('Erro', 'Não foi possível remover o local', 'error');
            }
        }
    }
}

// ==================== GERENCIADOR DE QUESTIONÁRIOS ====================
class QuestionnaireManager {
    constructor() {
        this.questionnaires = [];
        this.selectedQuestionnaireId = null;
        this.selectedQuestionnaire = null;
        this.currentQuestions = [];
    }

    async init() {
        this.setupEventListeners();
        await this.loadQuestionnaires();
    }

    setupEventListeners() {
        // Formulário de criar questionário
        const formCriar = document.getElementById('formCriarQuestionario');
        if (formCriar) {
            formCriar.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.criarQuestionario();
            });
        }

        // Formulário de adicionar pergunta
        const formPergunta = document.getElementById('formAdicionarPergunta');
        if (formPergunta) {
            formPergunta.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.adicionarPergunta();
            });
        }

        // Tipo de pergunta - mostrar/esconder escala
        const tipoPergunta = document.getElementById('tipoPergunta');
        if (tipoPergunta) {
            tipoPergunta.addEventListener('change', (e) => {
                const grupoEscala = document.getElementById('grupoEscala');
                if (grupoEscala) {
                    grupoEscala.style.display = e.target.value === 'escala' ? 'block' : 'none';
                }
            });
        }
    }

    async loadQuestionnaires() {
        try {
            const data = await api.get('/questionnaires');
            this.questionnaires = Array.isArray(data) ? data : [];
            this.renderQuestionnairesList();
            this.populateSelectQuestionario();
        } catch (error) {
            console.error('Erro ao carregar questionários:', error);
        }
    }

    renderQuestionnairesList() {
        const container = document.getElementById('listaQuestionarios');
        const emptyMsg = document.getElementById('emptyQuestionarios');

        if (!container) return;

        if (!this.questionnaires.length) {
            container.innerHTML = '';
            if (emptyMsg) emptyMsg.style.display = 'block';
            return;
        }

        if (emptyMsg) emptyMsg.style.display = 'none';

        container.innerHTML = this.questionnaires.map(q => `
            <div class="questionario-item ${this.selectedQuestionnaireId === q.id ? 'selected' : ''}" data-id="${q.id}">
                <div class="questionario-info" onclick="questionnaireManager.selectQuestionario(${q.id})" style="cursor: pointer; flex: 1;">
                    <h4 class="questionario-nome">${q.name}</h4>
                    <span class="questionario-total">${q.question_count || 0} perguntas</span>
                    <span class="status-badge ${q.is_active ? 'status-ativo' : 'status-inativo'}">
                        ${q.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                </div>
                <div class="questionario-actions">
                    <button class="btn-icon btn-toggle" title="${q.is_active ? 'Desativar' : 'Ativar'}" onclick="questionnaireManager.toggleActive(${q.id})">
                        <i class="fas fa-power-off"></i>
                    </button>
                    <button class="btn-icon btn-delete" title="Excluir" onclick="questionnaireManager.deleteQuestionario(${q.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    populateSelectQuestionario() {
        // Popular select na seção "Definir Local"
        const selectDefinirLocal = document.getElementById('selectQuestionario');
        if (selectDefinirLocal) {
            selectDefinirLocal.innerHTML = '<option value="">Selecione o questionário</option>' +
                this.questionnaires.map(q => `<option value="${q.id}">${q.name}</option>`).join('');
        }
    }

    async criarQuestionario() {
        const nomeInput = document.getElementById('nomeQuestionario');
        const nome = nomeInput?.value?.trim();

        if (!nome) {
            Swal.fire('Atenção', 'Digite o nome do questionário', 'warning');
            return;
        }

        try {
            const result = await api.post('/questionnaires', { name: nome });

            if (result && !result.error) {
                Swal.fire('Sucesso', 'Questionário criado com sucesso!', 'success');
                nomeInput.value = '';
                await this.loadQuestionnaires();
                // Selecionar automaticamente o questionário criado
                this.selectQuestionario(result.id);
            } else {
                throw new Error(result?.error || 'Erro ao criar');
            }
        } catch (error) {
            console.error('Erro ao criar questionário:', error);
            Swal.fire('Erro', 'Não foi possível criar o questionário', 'error');
        }
    }

    async selectQuestionario(id) {
        try {
            const data = await api.get(`/questionnaires/${id}`);
            if (data) {
                this.selectedQuestionnaireId = id;
                this.selectedQuestionnaire = data;

                // Mostrar cards de adicionar pergunta e lista de perguntas
                const cardPergunta = document.getElementById('cardAdicionarPergunta');
                const cardPerguntas = document.getElementById('cardPerguntas');
                const badgeAtual = document.getElementById('badgeQuestionarioAtual');
                const badgeNome = document.getElementById('badgeNomeQuestionario');

                if (cardPergunta) cardPergunta.style.display = 'block';
                if (cardPerguntas) cardPerguntas.style.display = 'block';
                if (badgeAtual) badgeAtual.textContent = data.name;
                if (badgeNome) badgeNome.textContent = data.name;

                this.renderQuestionnairesList();
                this.renderPerguntas(data.questions || []);
            }
        } catch (error) {
            console.error('Erro ao selecionar questionário:', error);
        }
    }

    renderPerguntas(questions) {
        const container = document.getElementById('listaPerguntas');
        const emptyMsg = document.getElementById('emptyPerguntas');

        if (!container) return;

        if (!questions.length) {
            container.innerHTML = '';
            if (emptyMsg) emptyMsg.style.display = 'block';
            return;
        }

        if (emptyMsg) emptyMsg.style.display = 'none';

        const tipoLabels = {
            'scale': 'Escala',
            'boolean': 'Sim/Não',
            'text': 'Texto',
            'multiple': 'Múltipla Escolha'
        };

        // Guardar as perguntas para uso no edit
        this.currentQuestions = questions;

        container.innerHTML = questions.map((q, index) => `
            <div class="pergunta-item" data-id="${q.id}">
                <div class="pergunta-header">
                    <span class="pergunta-numero">${index + 1}.</span>
                    <span class="badge pergunta-tipo">${tipoLabels[q.type] || q.type}</span>
                </div>
                <div class="pergunta-texto">${q.text}</div>
                <div class="pergunta-actions">
                    <button class="btn-icon btn-edit" title="Editar" onclick="questionnaireManager.editPergunta(${q.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-delete" title="Excluir" onclick="questionnaireManager.deletePergunta(${q.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    async adicionarPergunta() {
        if (!this.selectedQuestionnaireId) {
            Swal.fire('Atenção', 'Selecione um questionário primeiro', 'warning');
            return;
        }

        const textoInput = document.getElementById('textoPergunta');
        const tipoSelect = document.getElementById('tipoPergunta');
        const escalaSelect = document.getElementById('valorEscala');

        const texto = textoInput?.value?.trim();
        const tipo = tipoSelect?.value;

        if (!texto || !tipo) {
            Swal.fire('Atenção', 'Preencha todos os campos', 'warning');
            return;
        }

        // Mapear tipos do frontend para o backend
        const tipoMap = {
            'escala': 'scale',
            'simnao': 'boolean',
            'texto': 'text'
        };

        const options = {};
        if (tipo === 'escala') {
            options.max = parseInt(escalaSelect?.value) || 10;
        }

        try {
            const result = await api.post(`/questionnaires/${this.selectedQuestionnaireId}/questions`, {
                text: texto,
                type: tipoMap[tipo] || tipo,
                options: options,
                is_required: true
            });

            if (result && !result.error) {
                Swal.fire('Sucesso', 'Pergunta adicionada com sucesso!', 'success');
                textoInput.value = '';
                tipoSelect.value = '';
                document.getElementById('grupoEscala').style.display = 'none';

                // Recarregar questionário para atualizar lista de perguntas
                await this.selectQuestionario(this.selectedQuestionnaireId);
                await this.loadQuestionnaires();
            } else {
                throw new Error(result?.error || 'Erro ao adicionar');
            }
        } catch (error) {
            console.error('Erro ao adicionar pergunta:', error);
            Swal.fire('Erro', 'Não foi possível adicionar a pergunta', 'error');
        }
    }

    async deleteQuestionario(id) {
        const result = await Swal.fire({
            title: 'Excluir questionário?',
            text: 'Esta ação não pode ser desfeita!',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#EF4444',
            cancelButtonText: 'Cancelar',
            confirmButtonText: 'Sim, excluir'
        });

        if (result.isConfirmed) {
            try {
                await api.delete(`/questionnaires/${id}`);
                Swal.fire('Excluído!', 'Questionário excluído com sucesso', 'success');

                // Se era o selecionado, limpar seleção
                if (this.selectedQuestionnaireId === id) {
                    this.selectedQuestionnaireId = null;
                    this.selectedQuestionnaire = null;
                    document.getElementById('cardAdicionarPergunta').style.display = 'none';
                    document.getElementById('cardPerguntas').style.display = 'none';
                }

                await this.loadQuestionnaires();
            } catch (error) {
                console.error('Erro ao excluir:', error);
                Swal.fire('Erro', 'Não foi possível excluir o questionário', 'error');
            }
        }
    }

    async deletePergunta(questionId) {
        const result = await Swal.fire({
            title: 'Excluir pergunta?',
            text: 'Esta ação não pode ser desfeita!',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#EF4444',
            cancelButtonText: 'Cancelar',
            confirmButtonText: 'Sim, excluir'
        });

        if (result.isConfirmed) {
            try {
                await api.delete(`/questionnaires/${this.selectedQuestionnaireId}/questions/${questionId}`);
                Swal.fire('Excluída!', 'Pergunta excluída com sucesso', 'success');
                await this.selectQuestionario(this.selectedQuestionnaireId);
                await this.loadQuestionnaires();
            } catch (error) {
                console.error('Erro ao excluir pergunta:', error);
                Swal.fire('Erro', 'Não foi possível excluir a pergunta', 'error');
            }
        }
    }

    async editPergunta(questionId) {
        // Buscar a pergunta atual
        const pergunta = this.currentQuestions?.find(q => q.id === questionId);
        if (!pergunta) {
            Swal.fire('Erro', 'Pergunta não encontrada', 'error');
            return;
        }

        const textoAtual = pergunta.text;
        const tipoAtual = pergunta.type;

        const { value: formValues } = await Swal.fire({
            title: 'Editar Pergunta',
            html: `
                <div style="text-align: left;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 500;">Texto da Pergunta</label>
                    <textarea id="swal-texto" class="swal2-textarea" style="width: 100%; min-height: 80px;">${textoAtual}</textarea>
                    <label style="display: block; margin-bottom: 5px; margin-top: 15px; font-weight: 500;">Tipo de Resposta</label>
                    <select id="swal-tipo" class="swal2-select" style="width: 100%;">
                        <option value="scale" ${tipoAtual === 'scale' ? 'selected' : ''}>Escala</option>
                        <option value="boolean" ${tipoAtual === 'boolean' ? 'selected' : ''}>Sim/Não</option>
                        <option value="text" ${tipoAtual === 'text' ? 'selected' : ''}>Texto</option>
                    </select>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Salvar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#3b82f6',
            preConfirm: () => {
                const texto = document.getElementById('swal-texto').value.trim();
                const tipo = document.getElementById('swal-tipo').value;
                if (!texto) {
                    Swal.showValidationMessage('Digite o texto da pergunta');
                    return false;
                }
                return { texto, tipo };
            }
        });

        if (formValues) {
            try {
                const result = await api.put(
                    `/questionnaires/${this.selectedQuestionnaireId}/questions/${questionId}`,
                    { text: formValues.texto, type: formValues.tipo }
                );

                if (result && !result.error) {
                    Swal.fire('Sucesso', 'Pergunta atualizada com sucesso!', 'success');
                    await this.selectQuestionario(this.selectedQuestionnaireId);
                } else {
                    throw new Error(result?.error || 'Erro ao atualizar');
                }
            } catch (error) {
                console.error('Erro ao editar pergunta:', error);
                Swal.fire('Erro', 'Não foi possível atualizar a pergunta', 'error');
            }
        }
    }

    async toggleActive(id) {
        try {
            const result = await api.patch(`/questionnaires/${id}/toggle`);
            if (result) {
                const status = result.is_active ? 'ativado' : 'desativado';
                Swal.fire('Sucesso', `Questionário ${status} com sucesso!`, 'success');
                await this.loadQuestionnaires();
            }
        } catch (error) {
            console.error('Erro ao alterar status:', error);
            Swal.fire('Erro', 'Não foi possível alterar o status', 'error');
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
let localManager;
let questionnaireManager;

document.addEventListener('DOMContentLoaded', async () => {
    // Verificar dependências
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js não carregado');
    }

    navigation = new NavigationManager();
    navigation.init();

    dashboard = new DashboardManager();
    await dashboard.init();

    // Inicializar gerenciador de questionários
    questionnaireManager = new QuestionnaireManager();
    await questionnaireManager.init();

    // Inicializar gerenciador de locais
    localManager = new LocalManager();
    await localManager.init();

    // Expor para uso global
    window.dashboard = dashboard;
    window.api = api;
    window.localManager = localManager;
    window.questionnaireManager = questionnaireManager;

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
