// Energy Consumption Chart
const energyChartCanvas = document.getElementById('energyChart');
let energyChartInstance = null;

if (energyChartCanvas) {
    const ctx = energyChartCanvas.getContext('2d');
    
    energyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Consumption (kWh)',
                    data: [],
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Savings (kWh)',
                    data: [],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value + ' kWh';
                        }
                    }
                }
            }
        }
    });
    
    // Load initial data
    loadEnergyChartData();
}

// Load energy chart data
async function loadEnergyChartData() {
    const response = await fetch('/api/energy/trends?days=7');
    const result = await response.json();
    
    if (result.status === 'success' && energyChartInstance) {
        const labels = result.data.map(d => d.date);
        const consumption = result.data.map(d => d.consumption);
        const savings = result.data.map(d => d.savings);
        
        energyChartInstance.data.labels = labels;
        energyChartInstance.data.datasets[0].data = consumption;
        energyChartInstance.data.datasets[1].data = savings;
        energyChartInstance.update();
    }
}

// Update chart data function
window.updateChartData = function(data) {
    if (!energyChartInstance) return;
    
    const labels = data.map(d => d.date);
    const consumption = data.map(d => d.consumption);
    const savings = data.map(d => d.savings);
    
    energyChartInstance.data.labels = labels;
    energyChartInstance.data.datasets[0].data = consumption;
    energyChartInstance.data.datasets[1].data = savings;
    energyChartInstance.update();
};

// Occupancy Chart
const occupancyChartCanvas = document.getElementById('occupancyChart');

if (occupancyChartCanvas) {
    const ctx = occupancyChartCanvas.getContext('2d');
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Occupied', 'Empty', 'Maintenance'],
            datasets: [{
                data: [65, 25, 10],
                backgroundColor: [
                    '#10b981',
                    '#ef4444',
                    '#f59e0b'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}