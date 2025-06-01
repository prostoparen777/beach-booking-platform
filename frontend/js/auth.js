// Authentication functions
console.log('Auth module loaded');

// These functions will be used by app.js
window.AuthModule = {
    // Login functionality
    async login(email, password) {
        try {
            const response = await API.login({ email, password });
            localStorage.setItem('token', response.data.token);
            return response.data;
        } catch (error) {
            throw error;
        }
    },
    
    // Register functionality
    async register(data) {
        try {
            const response = await API.register(data);
            localStorage.setItem('token', response.data.token);
            return response.data;
        } catch (error) {
            throw error;
        }
    },
    
    // Logout
    logout() {
        localStorage.removeItem('token');
        window.location.reload();
    },
    
    // Get current user
    async getCurrentUser() {
        try {
            const response = await API.getMe();
            return response.data;
        } catch (error) {
            return null;
        }
    }
};