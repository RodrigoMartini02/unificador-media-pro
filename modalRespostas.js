// ========== CONFIGURAÇÕES ==========

const MODAL_RESPOSTAS_CONFIG = {
    STORAGE_KEY: 'questionnaireSubmissions',
    TEMPLATES_KEY: 'questionarioTemplates',
    IDENTIFICACAO_KEY: 'questionnaireIdentification',
    ITEMS_PER_PAGE: 10
};

// ========== GERENCIADOR DE DADOS ==========

class QuestionariosRespondidosDataManager {
    constructor() {
        this.submissions = [];
        this.templates = [];
        this.filtros = {
            municipio: '',
            estado: '',
            dataInicio: '',
            dataFim: '',
            identificacao: ''
        };
        this.ordenacao = 'data_desc';
        
        this.carregarDados();
    }
    
    carregarDados() {
        this.carregarSubmissoes();
        this.carregarTemplates();
    }
    
    carregarSubmissoes() {
        try {
            const dadosArmazenados = localStorage.getItem(MODAL_RESPOSTAS_CONFIG.STORAGE_KEY);
            this.submissions = dadosArmazenados ? JSON.parse(dadosArmazenados) : [];
            
            this.submissions = this.submissions.map(submission => {
                if (!submission.id) {
                    submission.id = `submission-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                }
                
                if (!submission.responses) {
                    submission.responses = {};
                }
                
                return submission;
            });
        } catch (error) {
            console.error('Erro ao acessar dados de questionários respondidos:', error);
            this.submissions = [];
        }
    }
    
    carregarTemplates() {
        try {
            const dadosTemplates = localStorage.getItem(MODAL_RESPOSTAS_CONFIG.TEMPLATES_KEY);
            this.templates = dadosTemplates ? JSON.parse(dadosTemplates) : [];
        } catch (error) {
            console.error('Erro ao carregar templates de questionários:', error);
            this.templates = [];
        }
    }
    
    filtrarSubmissoes() {
        return this.submissions.filter(submission => {
            const respostaInfo = submission.responses || {};
            const identificacao = respostaInfo.identification || {};
            const localizacao = respostaInfo.location || {};
            
            if (this.filtros.municipio && 
                !localizacao.municipalityText?.toLowerCase().includes(this.filtros.municipio.toLowerCase())) {
                return false;
            }
            
            if (this.filtros.estado && 
                !localizacao.stateText?.toLowerCase().includes(this.filtros.estado.toLowerCase())) {
                return false;
            }
            
            if (this.filtros.dataInicio) {
                const dataInicio = new Date(this.filtros.dataInicio);
                const dataSubmissao = new Date(submission.submissionDate);
                if (dataSubmissao < dataInicio) return false;
            }
            
            if (this.filtros.dataFim) {
                const dataFim = new Date(this.filtros.dataFim);
                dataFim.setHours(23, 59, 59);
                const dataSubmissao = new Date(submission.submissionDate);
                if (dataSubmissao > dataFim) return false;
            }
            
            if (this.filtros.identificacao) {
                const termo = this.filtros.identificacao.toLowerCase();
                const nome = identificacao.name?.toLowerCase() || '';
                const cargo = identificacao.position?.toLowerCase() || '';
                
                if (!nome.includes(termo) && !cargo.includes(termo)) {
                    return false;
                }
            }
            
            return true;
        });
    }
    
    ordenarSubmissoes(submissoes) {
        return [...submissoes].sort((a, b) => {
            switch (this.ordenacao) {
                case 'data_asc':
                    return new Date(a.submissionDate) - new Date(b.submissionDate);
                case 'data_desc':
                default:
                    return new Date(b.submissionDate) - new Date(a.submissionDate);
            }
        });
    }
    
    obterSubmissoesPaginadas(submissoes, pagina, itensPorPagina) {
        const startIndex = (pagina - 1) * itensPorPagina;
        const endIndex = Math.min(startIndex + itensPorPagina, submissoes.length);
        
        return {
            items: submissoes.slice(startIndex, endIndex),
            totalPaginas: Math.ceil(submissoes.length / itensPorPagina),
            paginaAtual: pagina,
            totalItens: submissoes.length
        };
    }
    
    obterTemplatePorId(templateId) {
        return this.templates.find(t => t.id === templateId);
    }
    
    calcularMediaEscala(submission) {
        const templateAssociado = this.obterTemplatePorId(submission.templateId);
        if (!templateAssociado || !templateAssociado.questions) return null;
        
        const respostasEscala = templateAssociado.questions
            .filter(questao => questao.type === 'scale')
            .map(questao => {
                const resposta = submission.responses[questao.id];
                if (!resposta) return null;
                const valorProcessado = Number(resposta.value || resposta);
                return isNaN(valorProcessado) ? null : valorProcessado;
            })
            .filter(valor => valor !== null);

        if (respostasEscala.length === 0) return null;

        const media = respostasEscala.reduce((a, b) => a + b, 0) / respostasEscala.length;
        return media.toFixed(1);
    }
    
    processarResposta(questao, resposta) {
        if (!resposta) return 'Não respondida';
    
        const valor = resposta.value || resposta;
    
        switch(questao.type) {
            case 'scale':
                const valorNumerico = Number(valor);
                if (isNaN(valorNumerico)) return 'Resposta Inválida';
                return `${valorNumerico}/10`;
            
            case 'boolean':
                if (valor === true || valor === 'true') return 'Sim';
                if (valor === false || valor === 'false') return 'Não';
                return valor;
            
            case 'text':
                return valor || 'Resposta em branco';
            
            default:
                return valor;
        }
    }
    
    limparTodosDados() {
        if (confirm('Atenção: Esta ação excluirá permanentemente todos os dados de questionários respondidos. Deseja continuar?')) {
            localStorage.removeItem(MODAL_RESPOSTAS_CONFIG.STORAGE_KEY);
            this.submissions = [];
            return true;
        }
        return false;
    }
}

// ========== RENDERIZADOR DE INTERFACE ==========

class QuestionariosRespondidosRenderer {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.listagem = document.getElementById('questionnairesList');
        this.detalhesContainer = document.getElementById('questionnaireDetail');
        this.resumoResultados = document.getElementById('totalQuestionnaires');
    }
    
    renderizarListagem(pagina = 1) {
        if (!this.listagem) return;

        const submissoesFiltradas = this.dataManager.filtrarSubmissoes();
        const submissoesOrdenadas = this.dataManager.ordenarSubmissoes(submissoesFiltradas);
        
        if (this.resumoResultados) {
            this.resumoResultados.textContent = `${submissoesOrdenadas.length} resultados encontrados`;
        }
        
        if (submissoesOrdenadas.length === 0) {
            this.renderizarMensagemSemResultados();
            return;
        }
        
        const dadosPaginados = this.dataManager.obterSubmissoesPaginadas(
            submissoesOrdenadas, 
            pagina, 
            MODAL_RESPOSTAS_CONFIG.ITEMS_PER_PAGE
        );
        
        this.limparListagem();
        
        dadosPaginados.items.forEach(submission => {
            const elemento = this.criarElementoSubmissao(submission);
            this.listagem.appendChild(elemento);
        });
        
        return dadosPaginados;
    }
    
    limparListagem() {
        if (this.listagem) {
            this.listagem.innerHTML = '';
        }
    }
    
    renderizarMensagemSemResultados() {
        const noResults = document.querySelector('.no-results.template-item');
        if (!noResults || !this.listagem) return;
        
        const mensagem = noResults.cloneNode(true);
        mensagem.classList.remove('template-item');
        mensagem.style.display = 'block';
        
        this.listagem.appendChild(mensagem);
    }
    
    criarElementoSubmissao(submission) {
        const itemTemplate = document.querySelector('.questionnaire-item.template-item');
        if (!itemTemplate) return document.createElement('div');
        
        const itemSubmissao = itemTemplate.cloneNode(true);
        itemSubmissao.classList.remove('template-item');
        itemSubmissao.style.display = 'block';
        
        const respostasInfo = submission.responses || {};
        const identificacao = respostasInfo.identification || {
            name: 'Anônimo',
            position: 'Não identificado'
        };
        const localizacao = respostasInfo.location || {
            municipalityText: 'Não identificado',
            stateText: 'Não identificado'
        };
        
        const dataSubmissao = new Date(submission.submissionDate);
        const dataFormatada = dataSubmissao.toLocaleString('pt-BR', {
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const mediaRespostas = this.dataManager.calcularMediaEscala(submission) || 0;
        
        const dateElement = itemSubmissao.querySelector('.date-text');
        if (dateElement) dateElement.textContent = dataFormatada;
        
        const ratingElement = itemSubmissao.querySelector('.rating-value');
        const ratingContainer = itemSubmissao.querySelector('.rating-star');
        if (ratingElement && ratingContainer) {
            ratingElement.textContent = mediaRespostas > 0 ? mediaRespostas : 'N/A';
            if (mediaRespostas > 0) {
                ratingContainer.classList.add('active');
            }
        }
        
        const municipalityElement = itemSubmissao.querySelector('.municipality-text');
        if (municipalityElement) municipalityElement.textContent = localizacao.municipalityText || 'Não especificado';
        
        const stateElement = itemSubmissao.querySelector('.state-label');
        if (stateElement) stateElement.textContent = localizacao.stateText || '';
        
        const respondentElement = itemSubmissao.querySelector('.respondent-name');
        if (respondentElement) respondentElement.textContent = identificacao.name || 'Anônimo';
        
        const positionElement = itemSubmissao.querySelector('.position-label');
        if (positionElement) positionElement.textContent = identificacao.position || '';
        
        this.configurarEventosItem(itemSubmissao, submission);
        
        return itemSubmissao;
    }
    
    configurarEventosItem(itemSubmissao, submission) {
        const botaoVisualizar = itemSubmissao.querySelector('.view-questionnaire-btn');
        if (botaoVisualizar) {
            botaoVisualizar.addEventListener('click', () => {
                this.renderizarDetalhes(submission);
            });
        }
        
        const botaoPDF = itemSubmissao.querySelector('.download-pdf-btn');
        if (botaoPDF) {
            botaoPDF.addEventListener('click', (e) => {
                e.stopPropagation();
                this.gerarPDFSubmissao(submission);
            });
        }
    }
    
    renderizarDetalhes(submission) {
        if (!this.detalhesContainer) return;
        
        const respostas = submission.responses || {};
        const identificacao = respostas.identification || {
            name: 'Anônimo',
            position: 'Não identificado'
        };
        const localizacao = respostas.location || {
            municipalityText: 'Não identificado',
            stateText: 'Não identificado'
        };

        const templateAssociado = this.dataManager.obterTemplatePorId(submission.templateId) || 
            { name: 'Questionário', questions: [] };

        const dataSubmissao = new Date(submission.submissionDate);
        const dataFormatada = dataSubmissao.toLocaleString('pt-BR', {
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const mediaEscala = this.dataManager.calcularMediaEscala(submission);
        
        this.popularCabecalhoDetalhes(templateAssociado, dataFormatada, identificacao, localizacao, mediaEscala);
        this.popularRespostasDetalhes(templateAssociado, respostas);
        
        this.mostrarDetalhes();
    }
    
    popularCabecalhoDetalhes(template, dataFormatada, identificacao, localizacao, mediaEscala) {
        const submissionHeader = this.detalhesContainer.querySelector('.submission-header');
        if (!submissionHeader) return;
        
        submissionHeader.style.display = 'block';
        
        const titulo = submissionHeader.querySelector('.questionario-titulo');
        if (titulo) titulo.textContent = template.name;
        
        const metadataValues = submissionHeader.querySelectorAll('.metadata-value');
        if (metadataValues[0]) metadataValues[0].textContent = dataFormatada;
        if (metadataValues[1]) {
            metadataValues[1].textContent = `${identificacao.name} ${identificacao.position ? `(${identificacao.position})` : ''}`;
        }
        if (metadataValues[2]) metadataValues[2].textContent = localizacao.municipalityText;
        if (metadataValues[3]) metadataValues[3].textContent = localizacao.stateText || 'Não informado';
        
        if (mediaEscala && metadataValues[4]) {
            metadataValues[4].textContent = `${mediaEscala}/10`;
            metadataValues[4].parentElement.parentElement.style.display = 'block';
        }
    }
    
    popularRespostasDetalhes(template, respostas) {
        const responsesSection = this.detalhesContainer.querySelector('.responses-section');
        if (!responsesSection) return;
        
        responsesSection.style.display = 'block';
        
        const responsesContainer = responsesSection.querySelector('.responses-container');
        if (!responsesContainer) return;
        
        const responseTemplate = responsesContainer.querySelector('.response-item.template-item');
        if (!responseTemplate) return;
        
        const existingResponses = responsesContainer.querySelectorAll('.response-item:not(.template-item)');
        existingResponses.forEach(item => item.remove());
        
        template.questions.forEach(questao => {
            const resposta = respostas[questao.id];
            const valorResposta = this.dataManager.processarResposta(questao, resposta);
            
            const responseItem = responseTemplate.cloneNode(true);
            responseItem.classList.remove('template-item');
            responseItem.style.display = 'block';
            
            if (!resposta) {
                responseItem.classList.add('unanswered');
            }
            
            const questionText = responseItem.querySelector('.question-text');
            if (questionText) questionText.textContent = questao.text;
            
            const answerText = responseItem.querySelector('.answer-text');
            if (answerText) answerText.textContent = valorResposta;
            
            responsesContainer.appendChild(responseItem);
        });
    }
    
    mostrarDetalhes() {
        const listContainer = document.querySelector('.questionnaires-container');
        
        if (listContainer) {
            listContainer.classList.add('hidden');
        }
        
        if (this.detalhesContainer) {
            this.detalhesContainer.classList.remove('hidden');
        }
    }
    
    voltarParaLista() {
        const listContainer = document.querySelector('.questionnaires-container');
        
        if (this.detalhesContainer) {
            this.detalhesContainer.classList.add('hidden');
        }
        
        if (listContainer) {
            listContainer.classList.remove('hidden');
        }
    }
    
    gerarPDFSubmissao(submission) {
        if (!window.questionarioPdfGenerator) {
            console.error('A instância do gerador de PDF não foi encontrada.');
            return;
        }
        
        const questionario = {
            date: submission.submissionDate,
            identification: submission.responses?.identification || { name: 'Anônimo', position: 'Não especificado' },
            location: submission.responses?.location || { municipality: 'Não especificado', state: 'Não especificado' },
            responses: submission.responses || {},
            templateId: submission.templateId
        };
        
        const calculateAverage = (answers, templateId) => {
            const template = this.dataManager.obterTemplatePorId(templateId);
            if (!template) return null;

            const validQuestions = template.questions.filter(q => 
                q.type === 'scale' && 
                q.text.toLowerCase().indexOf('sua opinião') === -1
            );

            const ratings = validQuestions.map(q => {
                const answer = answers[q.id];
                return answer && !isNaN(Number(answer)) ? Number(answer) : null;
            }).filter(rating => rating !== null);

            if (ratings.length === 0) return null;
            return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
        };
        
        try {
            window.questionarioPdfGenerator.gerarPdf(questionario, calculateAverage);
        } catch (error) {
            console.error('Erro ao gerar PDF para submissão:', error);
            alert('Ocorreu um erro ao gerar o PDF. Por favor, tente novamente.');
        }
    }
}

// ========== GERENCIADOR DE FILTROS ==========

class QuestionariosRespondidosFilters {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.setupLocationFilters();
        this.setupEventListeners();
    }
    
    setupLocationFilters() {
        const filterStateSelect = document.getElementById('filterState');
        const filterMunicipalitySelect = document.getElementById('filterMunicipality');

        if (!filterStateSelect || !filterMunicipalitySelect) return;

        filterStateSelect.innerHTML = '<option value="">Todos os Estados</option>';
        filterMunicipalitySelect.innerHTML = '<option value="">Todos os Municípios</option>';

        const uniqueStates = new Set(
            this.dataManager.submissions
                .map(submission => 
                    submission.responses?.location?.stateText || 
                    submission.responses?.location?.state
                )
                .filter(state => state)
        );

        uniqueStates.forEach(state => {
            const option = document.createElement('option');
            option.value = state;
            option.textContent = state;
            filterStateSelect.appendChild(option);
        });

        filterStateSelect.addEventListener('change', () => {
            const selectedState = filterStateSelect.value;
            
            filterMunicipalitySelect.innerHTML = '<option value="">Todos os Municípios</option>';

            if (!selectedState) return;

            const uniqueMunicipalities = new Set(
                this.dataManager.submissions
                    .filter(submission => 
                        submission.responses?.location?.stateText === selectedState || 
                        submission.responses?.location?.state === selectedState
                    )
                    .map(submission => 
                        submission.responses?.location?.municipalityText || 
                        submission.responses?.location?.municipality
                    )
                    .filter(municipality => municipality)
            );

            uniqueMunicipalities.forEach(municipality => {
                const option = document.createElement('option');
                option.value = municipality;
                option.textContent = municipality;
                filterMunicipalitySelect.appendChild(option);
            });
        });
    }
    
    setupEventListeners() {
        const botaoAplicarFiltros = document.getElementById('applyFilters');
        const botaoLimparFiltros = document.getElementById('clearFilters');
        
        if (botaoAplicarFiltros) {
            botaoAplicarFiltros.addEventListener('click', () => this.aplicarFiltros());
        }
        
        if (botaoLimparFiltros) {
            botaoLimparFiltros.addEventListener('click', () => this.limparFiltros());
        }
    }
    
    aplicarFiltros() {
        this.dataManager.filtros.municipio = document.getElementById('filterMunicipality')?.value || '';
        this.dataManager.filtros.estado = document.getElementById('filterState')?.value || '';
        this.dataManager.filtros.dataInicio = document.getElementById('filterDateFrom')?.value || '';
        this.dataManager.filtros.dataFim = document.getElementById('filterDateTo')?.value || '';
        this.dataManager.filtros.identificacao = document.getElementById('filterRespondent')?.value || '';
        
        return true;
    }
    
    limparFiltros() {
        this.dataManager.filtros = {
            municipio: '',
            estado: '',
            dataInicio: '',
            dataFim: '',
            identificacao: ''
        };
        
        const camposFiltro = [
            'filterMunicipality', 
            'filterState', 
            'filterDateFrom', 
            'filterDateTo', 
            'filterRespondent'
        ];
        
        camposFiltro.forEach(id => {
            const campo = document.getElementById(id);
            if (campo) campo.value = '';
        });
        
        return true;
    }
}

// ========== GERENCIADOR PRINCIPAL ==========

class QuestionariosRespondidosManager {
    constructor() {
        this.dataManager = new QuestionariosRespondidosDataManager();
        this.renderer = new QuestionariosRespondidosRenderer(this.dataManager);
        this.filters = new QuestionariosRespondidosFilters(this.dataManager);
        
        this.modal = document.getElementById('respostasModal');
        this.paginaAtual = 1;
        
        this.configurarEventosInterface();
        this.configurarOrdenacao();
        this.configurarPaginacao();
    }
    
    configurarEventosInterface() {
        const botaoFechar = document.getElementById('closeRespostasModal');
        if (botaoFechar) {
            botaoFechar.addEventListener('click', () => this.fecharModal());
        }
        
        const botaoLimparDados = document.getElementById('clearQuestionnaireDataBtn');
        if (botaoLimparDados) {
            botaoLimparDados.addEventListener('click', () => this.limparTodosDados());
        }
        
        const backButton = document.getElementById('backToList');
        if (backButton) {
            backButton.addEventListener('click', () => this.renderer.voltarParaLista());
        }
    }
    
    configurarOrdenacao() {
        const seletorOrdenacao = document.getElementById('sortSelect');
        if (seletorOrdenacao) {
            seletorOrdenacao.addEventListener('change', (e) => {
                this.dataManager.ordenacao = e.target.value;
                this.paginaAtual = 1;
                this.renderizarListagemRespostas();
            });
            
            seletorOrdenacao.innerHTML = '';
            
            const opcoes = [
                { valor: 'data_desc', texto: 'Data (mais recente)' },
                { valor: 'data_asc', texto: 'Data (mais antiga)' }
            ];
            
            opcoes.forEach(opcao => {
                const elementoOpcao = document.createElement('option');
                elementoOpcao.value = opcao.valor;
                elementoOpcao.textContent = opcao.texto;
                seletorOrdenacao.appendChild(elementoOpcao);
            });
            
            seletorOrdenacao.value = 'data_desc';
        }
    }
    
    configurarPaginacao() {
        const botaoAnterior = document.getElementById('prevPage');
        const botaoProximo = document.getElementById('nextPage');
        
        if (botaoAnterior) {
            botaoAnterior.addEventListener('click', () => this.navegarPaginacao('anterior'));
        }
        
        if (botaoProximo) {
            botaoProximo.addEventListener('click', () => this.navegarPaginacao('proximo'));
        }
    }
    
    navegarPaginacao(direcao) {
        const submissoesFiltradas = this.dataManager.filtrarSubmissoes();
        const totalPaginas = Math.ceil(submissoesFiltradas.length / MODAL_RESPOSTAS_CONFIG.ITEMS_PER_PAGE);
        
        if (direcao === 'anterior' && this.paginaAtual > 1) {
            this.paginaAtual--;
        } else if (direcao === 'proximo' && this.paginaAtual < totalPaginas) {
            this.paginaAtual++;
        }
        
        this.renderizarListagemRespostas();
    }
    
    atualizarControlesPaginacao(dadosPaginados) {
        const botaoAnterior = document.getElementById('prevPage');
        const botaoProximo = document.getElementById('nextPage');
        const paginaAtualElement = document.getElementById('paginationInfo');
        
        if (botaoAnterior) {
            botaoAnterior.disabled = this.paginaAtual <= 1;
        }
        
        if (botaoProximo) {
            botaoProximo.disabled = this.paginaAtual >= dadosPaginados.totalPaginas;
        }
        
        if (paginaAtualElement) {
            paginaAtualElement.textContent = `Página ${this.paginaAtual} de ${dadosPaginados.totalPaginas || 1}`;
        }
    }
    
    renderizarListagemRespostas() {
        const dadosPaginados = this.renderer.renderizarListagem(this.paginaAtual);
        if (dadosPaginados) {
            this.atualizarControlesPaginacao(dadosPaginados);
        }
    }
    
    abrirModal() {
        if (this.modal) {
            this.modal.classList.remove('hidden');
            this.dataManager.carregarDados();
            this.filters.setupLocationFilters();
            this.renderizarListagemRespostas();
        }
    }
    
    fecharModal() {
        if (this.modal) {
            this.modal.classList.add('hidden');
        }
    }
    
    aplicarFiltros() {
        if (this.filters.aplicarFiltros()) {
            this.paginaAtual = 1;
            this.renderizarListagemRespostas();
        }
    }
    
    limparFiltros() {
        if (this.filters.limparFiltros()) {
            this.paginaAtual = 1;
            this.renderizarListagemRespostas();
        }
    }
    
    limparTodosDados() {
        if (this.dataManager.limparTodosDados()) {
            this.renderizarListagemRespostas();
            alert('Todos os dados de questionários foram removidos com sucesso.');
        }
    }
}

// ========== INICIALIZAÇÃO ==========

document.addEventListener('DOMContentLoaded', () => {
    window.questionariosManager = new QuestionariosRespondidosManager();
    
    const botaoQuestionarios = document.getElementById('openQuestionariosBtn');
    if (botaoQuestionarios) {
        botaoQuestionarios.addEventListener('click', () => {
            window.questionariosManager.abrirModal();
        });
    }
    
    const botaoAplicarFiltros = document.getElementById('applyFilters');
    if (botaoAplicarFiltros) {
        botaoAplicarFiltros.addEventListener('click', () => {
            window.questionariosManager.aplicarFiltros();
        });
    }
    
    const botaoLimparFiltros = document.getElementById('clearFilters');
    if (botaoLimparFiltros) {
        botaoLimparFiltros.addEventListener('click', () => {
            window.questionariosManager.limparFiltros();
        });
    }
});