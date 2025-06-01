// API configuration
const API_BASE_URL = 'http://localhost:5000';

// Axios instance
const axiosInstance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request interceptor to add auth token
axiosInstance.interceptors.request.use(
    config => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    error => {
        return Promise.reject(error);
    }
);

// Response interceptor to handle errors
axiosInstance.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401) {
            // Unauthorized - clear token and redirect to login
            localStorage.removeItem('token');
            if (window.app) {
                window.app.currentUser = null;
                window.app.updateUserUI();
            }
        }
        return Promise.reject(error);
    }
);

// API methods
const API = {
    // Authentication
    register: (data) => axiosInstance.post('/api/auth/register', data),
    login: (data) => axiosInstance.post('/api/auth/login', data),
    logout: () => axiosInstance.post('/api/auth/logout'),
    getMe: () => axiosInstance.get('/api/auth/me'),
    refreshToken: () => axiosInstance.post('/api/auth/refresh-token'),
    
    // Beaches
    getBeaches: (params = {}) => axiosInstance.get('/api/beaches', { params }),
    getNearbyBeaches: (lat, lng, radius = 10) => 
        axiosInstance.get('/api/beaches/nearby', { 
            params: { lat, lng, radius } 
        }),
    getBeach: (id) => axiosInstance.get(`/api/beaches/${id}`),
    createBeach: (data) => axiosInstance.post('/api/beaches', data),
    updateBeach: (id, data) => axiosInstance.put(`/api/beaches/${id}`, data),
    deleteBeach: (id) => axiosInstance.delete(`/api/beaches/${id}`),
    
    // Loungers
    getBeachLoungers: (beachId, params = {}) => 
        axiosInstance.get(`/api/beaches/${beachId}/loungers`, { params }),
    createLounger: (beachId, data) => 
        axiosInstance.post(`/api/beaches/${beachId}/loungers`, data),
    updateLounger: (id, data) => axiosInstance.put(`/api/loungers/${id}`, data),
    deleteLounger: (id) => axiosInstance.delete(`/api/loungers/${id}`),
    getLoungerAvailability: (id, date) => 
        axiosInstance.get(`/api/loungers/${id}/availability`, { 
            params: { date } 
        }),
    
    // Bookings
    getMyBookings: (params = {}) => 
        axiosInstance.get('/api/bookings/my', { params }),
    createBooking: (data) => axiosInstance.post('/api/bookings', data),
    getBooking: (id) => axiosInstance.get(`/api/bookings/${id}`),
    cancelBooking: (id) => axiosInstance.put(`/api/bookings/${id}/cancel`),
    
    // Admin
    getAllBookings: (params = {}) => 
        axiosInstance.get('/api/admin/bookings', { params }),
    getStats: (params = {}) => 
        axiosInstance.get('/api/admin/stats', { params }),
    
    // Upload
    uploadImage: (file) => {
        const formData = new FormData();
        formData.append('image', file);
        return axiosInstance.post('/api/upload/image', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
    }
};

// Export for use in other files
window.API = API;
window.API_BASE_URL = API_BASE_URL;