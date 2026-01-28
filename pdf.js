// ========== PDF ==========

const PDF_CONFIG = {
    STORAGE_KEY: 'questionnaireSubmissions',
    TEMPLATES_KEY: 'questionarioTemplates',
    BATCH_DELAY: 500
};

// ========== GERENCIADOR DE DEPENDÊNCIAS ==========

class PDFDependencyManager {
    constructor() {
        this.jsPDFLoaded = false;
        this.html2pdfLoaded = false;
    }
    
    async loadDependencies() {
        try {
            await this.loadJsPDF();
            await this.loadHtml2PDF();
            return true;
        } catch (error) {
            console.error('Erro ao carregar dependências:', error);
            return false;
        }
    }
    
    loadJsPDF() {
        return new Promise((resolve, reject) => {
            if (typeof window.jspdf !== 'undefined' || this.jsPDFLoaded) {
                this.jsPDFLoaded = true;
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = () => {
                this.jsPDFLoaded = true;
                resolve();
            };
            script.onerror = () => reject(new Error('Falha ao carregar jsPDF'));
            document.head.appendChild(script);
        });
    }
    
    loadHtml2PDF() {
        return new Promise((resolve, reject) => {
            if (typeof html2pdf !== 'undefined' || this.html2pdfLoaded) {
                this.html2pdfLoaded = true;
                resolve();
                return;
            }
            
            if (document.querySelector('script[src*="html2pdf"]')) {
                this.html2pdfLoaded = true;
                resolve();
                return;
            }
            
            setTimeout(() => {
                if (typeof html2pdf !== 'undefined') {
                    this.html2pdfLoaded = true;
                    resolve();
                } else {
                    reject(new Error('html2pdf não disponível'));
                }
            }, 1000);
        });
    }
    
    isDependenciesLoaded() {
        return this.jsPDFLoaded && this.html2pdfLoaded;
    }
}

// ========== PROCESSADOR DE DADOS ==========

class PDFDataProcessor {
    constructor() {
        this.submissions = [];
        this.templates = [];
        this.loadData();
    }
    
    loadData() {
        try {
            const submissionsData = localStorage.getItem(PDF_CONFIG.STORAGE_KEY);
            this.submissions = submissionsData ? JSON.parse(submissionsData) : [];
            
            const templatesData = localStorage.getItem(PDF_CONFIG.TEMPLATES_KEY);
            this.templates = templatesData ? JSON.parse(templatesData) : [];
        } catch (error) {
            console.error('Erro ao carregar dados para PDF:', error);
            this.submissions = [];
            this.templates = [];
        }
    }
    
    getTemplateById(templateId) {
        return this.templates.find(t => t.id === templateId);
    }
    
    processQuestionnaireData(questionario) {
        const template = this.getTemplateById(questionario.templateId);
        
        if (!template) {
            console.warn('Template não encontrado:', questionario.templateId);
            return null;
        }
        
        const identification = questionario.identification || { name: 'Anônimo', position: 'Não especificado' };
        const location = questionario.location || { municipality: 'Não especificado', state: 'Não especificado' };
        
        const processedData = {
            id: questionario.submissionId || questionario.id,
            templateName: template.name,
            date: questionario.date,
            respondent: {
                name: identification.name,
                position: identification.position
            },
            location: {
                municipality: location.municipalityText || location.municipality,
                state: location.stateText || location.state
            },
            responses: this.processResponses(template, questionario.responses),
            template: template
        };
        
        return processedData;
    }
    
    processResponses(template, responses) {
        if (!template.questions || !responses) return [];
        
        return template.questions.map(question => {
            const response = responses[question.id];
            
            return {
                question: question.text,
                type: question.type,
                answer: this.formatAnswer(question, response),
                rawValue: response
            };
        });
    }
    
    formatAnswer(question, response) {
        if (!response) return 'Não respondida';
        
        const value = typeof response === 'object' ? response.value : response;
        
        switch (question.type) {
            case 'scale':
                const numValue = Number(value);
                return isNaN(numValue) ? 'Resposta inválida' : `${numValue}/10`;
                
            case 'boolean':
                if (value === true || value === 'true') return 'Sim';
                if (value === false || value === 'false') return 'Não';
                return String(value);
                
            case 'text':
                return value || 'Resposta em branco';
                
            case 'multiple':
                if (Array.isArray(value)) return value.join(', ');
                return String(value);
                
            default:
                return String(value);
        }
    }
    
    calculateAverageScore(responses, calculateAverageFunction) {
        if (typeof calculateAverageFunction === 'function') {
            try {
                const answersObject = {};
                responses.forEach((resp, index) => {
                    if (resp.type === 'scale' && resp.rawValue) {
                        answersObject[`q${index + 1}`] = resp.rawValue.value || resp.rawValue;
                    }
                });
                
                return calculateAverageFunction(answersObject, responses[0]?.templateId);
            } catch (error) {
                console.error('Erro ao calcular média:', error);
            }
        }
        
        const scaleResponses = responses.filter(r => r.type === 'scale' && r.rawValue);
        if (scaleResponses.length === 0) return null;
        
        const sum = scaleResponses.reduce((acc, resp) => {
            const value = Number(resp.rawValue.value || resp.rawValue);
            return acc + (isNaN(value) ? 0 : value);
        }, 0);
        
        return sum / scaleResponses.length;
    }
}

// ========== GERADOR DE PDF ==========

class QuestionarioPdfGenerator {
    constructor() {
        this.dependencyManager = new PDFDependencyManager();
        this.dataProcessor = new PDFDataProcessor();
    }
    
    async loadDependencies() {
        return await this.dependencyManager.loadDependencies();
    }
    
    async gerarPdf(questionario, calculateAverageFunction) {
        try {
            if (!this.dependencyManager.isDependenciesLoaded()) {
                await this.loadDependencies();
            }
            
            if (typeof html2pdf === 'undefined') {
                throw new Error('Biblioteca html2pdf não está disponível');
            }
            
            const processedData = this.dataProcessor.processQuestionnaireData(questionario);
            if (!processedData) {
                throw new Error('Erro ao processar dados do questionário');
            }
            
            const averageScore = this.dataProcessor.calculateAverageScore(processedData.responses, calculateAverageFunction);
            
            const element = this.createPDFElement(processedData, averageScore);
            const filename = this.generateFilename(processedData);
            
            const options = {
                margin: 10,
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            
            await html2pdf().from(element).set(options).save();
            
            document.body.removeChild(element);
            
            return { success: true, filename: filename };
            
        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            throw error;
        }
    }
    
    async gerarPDFsEmLote(questionarios, calculateAverageFunction, combinarTodos = false) {
        try {
            if (!this.dependencyManager.isDependenciesLoaded()) {
                await this.loadDependencies();
            }
            
            if (typeof html2pdf === 'undefined') {
                throw new Error('Biblioteca html2pdf não está disponível');
            }
            
            if (combinarTodos) {
                return await this.gerarPDFCombinado(questionarios, calculateAverageFunction);
            } else {
                return await this.gerarPDFsIndividuais(questionarios, calculateAverageFunction);
            }
            
        } catch (error) {
            console.error('Erro ao gerar PDFs em lote:', error);
            throw error;
        }
    }
    
    async gerarPDFCombinado(questionarios, calculateAverageFunction) {
        const elements = [];
        
        for (const questionario of questionarios) {
            const processedData = this.dataProcessor.processQuestionnaireData(questionario);
            if (processedData) {
                const averageScore = this.dataProcessor.calculateAverageScore(processedData.responses, calculateAverageFunction);
                const element = this.createPDFElement(processedData, averageScore);
                elements.push(element);
            }
        }
        
        if (elements.length === 0) {
            throw new Error('Nenhum questionário válido para processar');
        }
        
        const combinedElement = document.createElement('div');
        elements.forEach((el, index) => {
            if (index > 0) {
                const pageBreak = document.createElement('div');
                pageBreak.style.pageBreakBefore = 'always';
                combinedElement.appendChild(pageBreak);
            }
            combinedElement.appendChild(el);
        });
        
        document.body.appendChild(combinedElement);
        
        const filename = `questionarios_${new Date().toISOString().split('T')[0]}.pdf`;
        
        const options = {
            margin: 10,
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        await html2pdf().from(combinedElement).set(options).save();
        
        document.body.removeChild(combinedElement);
        
        return { success: true, filename: filename, count: elements.length };
    }
    
    async gerarPDFsIndividuais(questionarios, calculateAverageFunction) {
        const results = [];
        
        for (let i = 0; i < questionarios.length; i++) {
            try {
                const result = await this.gerarPdf(questionarios[i], calculateAverageFunction);
                results.push(result);
                
                if (i < questionarios.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, PDF_CONFIG.BATCH_DELAY));
                }
            } catch (error) {
                console.error(`Erro ao gerar PDF ${i + 1}:`, error);
                results.push({ success: false, error: error.message });
            }
        }
        
        return { success: true, results: results, count: results.length };
    }
    
    createPDFElement(processedData, averageScore) {
        const element = document.createElement('div');
        element.className = 'pdf-content';
        
        const date = new Date(processedData.date);
        const formattedDate = date.toLocaleDateString('pt-BR');
        const formattedTime = date.toLocaleTimeString('pt-BR');
        
        element.innerHTML = `
            <div class="pdf-header">
                <h1>${processedData.templateName}</h1>
                <p>Relatório de Questionário</p>
            </div>
            
            <div class="pdf-info">
                <div class="info-row">
                    <strong>Data:</strong> ${formattedDate} às ${formattedTime}
                </div>
                <div class="info-row">
                    <strong>Respondente:</strong> ${processedData.respondent.name}
                </div>
                <div class="info-row">
                    <strong>Cargo:</strong> ${processedData.respondent.position}
                </div>
                <div class="info-row">
                    <strong>Local:</strong> ${processedData.location.municipality}, ${processedData.location.state}
                </div>
                ${averageScore ? `<div class="info-row"><strong>Nota Média:</strong> ${averageScore.toFixed(1)}/10</div>` : ''}
            </div>
            
            <div class="pdf-responses">
                <h2>Respostas</h2>
                ${processedData.responses.map((resp, index) => `
                    <div class="response-item">
                        <div class="question">${index + 1}. ${resp.question}</div>
                        <div class="answer">${resp.answer}</div>
                    </div>
                `).join('')}
            </div>
        `;
        
        document.body.appendChild(element);
        return element;
    }
    
    generateFilename(processedData) {
        const date = new Date(processedData.date);
        const dateStr = date.toISOString().split('T')[0];
        const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
        const respondentName = processedData.respondent.name.replace(/[^a-zA-Z0-9]/g, '_');
        
        return `questionario_${respondentName}_${dateStr}_${timeStr}.pdf`;
    }
}

// ========== INICIALIZAÇÃO ==========

document.addEventListener('DOMContentLoaded', () => {
    window.questionarioPdfGenerator = new QuestionarioPdfGenerator();
});