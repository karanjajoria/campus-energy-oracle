/**
 * Main Application Script
 * Initializes and manages the entire application
 */

class ClassroomOccupancyApp {
    constructor() {
        this.isInitialized = false;
        this.init();
    }

    /**
     * Initialize application
     */
    async init() {
        try {
            console.log('🚀 Initializing Classroom Occupancy Detection System...');

            // Check if API is available
            await this.checkAPIAvailability();

            // Initialize components
            this.initializeComponents();

            // Setup periodic health checks
            this.setupHealthChecks();

            this.isInitialized = true;
            console.log('✅ Application initialized successfully');
        } catch (error) {
            console.error('❌ Initialization error:', error);
            ui.showNotification('Failed to initialize application', 'error');
        }
    }

    /**
     * Check API availability
     */
    async checkAPIAvailability() {
        try {
            const health = await api.healthCheck();
            console.log('✅ API is available:', health);
            ui.updateModelStatus(health, true);
        } catch (error) {
            console.warn('⚠️ API is not available:', error.message);
            ui.showNotification('API Server is not available. Please ensure the Flask server is running.', 'error');
            ui.updateModelStatus(null, false);
        }
    }

    /**
     * Initialize all components
     */
    initializeComponents() {
        console.log('📦 Initializing components...');

        // Load model info
        this.loadModelInfo();

        // Initialize charts
        console.log('📊 Initializing charts...');
        chartManager.initCharts();

        // Initialize UI
        console.log('🎨 Initializing UI...');
        ui.init();

        console.log('✅ All components initialized');
    }

    /**
     * Load model information
     */
    async loadModelInfo() {
        try {
            const modelInfo = await api.getModelInfo();
            console.log('📋 Model info:', modelInfo);
            // Info is already displayed in sidebar
        } catch (error) {
            console.warn('Could not load model info:', error);
        }
    }

    /**
     * Setup periodic health checks
     */
    setupHealthChecks() {
        // Check API health every 30 seconds
        setInterval(() => {
            api.healthCheck()
                .then(health => {
                    ui.updateModelStatus(health, true);
                })
                .catch(() => {
                    ui.updateModelStatus(null, false);
                });
        }, 30000);
    }

    /**
     * Get application status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            apiConnected: true, // This would need to be tracked
            chartsReady: Object.keys(chartManager.charts).length > 0,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Cleanup and destroy application
     */
    destroy() {
        console.log('🧹 Cleaning up...');

        // Stop webcam if active
        if (ui.isWebcamActive) {
            ui.stopWebcam();
        }

        // Destroy charts
        chartManager.destroyCharts();

        this.isInitialized = false;
        console.log('✅ Application cleaned up');
    }
}

/**
 * Global error handler
 */
window.addEventListener('error', (event) => {
    console.error('🔴 Uncaught error:', event.error);
    ui.showNotification('An unexpected error occurred', 'error');
});

/**
 * Global unhandled promise rejection handler
 */
window.addEventListener('unhandledrejection', (event) => {
    console.error('🔴 Unhandled promise rejection:', event.reason);
    ui.showNotification('An unexpected error occurred', 'error');
});

/**
 * Initialize application when DOM is ready
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new ClassroomOccupancyApp();
    });
} else {
    window.app = new ClassroomOccupancyApp();
}

/**
 * Cleanup on page unload
 */
window.addEventListener('beforeunload', () => {
    if (window.app) {
        window.app.destroy();
    }
});

console.log('📱 Classroom Occupancy Detection System v1.0.0');
