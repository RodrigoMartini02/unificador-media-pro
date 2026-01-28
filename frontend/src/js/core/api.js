/**
 * Cliente API centralizado
 * Gerencia todas as requisições HTTP para o backend
 */
class ApiClient {
    constructor() {
        this.baseUrl = window.API_BASE_URL || '/api';
    }

    getToken() {
        return localStorage.getItem('auth_token');
    }

    async request(endpoint, options = {}) {
        const token = this.getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
            ...options.headers
        };

        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                ...options,
                headers
            });

            // Token expirado ou inválido
            if (response.status === 401) {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user');
                window.location.href = '/quest.html?login=true';
                return null;
            }

            const data = await response.json();

            if (!response.ok) {
                throw { status: response.status, ...data };
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // GET request
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url, { method: 'GET' });
    }

    // POST request
    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // PUT request
    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // PATCH request
    async patch(endpoint, data) {
        return this.request(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }

    // DELETE request
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
}

// Instância global do cliente API
const api = new ApiClient();

// ==================== AUTH API ====================
const AuthAPI = {
    async login(email, password) {
        return api.post('/auth/login', { email, password });
    },

    async getProfile() {
        return api.get('/auth/me');
    },

    async changePassword(currentPassword, newPassword) {
        return api.put('/auth/change-password', { currentPassword, newPassword });
    }
};

// ==================== LOCATIONS API ====================
const LocationsAPI = {
    async getAll() {
        return api.get('/locations');
    },

    async getStates() {
        return api.get('/locations/states');
    },

    async getMunicipalities(state) {
        return api.get(`/locations/states/${encodeURIComponent(state)}/municipalities`);
    },

    async create(state, municipality) {
        return api.post('/locations', { state, municipality });
    },

    async delete(id) {
        return api.delete(`/locations/${id}`);
    },

    // Endpoints públicos
    async getPublicLocations() {
        return api.get('/public/locations');
    },

    async getPublicStates() {
        return api.get('/public/locations/states');
    },

    async getPublicMunicipalities(state) {
        return api.get(`/public/locations/states/${encodeURIComponent(state)}/municipalities`);
    }
};

// ==================== QUESTIONNAIRES API ====================
const QuestionnairesAPI = {
    async getAll(activeOnly = false) {
        return api.get('/questionnaires', { active: activeOnly });
    },

    async getById(id) {
        return api.get(`/questionnaires/${id}`);
    },

    async create(data) {
        return api.post('/questionnaires', data);
    },

    async update(id, data) {
        return api.put(`/questionnaires/${id}`, data);
    },

    async toggleActive(id) {
        return api.patch(`/questionnaires/${id}/toggle`);
    },

    async delete(id) {
        return api.delete(`/questionnaires/${id}`);
    },

    async addQuestion(questionnaireId, question) {
        return api.post(`/questionnaires/${questionnaireId}/questions`, question);
    },

    async updateQuestion(questionnaireId, questionId, data) {
        return api.put(`/questionnaires/${questionnaireId}/questions/${questionId}`, data);
    },

    async deleteQuestion(questionnaireId, questionId) {
        return api.delete(`/questionnaires/${questionnaireId}/questions/${questionId}`);
    },

    async reorderQuestions(questionnaireId, orderedIds) {
        return api.put(`/questionnaires/${questionnaireId}/questions/reorder`, { orderedIds });
    },

    // Endpoint público
    async getPublicQuestionnaire(locationId) {
        return api.get(`/public/questionnaire/${locationId}`);
    },

    async getPublicQuestionnaireById(id) {
        return api.get(`/public/questionnaire-by-id/${id}`);
    }
};

// ==================== RESPONSES API ====================
const ResponsesAPI = {
    async getAll(filters = {}) {
        return api.get('/responses', filters);
    },

    async getById(id) {
        return api.get(`/responses/${id}`);
    },

    async delete(id) {
        return api.delete(`/responses/${id}`);
    },

    async bulkDelete(ids) {
        return api.post('/responses/bulk-delete', { ids });
    },

    // Endpoint público para submeter resposta
    async submit(data) {
        return api.post('/public/submit', data);
    }
};

// ==================== ANALYTICS API ====================
const AnalyticsAPI = {
    async getOverview(filters = {}) {
        return api.get('/analytics/overview', filters);
    },

    async getSatisfaction(filters = {}) {
        return api.get('/analytics/satisfaction', filters);
    },

    async getTrends(filters = {}, period = '30d') {
        return api.get('/analytics/trends', { ...filters, period });
    },

    async getLocationComparison(filters = {}) {
        return api.get('/analytics/locations', filters);
    },

    async getQuestionAnalysis(questionId, filters = {}) {
        return api.get(`/analytics/questions/${questionId}`, filters);
    },

    async getQuestionnaireAnalysis(questionnaireId, filters = {}) {
        return api.get(`/analytics/questionnaire/${questionnaireId}`, filters);
    }
};

// ==================== EXPORT API ====================
const ExportAPI = {
    getCSVUrl(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        const token = localStorage.getItem('auth_token');
        return `${api.baseUrl}/export/csv?${params}&token=${token}`;
    },

    getJSONUrl(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        const token = localStorage.getItem('auth_token');
        return `${api.baseUrl}/export/json?${params}&token=${token}`;
    },

    getPDFUrl(responseId) {
        const token = localStorage.getItem('auth_token');
        return `${api.baseUrl}/export/pdf/${responseId}?token=${token}`;
    }
};

// Exportar para uso global
window.api = api;
window.AuthAPI = AuthAPI;
window.LocationsAPI = LocationsAPI;
window.QuestionnairesAPI = QuestionnairesAPI;
window.ResponsesAPI = ResponsesAPI;
window.AnalyticsAPI = AnalyticsAPI;
window.ExportAPI = ExportAPI;
