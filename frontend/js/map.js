// Map functions
console.log('Map module loaded');

// Map functionality will be integrated with app.js
window.MapModule = {
    // Initialize Leaflet map
    initMap(elementId, lat, lng, zoom = 15) {
        const map = L.map(elementId).setView([lat, lng], zoom);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
        
        return map;
    },
    
    // Add marker to map
    addMarker(map, lat, lng, title) {
        return L.marker([lat, lng])
            .addTo(map)
            .bindPopup(title);
    },
    
    // Clear all markers
    clearMarkers(map) {
        map.eachLayer(layer => {
            if (layer instanceof L.Marker) {
                map.removeLayer(layer);
            }
        });
    }
};