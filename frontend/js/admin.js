// Admin Panel Application
class AdminApp {
    constructor() {
        this.currentSection = 'dashboard';
        this.charts = {};
        this.selectedBeachId = null;
        this.selectedLounger = null;
        this.loungerDragData = null;
        
        this.init();
    }
    
    async init() {
        // Check authentication and role
        await this.checkAdminAuth();
        
        // Setup navigation
        this.setupNavigation();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load initial data
        await this.loadDashboard();
    }
    
    async checkAdminAuth() {
        try {
            const response = await API.getMe();
            const user = response.data;
            
            if (!['admin', 'moderator'].includes(user.role)) {
                alert('У вас нет доступа к админ-панели');
                window.location.href = 'index.html';
                return;
            }
            
            this.currentUser = user;
        } catch (error) {
            console.error('Auth error:', error);
            window.location.href = 'index.html';
        }
    }
    
    setupNavigation() {
        document.querySelectorAll('.admin-nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset.section;
                if (section) {
                    this.showSection(section);
                }
            });
        });
    }
    
    setupEventListeners() {
        // Period filter
        document.getElementById('periodFilter').addEventListener('change', (e) => {
            this.loadDashboard(e.target.value);
        });
        
        // Beach search
        document.getElementById('beachSearch').addEventListener('input', 
            this.debounce(() => this.loadBeaches(), 300));
        
        // Beach select for loungers
        document.getElementById('beachSelect').addEventListener('change', (e) => {
            this.selectedBeachId = e.target.value;
            if (this.selectedBeachId) {
                this.loadLoungerEditor(this.selectedBeachId);
            }
        });
        
        // Add beach form
        document.getElementById('addBeachForm').addEventListener('submit', 
            this.handleAddBeach.bind(this));
        
        // Lounger type selector
        document.querySelectorAll('.lounger-type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.lounger-type-btn').forEach(b => 
                    b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
        
        // Lounger actions
        document.getElementById('addLoungerBtn').addEventListener('click', 
            this.addLounger.bind(this));
        
        document.getElementById('saveLoungerLayout').addEventListener('click', 
            this.saveLoungerLayout.bind(this));
        
        document.getElementById('updateLoungerBtn').addEventListener('click', 
            this.updateSelectedLounger.bind(this));
        
        document.getElementById('deleteLoungerBtn').addEventListener('click', 
            this.deleteSelectedLounger.bind(this));
        
        // Booking filters
        document.getElementById('bookingDateFilter').addEventListener('change', 
            () => this.loadBookings());
        
        document.getElementById('bookingStatusFilter').addEventListener('change', 
            () => this.loadBookings());
    }
    
    showSection(section) {
        // Update navigation
        document.querySelectorAll('.admin-nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.section === section);
        });
        
        // Show section
        document.querySelectorAll('.admin-section').forEach(sec => {
            sec.classList.add('hidden');
        });
        document.getElementById(section).classList.remove('hidden');
        
        this.currentSection = section;
        
        // Load section data
        switch (section) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'beaches':
                this.loadBeaches();
                break;
            case 'loungers':
                this.loadBeachesForLoungers();
                break;
            case 'bookings':
                this.loadBookings();
                break;
            case 'users':
                this.loadUsers();
                break;
        }
    }
    
    // Dashboard
    async loadDashboard(period = 'month') {
        try {
            // Load stats
            const stats = await this.loadStats(period);
            this.updateStatsDisplay(stats);
            
            // Load charts
            await this.loadCharts(period);
            
            // Load recent bookings
            await this.loadRecentBookings();
            
        } catch (error) {
            console.error('Error loading dashboard:', error);
        }
    }
    
    async loadStats(period) {
        // TODO: Implement stats endpoint
        // For now, return mock data
        return {
            totalBookings: 245,
            totalRevenue: 184500,
            occupancyRate: 68,
            activeUsers: 89
        };
    }
    
    updateStatsDisplay(stats) {
        document.getElementById('totalBookings').textContent = stats.totalBookings;
        document.getElementById('totalRevenue').textContent = 
            this.formatCurrency(stats.totalRevenue);
        document.getElementById('occupancyRate').textContent = stats.occupancyRate + '%';
        document.getElementById('activeUsers').textContent = stats.activeUsers;
    }
    
    async loadCharts(period) {
        // Bookings chart
        const bookingsCtx = document.getElementById('bookingsChart').getContext('2d');
        
        if (this.charts.bookings) {
            this.charts.bookings.destroy();
        }
        
        this.charts.bookings = new Chart(bookingsCtx, {
            type: 'line',
            data: {
                labels: this.getChartLabels(period),
                datasets: [{
                    label: 'Бронирования',
                    data: [12, 19, 15, 25, 22, 30, 28],
                    borderColor: '#007AFF',
                    backgroundColor: 'rgba(0, 122, 255, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
        
        // Popular hours chart
        const hoursCtx = document.getElementById('popularHoursChart').getContext('2d');
        
        if (this.charts.hours) {
            this.charts.hours.destroy();
        }
        
        this.charts.hours = new Chart(hoursCtx, {
            type: 'bar',
            data: {
                labels: ['8:00', '10:00', '12:00', '14:00', '16:00', '18:00'],
                datasets: [{
                    label: 'Бронирования',
                    data: [5, 12, 18, 22, 15, 8],
                    backgroundColor: '#007AFF'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
    
    getChartLabels(period) {
        switch (period) {
            case 'week':
                return ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
            case 'month':
                return Array.from({length: 30}, (_, i) => i + 1);
            default:
                return [];
        }
    }
    
    async loadRecentBookings() {
        try {
            const response = await API.getAllBookings({ limit: 5 });
            const bookings = response.data.bookings;
            
            const tbody = document.getElementById('recentBookingsTable');
            tbody.innerHTML = bookings.map(booking => `
                <tr>
                    <td>${booking.id}</td>
                    <td>${booking.user_name}</td>
                    <td>${booking.beach_name}</td>
                    <td>${booking.lounger_number}</td>
                    <td>${this.formatDate(booking.start_dt)}</td>
                    <td>
                        <span class="status-badge ${booking.status}">
                            ${this.getStatusText(booking.status)}
                        </span>
                    </td>
                    <td>${this.formatCurrency(booking.total_price)}</td>
                </tr>
            `).join('');
            
        } catch (error) {
            console.error('Error loading recent bookings:', error);
        }
    }
    
    // Beaches management
    async loadBeaches() {
        try {
            const search = document.getElementById('beachSearch').value;
            const response = await API.getBeaches({ search });
            const beaches = response.data.beaches;
            
            const tbody = document.getElementById('beachesTable');
            tbody.innerHTML = beaches.map(beach => `
                <tr>
                    <td>${beach.id}</td>
                    <td>${beach.name}</td>
                    <td>${beach.address}</td>
                    <td>${beach.total_loungers || 0}</td>
                    <td>${beach.available_loungers || 0}</td>
                    <td>${this.formatCurrency(beach.avg_price || 0)}</td>
                    <td>
                        <div class="table-actions">
                            <button class="action-btn" onclick="adminApp.editBeach(${beach.id})">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn" onclick="adminApp.deleteBeach(${beach.id})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
            
        } catch (error) {
            console.error('Error loading beaches:', error);
        }
    }
    
    showAddBeachModal() {
        document.getElementById('addBeachModal').classList.remove('hidden');
    }
    
    closeModal(modalId) {
        document.getElementById(modalId).classList.add('hidden');
    }
    
    async handleAddBeach(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const amenities = {};
        
        // Collect amenities
        ['wifi', 'shower', 'parking', 'cafe', 'lifeguard', 'playground'].forEach(key => {
            amenities[key] = formData.get(key) === 'true';
        });
        
        const beachData = {
            name: formData.get('name'),
            address: formData.get('address'),
            latitude: parseFloat(formData.get('latitude')),
            longitude: parseFloat(formData.get('longitude')),
            description: formData.get('description'),
            amenities
        };
        
        try {
            await API.createBeach(beachData);
            this.closeModal('addBeachModal');
            await this.loadBeaches();
            alert('Пляж успешно добавлен');
        } catch (error) {
            console.error('Error adding beach:', error);
            alert('Ошибка при добавлении пляжа');
        }
    }
    
    async editBeach(id) {
        // TODO: Implement edit beach
        console.log('Edit beach:', id);
    }
    
    async deleteBeach(id) {
        if (!confirm('Вы уверены, что хотите удалить этот пляж?')) {
            return;
        }
        
        try {
            await API.deleteBeach(id);
            await this.loadBeaches();
            alert('Пляж успешно удален');
        } catch (error) {
            console.error('Error deleting beach:', error);
            alert(error.response?.data?.message || 'Ошибка при удалении пляжа');
        }
    }
    
    // Loungers management
    async loadBeachesForLoungers() {
        try {
            const response = await API.getBeaches();
            const beaches = response.data.beaches;
            
            const select = document.getElementById('beachSelect');
            select.innerHTML = '<option value="">Выберите пляж</option>' + 
                beaches.map(beach => 
                    `<option value="${beach.id}">${beach.name}</option>`
                ).join('');
                
        } catch (error) {
            console.error('Error loading beaches:', error);
        }
    }
    
    async loadLoungerEditor(beachId) {
        try {
            const response = await API.getBeachLoungers(beachId);
            this.loungers = response.data.loungers;
            
            document.getElementById('loungerEditor').style.display = 'grid';
            this.renderLoungers();
            this.setupLoungerDragDrop();
            
        } catch (error) {
            console.error('Error loading loungers:', error);
        }
    }
    
    renderLoungers() {
        const canvas = document.getElementById('loungerCanvas');
        canvas.innerHTML = '';
        
        this.loungers.forEach(lounger => {
            const el = document.createElement('div');
            el.className = `lounger ${lounger.type} ${lounger.is_available ? 'available' : 'occupied'}`;
            el.style.left = `${lounger.x}px`;
            el.style.top = `${lounger.y}px`;
            el.dataset.loungerId = lounger.id;
            el.draggable = true;
            
            el.innerHTML = `
                <div class="lounger-number">${lounger.number}</div>
                <div class="lounger-price">${lounger.price_per_hour}₽</div>
            `;
            
            el.addEventListener('click', () => this.selectLounger(lounger));
            
            canvas.appendChild(el);
        });
    }
    
    setupLoungerDragDrop() {
        const canvas = document.getElementById('loungerCanvas');
        
        canvas.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('lounger')) {
                this.loungerDragData = {
                    element: e.target,
                    offsetX: e.offsetX,
                    offsetY: e.offsetY
                };
                e.target.style.opacity = '0.5';
            }
        });
        
        canvas.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('lounger')) {
                e.target.style.opacity = '';
            }
        });
        
        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        
        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            
            if (this.loungerDragData) {
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left - this.loungerDragData.offsetX;
                const y = e.clientY - rect.top - this.loungerDragData.offsetY;
                
                this.loungerDragData.element.style.left = `${x}px`;
                this.loungerDragData.element.style.top = `${y}px`;
                
                // Update lounger data
                const loungerId = parseInt(this.loungerDragData.element.dataset.loungerId);
                const lounger = this.loungers.find(l => l.id === loungerId);
                if (lounger) {
                    lounger.x = x;
                    lounger.y = y;
                }
                
                this.loungerDragData = null;
            }
        });
    }
    
    selectLounger(lounger) {
        // Remove previous selection
        document.querySelectorAll('.lounger.selected').forEach(el => {
            el.classList.remove('selected');
        });
        
        // Select new lounger
        const loungerEl = document.querySelector(`[data-lounger-id="${lounger.id}"]`);
        loungerEl.classList.add('selected');
        
        this.selectedLounger = lounger;
        
        // Show selected lounger info
        document.getElementById('selectedLoungerInfo').style.display = 'block';
        document.getElementById('selectedLoungerNumber').value = lounger.number;
        document.getElementById('selectedLoungerPrice').value = lounger.price_per_hour;
    }
    
    async addLounger() {
        const type = document.querySelector('.lounger-type-btn.active').dataset.type;
        const prices = {
            standard: 150,
            premium: 300,
            vip: 500
        };
        
        // Find next available number
        const existingNumbers = this.loungers.map(l => l.number);
        let nextNumber = 'A1';
        let row = 1;
        let col = 1;
        
        while (existingNumbers.includes(nextNumber)) {
            col++;
            if (col > 10) {
                col = 1;
                row++;
            }
            nextNumber = String.fromCharCode(64 + row) + col;
        }
        
        const newLounger = {
            number: nextNumber,
            row: row,
            col: col,
            x: 50 + (col - 1) * 80,
            y: 50 + (row - 1) * 100,
            type: type,
            price_per_hour: prices[type]
        };
        
        try {
            const response = await API.createLoungers(this.selectedBeachId, {
                loungers: [newLounger]
            });
            
            // Add to local array and re-render
            this.loungers.push(...response.data.loungers);
            this.renderLoungers();
            
        } catch (error) {
            console.error('Error adding lounger:', error);
            alert('Ошибка при добавлении лежака');
        }
    }
    
    async updateSelectedLounger() {
        if (!this.selectedLounger) return;
        
        const number = document.getElementById('selectedLoungerNumber').value;
        const price = parseFloat(document.getElementById('selectedLoungerPrice').value);
        
        try {
            await API.updateLounger(this.selectedLounger.id, {
                number: number,
                price_per_hour: price
            });
            
            // Update local data
            this.selectedLounger.number = number;
            this.selectedLounger.price_per_hour = price;
            
            // Re-render
            this.renderLoungers();
            
            alert('Лежак обновлен');
            
        } catch (error) {
            console.error('Error updating lounger:', error);
            alert('Ошибка при обновлении лежака');
        }
    }
    
    async deleteSelectedLounger() {
        if (!this.selectedLounger) return;
        
        if (!confirm('Вы уверены, что хотите удалить этот лежак?')) {
            return;
        }
        
        try {
            await API.deleteLounger(this.selectedLounger.id);
            
            // Remove from local array
            this.loungers = this.loungers.filter(l => l.id !== this.selectedLounger.id);
            
            // Hide info panel
            document.getElementById('selectedLoungerInfo').style.display = 'none';
            this.selectedLounger = null;
            
            // Re-render
            this.renderLoungers();
            
            alert('Лежак удален');
            
        } catch (error) {
            console.error('Error deleting lounger:', error);
            alert(error.response?.data?.message || 'Ошибка при удалении лежака');
        }
    }
    
    async saveLoungerLayout() {
        const positions = this.loungers.map(lounger => ({
            id: lounger.id,
            x: lounger.x,
            y: lounger.y,
            row: lounger.row,
            col: lounger.col
        }));
        
        try {
            await API.updateLoungersPositions(this.selectedBeachId, { positions });
            alert('Расположение лежаков сохранено');
        } catch (error) {
            console.error('Error saving layout:', error);
            alert('Ошибка при сохранении расположения');
        }
    }
    
    // Bookings management
    async loadBookings() {
        try {
            const params = {};
            
            const dateFilter = document.getElementById('bookingDateFilter').value;
            if (dateFilter) {
                params.date_from = dateFilter;
                params.date_to = dateFilter;
            }
            
            const statusFilter = document.getElementById('bookingStatusFilter').value;
            if (statusFilter) {
                params.status = statusFilter;
            }
            
            const response = await API.getAllBookings(params);
            const bookings = response.data.bookings;
            
            const tbody = document.getElementById('bookingsTable');
            tbody.innerHTML = bookings.map(booking => `
                <tr>
                    <td>${booking.id}</td>
                    <td>${booking.user_name}<br><small>${booking.user_email}</small></td>
                    <td>${booking.beach_name}</td>
                    <td>${booking.lounger_number}</td>
                    <td>${this.formatDateTime(booking.start_dt)}</td>
                    <td>${this.formatDateTime(booking.end_dt)}</td>
                    <td>
                        <span class="status-badge ${booking.status}">
                            ${this.getStatusText(booking.status)}
                        </span>
                    </td>
                    <td>
                        <span class="status-badge ${booking.payment_status}">
                            ${this.getPaymentStatusText(booking.payment_status)}
                        </span>
                    </td>
                    <td>${this.formatCurrency(booking.total_price)}</td>
                    <td>
                        <div class="table-actions">
                            ${booking.status === 'pending' ? `
                                <button class="action-btn" onclick="adminApp.confirmBooking(${booking.id})">
                                    <i class="fas fa-check"></i>
                                </button>
                            ` : ''}
                            ${['pending', 'confirmed'].includes(booking.status) ? `
                                <button class="action-btn" onclick="adminApp.cancelBooking(${booking.id})">
                                    <i class="fas fa-times"></i>
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `).join('');
            
        } catch (error) {
            console.error('Error loading bookings:', error);
        }
    }
    
    async confirmBooking(id) {
        try {
            await API.confirmBooking(id, {});
            await this.loadBookings();
            alert('Бронирование подтверждено');
        } catch (error) {
            console.error('Error confirming booking:', error);
            alert('Ошибка при подтверждении бронирования');
        }
    }
    
    async cancelBooking(id) {
        if (!confirm('Вы уверены, что хотите отменить это бронирование?')) {
            return;
        }
        
        try {
            await API.cancelBooking(id);
            await this.loadBookings();
            alert('Бронирование отменено');
        } catch (error) {
            console.error('Error cancelling booking:', error);
            alert(error.response?.data?.message || 'Ошибка при отмене бронирования');
        }
    }
    
    // Users management
    async loadUsers() {
        // TODO: Implement users management
        console.log('Load users');
    }
    
    // Helper functions
    formatCurrency(amount) {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: 0
        }).format(amount);
    }
    
    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('ru-RU');
    }
    
    formatDateTime(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    getStatusText(status) {
        const statusMap = {
            pending: 'Ожидает',
            confirmed: 'Подтверждено',
            cancelled: 'Отменено',
            completed: 'Завершено'
        };
        return statusMap[status] || status;
    }
    
    getPaymentStatusText(status) {
        const statusMap = {
            pending: 'Ожидает',
            paid: 'Оплачено',
            refunded: 'Возврат'
        };
        return statusMap[status] || status;
    }
    
    debounce(func, wait) {
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
}

// Initialize admin app
document.addEventListener('DOMContentLoaded', () => {
    window.adminApp = new AdminApp();
});