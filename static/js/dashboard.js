// API Base URL
const API_BASE = '/api';

// Utility function to fetch data
async function fetchData(endpoint) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}

// Load building status
async function loadBuildingStatus() {
    const data = await fetchData('/energy/realtime');
    if (!data || !data.data) return;
    
    const buildingList = document.getElementById('buildingList');
    if (!buildingList) return;
    
    buildingList.innerHTML = data.data.map(building => `
        <div class="building-item">
            <div class="building-info">
                <h4>${building.name}</h4>
                <p>${building.consumption} kWh • ${building.occupancy}% occupied</p>
            </div>
            <div class="building-status">
                <span class="status-badge ${building.status}">${building.status.toUpperCase()}</span>
                ${building.alerts > 0 ? `<small>${building.alerts} alerts</small>` : ''}
            </div>
        </div>
    `).join('');
}

// Load alerts
async function loadAlerts() {
    const data = await fetchData('/alerts');
    if (!data || !data.data) return;
    
    const alertsList = document.getElementById('alertsList');
    if (!alertsList) return;
    
    alertsList.innerHTML = data.data.map(alert => `
        <div class="alert-item ${alert.type}">
            <div class="alert-icon">
                ${alert.type === 'warning' ? '<i class="fas fa-exclamation-triangle"></i>' : 
                  alert.type === 'critical' ? '<i class="fas fa-exclamation-circle"></i>' :
                  '<i class="fas fa-info-circle"></i>'}
            </div>
            <div class="alert-content">
                <p>${alert.message}</p>
                <span class="alert-time">${alert.time}</span>
            </div>
        </div>
    `).join('');
}

// Load leaderboard
async function loadLeaderboard() {
    const data = await fetchData('/leaderboard');
    if (!data || !data.data) return;
    
    const leaderboardList = document.getElementById('leaderboardList');
    if (!leaderboardList) return;
    
    leaderboardList.innerHTML = data.data.map((item, index) => {
        let badgeClass = 'regular';
        if (index === 0) badgeClass = 'gold';
        else if (index === 1) badgeClass = 'silver';
        else if (index === 2) badgeClass = 'bronze';
        
        return `
            <div class="leaderboard-item">
                <div class="rank-badge ${badgeClass}">${item.rank}</div>
                <div class="leaderboard-info">
                    <h4>${item.name}</h4>
                    <p>${item.points} points • ${item.savings} energy saved</p>
                </div>
            </div>
        `;
    }).join('');
}

// Auto-refresh data
function startAutoRefresh() {
    setInterval(() => {
        loadBuildingStatus();
        loadAlerts();
        loadLeaderboard();
    }, 30000); // Refresh every 30 seconds
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    loadBuildingStatus();
    loadAlerts();
    loadLeaderboard();
    startAutoRefresh();
});

// Handle period selector change
const periodSelector = document.querySelector('.period-selector');
if (periodSelector) {
    periodSelector.addEventListener('change', (e) => {
        const days = e.target.value;
        updateEnergyChart(days);
    });
}

// Update energy chart based on period
async function updateEnergyChart(days) {
    const data = await fetchData(`/energy/trends?days=${days}`);
    if (!data || !data.data) return;
    
    // Update chart (implementation in charts.js)
    if (window.updateChartData) {
        window.updateChartData(data.data);
    }
}