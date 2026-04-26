/**
 * Charts and Visualization Module
 * Manages all Chart.js instances and data visualization
 */

class ChartManager {
    constructor() {
        this.charts = {};
        this.chartData = {
            occupancy: [],
            confidence: [],
            timeSeries: []
        };
        this.initCharts();
    }

    /**
     * Initialize all charts
     */
    initCharts() {
        this.createOccupancyChart();
        this.createConfidenceChart();
        this.createTimeSeriesChart();
    }

    /**
     * Create occupancy trend chart
     */
    createOccupancyChart() {
        const ctx = document.getElementById('occupancyChart');
        if (!ctx) return;

        this.charts.occupancy = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Occupancy Count',
                        data: [],
                        borderColor: CONFIG.CHARTS.COLORS.PRIMARY,
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: CONFIG.CHARTS.COLORS.PRIMARY,
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointHoverBackgroundColor: CONFIG.CHARTS.COLORS.SECONDARY
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            color: '#d1d5db',
                            font: { size: 12, weight: '500' },
                            padding: 15,
                            usePointStyle: true
                        }
                    },
                    grid: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#9ca3af',
                            font: { size: 11 }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)',
                            drawBorder: false
                        }
                    },
                    x: {
                        ticks: {
                            color: '#9ca3af',
                            font: { size: 11 }
                        },
                        grid: {
                            display: false,
                            drawBorder: false
                        }
                    }
                }
            }
        });
    }

    /**
     * Create confidence distribution chart
     */
    createConfidenceChart() {
        const ctx = document.getElementById('confidenceChart');
        if (!ctx) return;

        this.charts.confidence = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['High (0.8-1.0)', 'Medium (0.5-0.8)', 'Low (0.1-0.5)'],
                datasets: [
                    {
                        data: [0, 0, 0],
                        backgroundColor: [
                            CONFIG.CHARTS.COLORS.SUCCESS,
                            CONFIG.CHARTS.COLORS.WARNING,
                            CONFIG.CHARTS.COLORS.DANGER
                        ],
                        borderColor: 'rgba(26, 26, 46, 0.95)',
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#d1d5db',
                            font: { size: 11, weight: '500' },
                            padding: 15,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.label + ': ' + context.parsed + ' detections';
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Create time series chart
     */
    createTimeSeriesChart() {
        const ctx = document.getElementById('timeSeriesChart');
        if (!ctx) return;

        this.charts.timeSeries = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Average Occupancy',
                        data: [],
                        backgroundColor: CONFIG.CHARTS.COLORS.PRIMARY,
                        borderRadius: 4,
                        hoverBackgroundColor: CONFIG.CHARTS.COLORS.SECONDARY
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'x',
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            color: '#d1d5db',
                            font: { size: 12, weight: '500' },
                            padding: 15
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#9ca3af',
                            font: { size: 11 }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)',
                            drawBorder: false
                        }
                    },
                    x: {
                        ticks: {
                            color: '#9ca3af',
                            font: { size: 11 }
                        },
                        grid: {
                            display: false,
                            drawBorder: false
                        }
                    }
                }
            }
        });
    }

    /**
     * Update occupancy chart with new data
     */
    updateOccupancyChart(occupancyCount) {
        if (!this.charts.occupancy) return;

        const chart = this.charts.occupancy;
        const timestamp = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        // Keep only last 20 points
        if (chart.data.labels.length >= CONFIG.CHARTS.OCCUPANCY_CHART.MAX_DATA_POINTS) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
        }

        chart.data.labels.push(timestamp);
        chart.data.datasets[0].data.push(occupancyCount);
        chart.update('none');
    }

    /**
     * Update confidence distribution chart
     */
    updateConfidenceChart(detections) {
        if (!this.charts.confidence || !detections) return;

        const confidenceBuckets = [0, 0, 0]; // [high, medium, low]

        detections.forEach(detection => {
            const conf = detection.confidence;
            if (conf >= 0.8) confidenceBuckets[0]++;
            else if (conf >= 0.5) confidenceBuckets[1]++;
            else confidenceBuckets[2]++;
        });

        this.charts.confidence.data.datasets[0].data = confidenceBuckets;
        this.charts.confidence.update('none');
    }

    /**
     * Add data point to time series chart
     */
    addTimeSeriesData(label, avgOccupancy) {
        if (!this.charts.timeSeries) return;

        const chart = this.charts.timeSeries;

        if (chart.data.labels.length >= 10) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
        }

        chart.data.labels.push(label);
        chart.data.datasets[0].data.push(avgOccupancy);
        chart.update('none');
    }

    /**
     * Reset all charts
     */
    resetCharts() {
        Object.keys(this.charts).forEach(key => {
            const chart = this.charts[key];
            if (chart) {
                chart.data.labels = [];
                chart.data.datasets.forEach(dataset => {
                    dataset.data = [];
                });
                chart.update('none');
            }
        });
    }

    /**
     * Destroy all charts
     */
    destroyCharts() {
        Object.keys(this.charts).forEach(key => {
            if (this.charts[key]) {
                this.charts[key].destroy();
                delete this.charts[key];
            }
        });
    }

    /**
     * Export chart as image
     */
    exportChartAsImage(chartName, filename = 'chart.png') {
        if (!this.charts[chartName]) return;

        const canvas = this.charts[chartName].canvas;
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = filename;
        link.click();
    }
}

// Create global chart manager instance
const chartManager = new ChartManager();
