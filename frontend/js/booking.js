// Booking functions
console.log('Booking module loaded');

// Booking functionality
window.BookingModule = {
    // Create booking
    async createBooking(loungerId, startDate, endDate) {
        try {
            const response = await API.createBooking({
                lounger_id: loungerId,
                start_dt: startDate,
                end_dt: endDate
            });
            return response.data;
        } catch (error) {
            throw error;
        }
    },
    
    // Get user bookings
    async getUserBookings() {
        try {
            const response = await API.getMyBookings();
            return response.data.bookings;
        } catch (error) {
            return [];
        }
    },
    
    // Cancel booking
    async cancelBooking(bookingId) {
        try {
            const response = await API.cancelBooking(bookingId);
            return response.data;
        } catch (error) {
            throw error;
        }
    },
    
    // Calculate booking price
    calculatePrice(pricePerHour, startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const hours = Math.ceil((end - start) / (1000 * 60 * 60));
        return hours * pricePerHour;
    }
};