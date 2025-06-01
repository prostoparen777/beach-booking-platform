// Main application controller
class BeachBookingApp {
    constructor() {
        this.currentUser = null;
        this.currentBeach = null;
        this.selectedLounger = null;
        this.socket = null;
        
        this.init();
    }
    
    async init() {
        // Check authentication
        await this.checkAuth();
        
        // Initialize socket connection
        this.initSocket();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Request geolocation
        this.requestGeolocation();
        
        // Load initial data
        await this.loadPopularBeaches();
        
        // Load user's bookings if authenticated
        if (this.currentUser) {
            await this.loadUserBookings();
        }
    }
    
    async checkAuth() {
        try {
            const response = await API.getMe();
            if (response.data) {
                this.currentUser = response.data;
                this.updateUserUI();
            }
        } catch (error) {
            console.log('User not authenticated');
        }
    }
    
    initSocket() {
        // Initialize Socket.IO connection
        this.socket = io(API_BASE_URL);
        
        this.socket.on('connect', () => {
            console.log('Connected to server');
        });
        
        this.socket.on('lounger-status-changed', (data) => {
            this.handleLoungerStatusChange(data);
        });
    }
    
    setupEventListeners() {
        // Search functionality
        document.getElementById('beachSearch').addEventListener('input', 
            this.debounce(this.handleSearch.bind(this), 300));
        
        // User menu
        document.getElementById('userMenuBtn').addEventListener('click', 
            this.handleUserMenu.bind(this));
        
        // Location selector
        document.querySelector('.location-selector').addEventListener('click', 
            this.handleLocationSelect.bind(this));
        
        // Back buttons
        document.getElementById('backToBeachesBtn').addEventListener('click', 
            () => this.showSection('welcomeSection'));
        
        document.getElementById('backToBeachBtn').addEventListener('click', 
            () => this.showBeachDetails(this.currentBeach));
        
        // View map button
        document.getElementById('viewMapBtn').addEventListener('click', 
            this.showLoungerMap.bind(this));
        
        // Modal close buttons
        document.getElementById('closeModalBtn').addEventListener('click', 
            () => this.closeModal('bookingModal'));
        
        document.getElementById('modalOverlay').addEventListener('click', 
            () => this.closeModal('bookingModal'));
        
        // Auth modal
        document.getElementById('closeAuthModalBtn').addEventListener('click', 
            () => this.closeModal('authModal'));
        
        document.getElementById('authModalOverlay').addEventListener('click', 
            () => this.closeModal('authModal'));
        
        // Auth tabs
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.handleAuthTab(e));
        });
        
        // Auth forms
        document.getElementById('loginForm').addEventListener('submit', 
            this.handleLogin.bind(this));
        
        document.getElementById('registerForm').addEventListener('submit', 
            this.handleRegister.bind(this));
        
        // Booking form
        document.getElementById('bookingDate').addEventListener('change', 
            this.updateBookingCalculation.bind(this));
        
        document.getElementById('startTime').addEventListener('change', 
            this.updateBookingCalculation.bind(this));
        
        document.getElementById('endTime').addEventListener('change', 
            this.updateBookingCalculation.bind(this));
        
        document.getElementById('confirmBookingBtn').addEventListener('click', 
            this.handleBookingConfirm.bind(this));
        
        // Map filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleMapFilter(e));
        });
    }
    
    // Geolocation
    requestGeolocation() {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                position => {
                    this.userLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    this.loadNearbyBeaches();
                },
                error => {
                    console.log('Geolocation error:', error);
                }
            );
        }
    }
    
    // Data loading
    async loadPopularBeaches() {
        try {
            const response = await API.getBeaches({ limit: 6 });
            this.renderBeachCards(response.data.beaches);
        } catch (error) {
            console.error('Error loading beaches:', error);
            this.showError('Не удалось загрузить пляжи');
        }
    }
    
    async loadNearbyBeaches() {
        if (!this.userLocation) return;
        
        try {
            const response = await API.getNearbyBeaches(
                this.userLocation.lat, 
                this.userLocation.lng, 
                10
            );
            
            if (response.data.beaches.length > 0) {
                document.getElementById('currentLocation').textContent = 
                    `Рядом: ${response.data.beaches[0].name}`;
            }
        } catch (error) {
            console.error('Error loading nearby beaches:', error);
        }
    }
    
    async loadUserBookings() {
        try {
            const response = await API.getMyBookings();
            this.renderBookingHistory(response.data.bookings);
        } catch (error) {
            console.error('Error loading bookings:', error);
        }
    }
    
    // Rendering functions
    renderBeachCards(beaches) {
        const container = document.getElementById('popularBeaches');
        container.innerHTML = beaches.map(beach => `
            <div class="beach-card" onclick="app.showBeachDetails(${beach.id})">
                <div class="beach-card-image">
                    <img src="${beach.image || 'assets/images/beach-default.jpg'}" 
                         alt="${beach.name}">
                    <div class="beach-card-badge">
                        ${beach.available_loungers} свободно
                    </div>
                </div>
                <div class="beach-card-content">
                    <h3>${beach.name}</h3>
                    <div class="beach-card-stats">
                        <span><i class="fas fa-umbrella-beach"></i> ${beach.total_loungers} лежаков</span>
                        <span><i class="fas fa-ruble-sign"></i> от ${beach.min_price}/час</span>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    renderBookingHistory(bookings) {
        const container = document.getElementById('recentBookings');
        
        if (bookings.length === 0) {
            container.innerHTML = `
                <p class="text-center text-secondary">У вас пока нет бронирований</p>
            `;
            return;
        }
        
        container.innerHTML = bookings.slice(0, 3).map(booking => `
            <div class="booking-card">
                <div class="booking-icon">
                    <i class="fas fa-umbrella-beach"></i>
                </div>
                <div class="booking-info">
                    <h4>${booking.beach_name} - Лежак ${booking.lounger_number}</h4>
                    <p>${this.formatBookingDate(booking.start_dt)} • ${booking.total_price} ₽</p>
                </div>
                <div class="booking-status ${booking.status}">
                    ${this.getBookingStatusText(booking.status)}
                </div>
            </div>
        `).join('');
    }
    
    // Beach details
    async showBeachDetails(beachId) {
        try {
            // If beachId is an object (from loadPopularBeaches), extract the id
            if (typeof beachId === 'object') {
                this.currentBeach = beachId;
            } else {
                const response = await API.getBeach(beachId);
                this.currentBeach = response.data;
            }
            
            // Update UI
            document.getElementById('beachName').textContent = this.currentBeach.name;
            document.getElementById('beachAddress').textContent = this.currentBeach.address;
            document.getElementById('totalLoungers').textContent = this.currentBeach.total_loungers || 0;
            document.getElementById('availableLoungers').textContent = this.currentBeach.available_loungers || 0;
            document.getElementById('avgPrice').textContent = this.currentBeach.avg_price || 0;
            
            // Render amenities
            this.renderAmenities(this.currentBeach.amenities);
            
            // Initialize mini map
            this.initBeachPreviewMap();
            
            // Show section
            this.showSection('beachDetailsSection');
            
        } catch (error) {
            console.error('Error loading beach details:', error);
            this.showError('Не удалось загрузить информацию о пляже');
        }
    }
    
    renderAmenities(amenities) {
        const container = document.querySelector('.beach-amenities');
        if (!amenities) {
            container.innerHTML = '';
            return;
        }
        
        const amenityIcons = {
            wifi: { icon: 'fa-wifi', label: 'Wi-Fi' },
            shower: { icon: 'fa-shower', label: 'Душ' },
            parking: { icon: 'fa-parking', label: 'Парковка' },
            cafe: { icon: 'fa-coffee', label: 'Кафе' },
            lifeguard: { icon: 'fa-life-ring', label: 'Спасатель' },
            playground: { icon: 'fa-child', label: 'Детская площадка' }
        };
        
        container.innerHTML = Object.entries(amenities)
            .filter(([key, value]) => value && amenityIcons[key])
            .map(([key]) => `
                <span class="amenity-tag">
                    <i class="fas ${amenityIcons[key].icon}"></i>
                    ${amenityIcons[key].label}
                </span>
            `).join('');
    }
    
    initBeachPreviewMap() {
        // Initialize Leaflet map for beach preview
        const mapContainer = document.getElementById('beachMapPreview');
        mapContainer.innerHTML = ''; // Clear previous map
        
        const map = L.map('beachMapPreview').setView(
            [this.currentBeach.latitude, this.currentBeach.longitude], 
            15
        );
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
        
        L.marker([this.currentBeach.latitude, this.currentBeach.longitude])
            .addTo(map)
            .bindPopup(this.currentBeach.name);
    }
    
    // Lounger map
    async showLoungerMap() {
        if (!this.currentBeach) return;
        
        try {
            // Load loungers
            const response = await API.getBeachLoungers(this.currentBeach.id);
            this.loungers = response.data.loungers;
            
            // Update map header
            document.getElementById('mapBeachName').textContent = this.currentBeach.name;
            
            // Join beach room for real-time updates
            this.socket.emit('join-beach', this.currentBeach.id);
            
            // Render loungers
            this.renderLoungers();
            
            // Show section
            this.showSection('loungerMapSection');
            
        } catch (error) {
            console.error('Error loading loungers:', error);
            this.showError('Не удалось загрузить карту лежаков');
        }
    }
    
    renderLoungers() {
        const mapContainer = document.getElementById('loungerMap');
        mapContainer.innerHTML = '';
        
        // Create zones
        const zones = {
            vip: { label: 'VIP зона', loungers: [] },
            premium: { label: 'Премиум зона', loungers: [] },
            standard: { label: 'Стандарт зона', loungers: [] }
        };
        
        // Group loungers by type
        this.loungers.forEach(lounger => {
            zones[lounger.type].loungers.push(lounger);
        });
        
        // Render each zone
        Object.entries(zones).forEach(([type, zone]) => {
            if (zone.loungers.length === 0) return;
            
            const zoneEl = document.createElement('div');
            zoneEl.className = 'beach-zone';
            zoneEl.style.top = type === 'vip' ? '20px' : type === 'premium' ? '150px' : '280px';
            zoneEl.style.left = '20px';
            zoneEl.style.width = 'calc(100% - 40px)';
            zoneEl.style.height = '120px';
            
            const labelEl = document.createElement('div');
            labelEl.className = 'zone-label';
            labelEl.textContent = zone.label;
            zoneEl.appendChild(labelEl);
            
            // Render loungers in zone
            zone.loungers.forEach(lounger => {
                const loungerEl = this.createLoungerElement(lounger);
                mapContainer.appendChild(loungerEl);
            });
            
            mapContainer.appendChild(zoneEl);
        });
    }
    
    createLoungerElement(lounger) {
        const el = document.createElement('div');
        el.className = `lounger ${lounger.type} ${lounger.is_available ? 'available' : 'occupied'}`;
        el.style.left = `${lounger.x}px`;
        el.style.top = `${lounger.y}px`;
        el.dataset.loungerId = lounger.id;
        
        el.innerHTML = `
            <div class="lounger-number">${lounger.number}</div>
            ${lounger.is_available ? 
                `<div class="lounger-price">${lounger.price_per_hour}₽</div>` :
                `<div class="lounger-time">${this.formatEndTime(lounger.current_booking_end)}</div>`
            }
        `;
        
        if (lounger.is_available) {
            el.addEventListener('click', () => this.selectLounger(lounger));
        }
        
        return el;
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
        
        // Show booking modal
        this.showBookingModal(lounger);
    }
    
    // Booking modal
    showBookingModal(lounger) {
        if (!this.currentUser) {
            this.showAuthModal();
            return;
        }
        
        // Update modal content
        document.getElementById('modalLoungerNumber').textContent = `Лежак ${lounger.number}`;
        document.getElementById('modalLoungerType').textContent = this.getLoungerTypeText(lounger.type);
        document.getElementById('modalLoungerPrice').textContent = lounger.price_per_hour;
        
        // Set default date (today)
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('bookingDate').value = today;
        document.getElementById('bookingDate').min = today;
        
        // Reset times
        document.getElementById('startTime').value = '';
        document.getElementById('endTime').value = '';
        document.getElementById('bookingDuration').textContent = '0 часов';
        document.getElementById('totalPrice').textContent = '0 ₽';
        
        // Show modal
        this.showModal('bookingModal');
    }
    
    updateBookingCalculation() {
        const date = document.getElementById('bookingDate').value;
        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;
        
        if (!date || !startTime || !endTime || !this.selectedLounger) return;
        
        const start = new Date(`${date}T${startTime}`);
        const end = new Date(`${date}T${endTime}`);
        
        if (end <= start) {
            document.getElementById('bookingDuration').textContent = 'Неверное время';
            document.getElementById('totalPrice').textContent = '0 ₽';
            return;
        }
        
        const hours = Math.ceil((end - start) / (1000 * 60 * 60));
        const totalPrice = hours * this.selectedLounger.price_per_hour;
        
        document.getElementById('bookingDuration').textContent = `${hours} ${this.pluralize(hours, 'час', 'часа', 'часов')}`;
        document.getElementById('totalPrice').textContent = `${totalPrice} ₽`;
    }
    
    async handleBookingConfirm() {
        const date = document.getElementById('bookingDate').value;
        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;
        
        if (!date || !startTime || !endTime || !this.selectedLounger) {
            this.showError('Заполните все поля');
            return;
        }
        
        const start = new Date(`${date}T${startTime}`);
        const end = new Date(`${date}T${endTime}`);
        
        if (end <= start) {
            this.showError('Время окончания должно быть позже времени начала');
            return;
        }
        
        try {
            const btn = document.getElementById('confirmBookingBtn');
            btn.disabled = true;
            btn.innerHTML = '<span class="loading"></span> Бронируем...';
            
            const response = await API.createBooking({
                lounger_id: this.selectedLounger.id,
                start_dt: start.toISOString(),
                end_dt: end.toISOString()
            });
            
            // Success
            this.closeModal('bookingModal');
            this.showSuccess('Лежак успешно забронирован!');
            
            // Refresh loungers
            await this.showLoungerMap();
            
            // Refresh bookings
            if (this.currentUser) {
                await this.loadUserBookings();
            }
            
        } catch (error) {
            console.error('Booking error:', error);
            this.showError(error.response?.data?.message || 'Не удалось забронировать лежак');
        } finally {
            const btn = document.getElementById('confirmBookingBtn');
            btn.disabled = false;
            btn.innerHTML = 'Подтвердить бронирование';
        }
    }
    
    // Authentication
    handleUserMenu() {
        if (this.currentUser) {
            // Show user menu
            // TODO: Implement user menu dropdown
            console.log('Show user menu');
        } else {
            this.showAuthModal();
        }
    }
    
    showAuthModal() {
        this.showModal('authModal');
    }
    
    handleAuthTab(e) {
        const tab = e.target.dataset.tab;
        
        // Update tabs
        document.querySelectorAll('.auth-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });
        
        // Update forms
        document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
        document.getElementById('registerForm').classList.toggle('hidden', tab !== 'register');
    }
    
    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        try {
            const response = await API.login({ email, password });
            
            // Store token
            localStorage.setItem('token', response.data.token);
            
            // Update current user
            this.currentUser = response.data.user;
            this.updateUserUI();
            
            // Close modal
            this.closeModal('authModal');
            
            // Reload data
            await this.loadUserBookings();
            
            this.showSuccess('Вы успешно вошли в систему');
            
        } catch (error) {
            console.error('Login error:', error);
            this.showError(error.response?.data?.message || 'Ошибка входа');
        }
    }
    
    async handleRegister(e) {
        e.preventDefault();
        
        const data = {
            full_name: document.getElementById('registerName').value,
            email: document.getElementById('registerEmail').value,
            phone: document.getElementById('registerPhone').value,
            password: document.getElementById('registerPassword').value
        };
        
        try {
            const response = await API.register(data);
            
            // Store token
            localStorage.setItem('token', response.data.token);
            
            // Update current user
            this.currentUser = response.data.user;
            this.updateUserUI();
            
            // Close modal
            this.closeModal('authModal');
            
            this.showSuccess('Регистрация прошла успешно');
            
        } catch (error) {
            console.error('Registration error:', error);
            this.showError(error.response?.data?.message || 'Ошибка регистрации');
        }
    }
    
    updateUserUI() {
        if (this.currentUser) {
            // Update avatar
            const avatar = document.querySelector('.user-avatar');
            if (avatar && this.currentUser.avatar) {
                avatar.src = this.currentUser.avatar;
            }
        }
    }
    
    // Utilities
    showSection(sectionId) {
        document.querySelectorAll('.main-content > section').forEach(section => {
            section.classList.add('hidden');
        });
        document.getElementById(sectionId).classList.remove('hidden');
    }
    
    showModal(modalId) {
        document.getElementById(modalId).classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
    
    closeModal(modalId) {
        document.getElementById(modalId).classList.add('hidden');
        document.body.style.overflow = '';
    }
    
    showError(message) {
        // TODO: Implement toast notifications
        alert(message);
    }
    
    showSuccess(message) {
        // TODO: Implement toast notifications
        alert(message);
    }
    
    handleLoungerStatusChange(data) {
        // Update lounger status in real-time
        const loungerEl = document.querySelector(`[data-lounger-id="${data.loungerId}"]`);
        if (loungerEl) {
            loungerEl.classList.toggle('available', data.isAvailable);
            loungerEl.classList.toggle('occupied', !data.isAvailable);
            
            if (data.isAvailable) {
                loungerEl.innerHTML = `
                    <div class="lounger-number">${data.number}</div>
                    <div class="lounger-price">${data.price}₽</div>
                `;
            } else {
                loungerEl.innerHTML = `
                    <div class="lounger-number">${data.number}</div>
                    <div class="lounger-time">${this.formatEndTime(data.endTime)}</div>
                `;
            }
        }
    }
    
    handleMapFilter(e) {
        const filter = e.target.dataset.filter;
        
        // Update active filter
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        
        // Filter loungers
        document.querySelectorAll('.lounger').forEach(lounger => {
            let show = true;
            
            switch (filter) {
                case 'available':
                    show = lounger.classList.contains('available');
                    break;
                case 'standard':
                case 'premium':
                case 'vip':
                    show = lounger.classList.contains(filter);
                    break;
            }
            
            lounger.style.display = show ? 'flex' : 'none';
        });
    }
    
    handleSearch(e) {
        const query = e.target.value.toLowerCase();
        
        if (query.length < 2) {
            this.loadPopularBeaches();
            return;
        }
        
        // TODO: Implement search API call
        console.log('Searching for:', query);
    }
    
    handleLocationSelect() {
        // TODO: Implement location selection
        console.log('Select location');
    }
    
    // Helper functions
    formatBookingDate(dateStr) {
        const date = new Date(dateStr);
        const options = { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' };
        return date.toLocaleDateString('ru-RU', options);
    }
    
    formatEndTime(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    
    getBookingStatusText(status) {
        const statusMap = {
            pending: 'Ожидает',
            confirmed: 'Подтверждено',
            cancelled: 'Отменено',
            completed: 'Завершено'
        };
        return statusMap[status] || status;
    }
    
    getLoungerTypeText(type) {
        const typeMap = {
            standard: 'Стандарт',
            premium: 'Премиум',
            vip: 'VIP'
        };
        return typeMap[type] || type;
    }
    
    pluralize(number, one, few, many) {
        const mod10 = number % 10;
        const mod100 = number % 100;
        
        if (mod10 === 1 && mod100 !== 11) return one;
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
        return many;
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

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new BeachBookingApp();
});