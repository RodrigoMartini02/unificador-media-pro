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

// ==================== GERENCIADOR DO DASHBOARD ====================
class DashboardManager {
    constructor() {
        this.charts = {};
        this.filters = { state: '', questionnaire_id: '', period: 'all' };
    }

    async init() {
        if (!api.isAuthenticated()) {
            window.location.href = 'quest.html';
            return;
        }
        this.bindEvents();
        await this.load();
    }

    bindEvents() {
        document.getElementById('stateSelect')?.addEventListener('change', (e) => {
            this.filters.state = e.target.value;
            this.load();
        });

        document.getElementById('questionarioFilterSelect')?.addEventListener('change', (e) => {
            this.filters.questionnaire_id = e.target.value;
            this.load();
        });

        document.querySelector('.period-selector')?.addEventListener('change', (e) => {
            this.filters.period = e.target.value;
            this.load();
        });

        document.getElementById('exportButton')?.addEventListener('click', () => this.exportCSV());
        document.getElementById('logoutBtn')?.addEventListener('click', () => api.logout());
    }

    async load() {
        try {
            this.showLoading();
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
            Utils.toast.error('Erro ao carregar dados');
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

    createCharts(satisfactionData) {
        const ctx = document.getElementById('chartSatisfacao');
        if (!ctx || !window.Chart) return;

        if (this.charts.satisfaction) this.charts.satisfaction.destroy();

        const categories = ['Muito Insatisfeito', 'Insatisfeito', 'Neutro', 'Satisfeito', 'Muito Satisfeito'];
        const style = getComputedStyle(document.documentElement);
        const colors = [
            style.getPropertyValue('--chart-muito-insatisfeito').trim(),
            style.getPropertyValue('--chart-insatisfeito').trim(),
            style.getPropertyValue('--chart-neutro').trim(),
            style.getPropertyValue('--chart-satisfeito').trim(),
            style.getPropertyValue('--chart-muito-satisfeito').trim()
        ];
        const safeData = Array.isArray(satisfactionData) ? satisfactionData : [];

        const values = categories.map(cat => {
            const item = safeData.find(d => d.category === cat);
            return item ? parseInt(item.count) : 0;
        });

        this.charts.satisfaction = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: categories,
                datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: style.getPropertyValue('--bg-primary').trim() }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { padding: 20, usePointStyle: true } } }
            }
        });
    }

    async loadResponses() {
        const params = new URLSearchParams();
        if (this.filters.state) params.append('state', this.filters.state);
        if (this.filters.questionnaire_id) params.append('questionnaire_id', this.filters.questionnaire_id);

        const responses = await api.get(`/responses?${params}`);
        this.renderResponses(responses || []);
    }

    renderResponses(responses) {
        const container = document.getElementById('respostasGrid');
        if (!container) return;

        Utils.clearContainer(container);

        if (!responses.length) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';

            const icon = document.createElement('i');
            icon.className = 'fas fa-inbox';

            const title = document.createElement('h3');
            title.textContent = 'Nenhuma resposta encontrada';

            emptyState.appendChild(icon);
            emptyState.appendChild(title);
            container.appendChild(emptyState);
            return;
        }

        responses.forEach(r => {
            const card = Utils.cloneTemplate('template-resposta-card');
            if (!card) return;

            Utils.setText(card, '.respondente-nome', r.is_anonymous ? 'Anônimo' : (r.respondent_name || 'Não informado'));
            Utils.setText(card, '.respondente-cargo', r.respondent_position || '-');
            Utils.setText(card, '.local-text', `${r.municipality || ''}, ${r.state || ''}`);
            Utils.setText(card, '.data-text', Utils.formatDate(r.submitted_at));
            Utils.setText(card, '.questionario-text', r.questionnaire_name || '');

            card.querySelector('.btn-ver-detalhes')?.addEventListener('click', () => this.viewResponse(r.id));
            container.appendChild(card);
        });
    }

    async viewResponse(id) {
        const response = await api.get(`/responses/${id}`);
        if (!response) return;

        const modal = document.getElementById('modalDetalhesResposta');
        if (!modal) return;

        Utils.setText(modal, '#modalRespondenteNome', response.is_anonymous ? 'Anônimo' : (response.respondent_name || 'Não informado'));
        Utils.setText(modal, '#modalRespondenteCargo', response.respondent_position || '-');
        Utils.setText(modal, '#modalRespondenteLocal', `${response.municipality || ''}, ${response.state || ''}`);
        Utils.setText(modal, '#modalRespostaData', Utils.formatDate(response.submitted_at));

        const list = document.getElementById('modalRespostasList');
        Utils.clearContainer(list);
        (response.answers || []).forEach((a, i) => {
            const item = Utils.cloneTemplate('template-resposta-detalhe');
            if (!item) return;
            Utils.setText(item, '.pergunta-numero', `${i + 1}.`);
            Utils.setText(item, '.pergunta-tipo-badge', a.question_type?.toUpperCase() || '');
            Utils.setText(item, '.pergunta-texto', a.question_text || '');
            Utils.setText(item, '.resposta-valor', this.formatAnswer(a));
            list.appendChild(item);
        });

        Utils.openModal(modal);
    }

    formatAnswer(answer) {
        if (answer.question_type === 'scale') return `${answer.numeric_value}/10`;
        if (answer.question_type === 'boolean') return answer.value === 'true' ? 'Sim' : 'Não';
        return answer.value || '-';
    }

    exportCSV() {
        const params = new URLSearchParams(this.filters);
        window.location.href = `${API_URL}/export/csv?${params}`;
    }

    showLoading() { Utils.show(document.getElementById('loadingOverlay')); }
    hideLoading() { Utils.hide(document.getElementById('loadingOverlay')); }
    closeModal() { Utils.closeModal('modalDetalhesResposta'); }
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

            row.querySelector('.btn-delete')?.addEventListener('click', () => this.removerLocal(q.id));
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
let dashboard, navigation, localManager, questionnaireManager;

document.addEventListener('DOMContentLoaded', async () => {
    navigation = new NavigationManager();
    navigation.init();

    dashboard = new DashboardManager();
    await dashboard.init();

    questionnaireManager = new QuestionnaireManager();
    await questionnaireManager.init();

    localManager = new LocalManager();
    await localManager.init();

    // Expor para uso global
    window.dashboard = dashboard;
    window.api = api;
    window.localManager = localManager;
    window.questionnaireManager = questionnaireManager;

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
