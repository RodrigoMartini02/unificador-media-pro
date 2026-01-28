/**
 * LocationManager - Gerenciador de Localizações (Admin)
 * CRUD de estados e municípios
 */
class LocationManager {
    constructor() {
        this.locations = [];
        this.groupedLocations = {};
    }

    async init() {
        if (!AuthManager.checkAuth()) return;

        await this.loadLocations();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Form de adicionar localização
        const form = document.getElementById('location-form');
        if (form) {
            form.addEventListener('submit', (e) => this.handleSubmit(e));
        }
    }

    async loadLocations() {
        try {
            this.locations = await LocationsAPI.getAll();
            this.groupLocations();
            this.renderLocationsList();
        } catch (error) {
            console.error('Error loading locations:', error);
        }
    }

    groupLocations() {
        this.groupedLocations = {};
        this.locations.forEach(loc => {
            if (!this.groupedLocations[loc.state]) {
                this.groupedLocations[loc.state] = [];
            }
            this.groupedLocations[loc.state].push(loc);
        });
    }

    renderLocationsList() {
        const container = document.getElementById('locations-list');
        if (!container) return;

        const states = Object.keys(this.groupedLocations).sort();

        if (states.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-map-marker-alt"></i>
                    <p>Nenhuma localização cadastrada.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = states.map(state => `
            <div class="state-group">
                <div class="state-header" onclick="locationManager.toggleState('${state}')">
                    <i class="fas fa-chevron-right state-arrow" id="arrow-${this.slugify(state)}"></i>
                    <h3>${state}</h3>
                    <span class="municipality-count">${this.groupedLocations[state].length} município(s)</span>
                </div>
                <div class="municipalities-list hidden" id="municipalities-${this.slugify(state)}">
                    ${this.groupedLocations[state].map(loc => `
                        <div class="municipality-item">
                            <span>${loc.municipality}</span>
                            <button class="btn btn-sm btn-danger" onclick="locationManager.deleteLocation(${loc.id})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }

    slugify(text) {
        return text.toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
    }

    toggleState(state) {
        const slug = this.slugify(state);
        const list = document.getElementById(`municipalities-${slug}`);
        const arrow = document.getElementById(`arrow-${slug}`);

        if (list) {
            list.classList.toggle('hidden');
            arrow?.classList.toggle('rotated');
        }
    }

    async handleSubmit(e) {
        e.preventDefault();

        const state = document.getElementById('new-state').value.trim();
        const municipality = document.getElementById('new-municipality').value.trim();

        if (!state || !municipality) {
            Swal.fire('Atenção', 'Preencha o estado e o município', 'warning');
            return;
        }

        try {
            await LocationsAPI.create(state, municipality);
            await this.loadLocations();

            // Limpar formulário
            document.getElementById('new-state').value = '';
            document.getElementById('new-municipality').value = '';

            Swal.fire('Sucesso', 'Localização adicionada com sucesso!', 'success');
        } catch (error) {
            console.error('Error creating location:', error);
            if (error.error === 'Duplicate entry') {
                Swal.fire('Atenção', 'Esta localização já existe', 'warning');
            } else {
                Swal.fire('Erro', 'Erro ao adicionar localização', 'error');
            }
        }
    }

    async deleteLocation(id) {
        const result = await Swal.fire({
            title: 'Excluir localização?',
            text: 'Respostas existentes desta localização serão mantidas.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonText: 'Cancelar',
            confirmButtonText: 'Excluir'
        });

        if (result.isConfirmed) {
            try {
                await LocationsAPI.delete(id);
                await this.loadLocations();
                Swal.fire('Excluída!', 'Localização excluída com sucesso.', 'success');
            } catch (error) {
                console.error('Error deleting location:', error);
                Swal.fire('Erro', 'Erro ao excluir localização', 'error');
            }
        }
    }
}

// Instância global
window.locationManager = new LocationManager();
