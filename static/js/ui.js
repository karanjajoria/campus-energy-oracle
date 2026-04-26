/**
 * UI Interaction Module
 * Handles all UI events and interactions
 */

class UIManager {
    constructor() {
        this.isWebcamActive = false;
        this.webcamStream = null;
        this.webcamInterval = null;
        this.lastDetectionData = null;
        this.detectionHistory = [];
        this.init();
    }

    /**
     * Initialize UI manager
     */
    init() {
        this.setupEventListeners();
        this.loadSettings();
        this.checkAPIHealth();
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => this.handleNavigation(e));
        });

        // Sidebar buttons
        document.getElementById('uploadImageBtn').addEventListener('click', () => {
            document.getElementById('imageInput').click();
        });

        document.getElementById('uploadVideoBtn').addEventListener('click', () => {
            document.getElementById('videoInput').click();
        });

        document.getElementById('webcamBtn').addEventListener('click', () => {
            this.toggleWebcam();
        });

        // File inputs
        document.getElementById('imageInput').addEventListener('change', (e) => {
            this.handleFileUpload(e, 'image');
        });

        document.getElementById('videoInput').addEventListener('change', (e) => {
            this.handleFileUpload(e, 'video');
        });

        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFileUpload(e);
        });

        // Upload area
        const uploadArea = document.getElementById('uploadArea');
        uploadArea.addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                document.getElementById('fileInput').files = files;
                this.handleFileUpload({ target: { files } });
            }
        });

        // Close detection results
        document.getElementById('closeResults').addEventListener('click', () => {
            this.hideDetectionResults();
        });

        // Confidence slider
        const confidenceSlider = document.getElementById('confidenceSlider');
        confidenceSlider.addEventListener('input', (e) => {
            const value = Math.round(e.target.value * 100);
            document.getElementById('confidenceValue').textContent = value + '%';
        });

        const settingsConfidence = document.getElementById('settingsConfidence');
        if (settingsConfidence) {
            settingsConfidence.addEventListener('input', (e) => {
                const value = Math.round(e.target.value * 100);
                document.getElementById('settingsConfidenceValue').textContent = value + '%';
                this.saveSettings();
            });
        }

        // Settings buttons
        document.getElementById('testConnection')?.addEventListener('click', () => {
            this.testConnection();
        });

        document.getElementById('exportData')?.addEventListener('click', () => {
            this.exportDetectionData();
        });

        document.getElementById('clearData')?.addEventListener('click', () => {
            this.clearDetectionHistory();
        });
    }

    /**
     * Handle navigation
     */
    handleNavigation(e) {
        e.preventDefault();
        const target = e.target.getAttribute('data-section');

        // Update active nav link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        e.target.classList.add('active');

        // Update active section
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(target).classList.add('active');
    }

    /**
     * Handle file upload
     */
    async handleFileUpload(e, type = null) {
        const files = e.target.files;
        if (files.length === 0) return;

        const file = files[0];

        try {
            // Determine file type if not specified
            if (!type) {
                type = file.type.startsWith('image') ? 'image' : 'video';
            }

            // Validate file
            api.validateFile(file, type);

            this.showLoading('Processing ' + type + '...');

            let result;
            if (type === 'image') {
                result = await api.detectImage(file, parseFloat(document.getElementById('confidenceSlider').value));
            } else {
                result = await api.detectVideo(file, parseFloat(document.getElementById('confidenceSlider').value));
            }

            this.hideLoading();
            this.displayDetectionResults(result, file, type);
            this.addToHistory(result, file.name);

        } catch (error) {
            this.hideLoading();
            this.showNotification(error.message, 'error');
        }
    }

    /**
     * Display detection results
     */
    displayDetectionResults(result, file, type) {
        const resultsDiv = document.getElementById('detectionResults');
        resultsDiv.style.display = 'block';

        // Update title
        document.getElementById('resultTitle').textContent = `Detection Results - ${file.name}`;

        // Show media
        if (type === 'image') {
            document.getElementById('resultImage').src = result.annotated_image;
            document.getElementById('resultImage').style.display = 'block';
            document.getElementById('resultVideo').style.display = 'none';
        } else {
            document.getElementById('resultVideo').src = result.output_video;
            document.getElementById('resultVideo').style.display = 'block';
            document.getElementById('resultImage').style.display = 'none';
        }

        // Update summary
        document.getElementById('detectedCount').textContent = result.occupancy_count || result.max_occupancy || 0;
        const confidence = Math.round((result.confidence_threshold || 0.5) * 100);
        document.getElementById('detectedConfidence').textContent = confidence + '%';
        document.getElementById('processingTime').textContent = (result.processingTime || 0) + 's';

        // Update detections list
        const detectionsList = document.getElementById('detectionsList');
        detectionsList.innerHTML = '';

        if (result.detections && result.detections.length > 0) {
            result.detections.forEach((det, index) => {
                const item = document.createElement('div');
                item.className = 'detection-item';
                item.innerHTML = `
                    <div>Person #${index + 1}</div>
                    <div>Confidence: <strong>${(det.confidence * 100).toFixed(1)}%</strong></div>
                    <div>Position: <strong>(${Math.round(det.x1)}, ${Math.round(det.y1)})</strong></div>
                `;
                detectionsList.appendChild(item);
            });
        } else if (result.occupancy_data) {
            // For video results
            const detectionsList = document.getElementById('detectionsList');
            detectionsList.innerHTML = `
                <div class="detection-item">
                    <div>Average Occupancy: <strong>${Math.round(result.avg_occupancy)}</strong></div>
                </div>
                <div class="detection-item">
                    <div>Peak Occupancy: <strong>${result.max_occupancy}</strong></div>
                </div>
                <div class="detection-item">
                    <div>Minimum Occupancy: <strong>${result.min_occupancy}</strong></div>
                </div>
                <div class="detection-item">
                    <div>Frames Processed: <strong>${result.frames_processed}</strong></div>
                </div>
            `;
        }

        // Update charts
        if (result.occupancy_count !== undefined) {
            chartManager.updateOccupancyChart(result.occupancy_count);
            if (result.detections) {
                chartManager.updateConfidenceChart(result.detections);
            }
        }

        // Update stats
        this.updateDashboardStats(result);

        // Scroll to results
        resultsDiv.scrollIntoView({ behavior: 'smooth' });
    }

    /**
     * Hide detection results
     */
    hideDetectionResults() {
        document.getElementById('detectionResults').style.display = 'none';
    }

    /**
     * Update dashboard statistics
     */
    updateDashboardStats(result) {
        const occupancy = result.occupancy_count !== undefined ?
            result.occupancy_count : (result.avg_occupancy || 0);

        document.getElementById('currentOccupancy').textContent = Math.round(occupancy);

        if (result.avg_occupancy !== undefined) {
            document.getElementById('avgOccupancy').textContent = Math.round(result.avg_occupancy);
        }

        if (result.max_occupancy !== undefined) {
            document.getElementById('peakOccupancy').textContent = result.max_occupancy;
        }

        document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * Toggle webcam
     */
    async toggleWebcam() {
        if (this.isWebcamActive) {
            this.stopWebcam();
        } else {
            this.startWebcam();
        }
    }

    /**
     * Start webcam stream
     */
    async startWebcam() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            this.webcamStream = stream;
            this.isWebcamActive = true;

            // Update button
            const btn = document.getElementById('webcamBtn');
            btn.textContent = '⏹️ Stop Webcam';

            this.showNotification('Webcam started', 'success');

            // Start detection loop
            this.startWebcamDetection();
        } catch (error) {
            this.showNotification('Failed to access webcam: ' + error.message, 'error');
        }
    }

    /**
     * Stop webcam stream
     */
    stopWebcam() {
        if (this.webcamStream) {
            this.webcamStream.getTracks().forEach(track => track.stop());
            this.webcamStream = null;
        }

        if (this.webcamInterval) {
            clearInterval(this.webcamInterval);
            this.webcamInterval = null;
        }

        this.isWebcamActive = false;

        // Update button
        const btn = document.getElementById('webcamBtn');
        btn.textContent = '📷 Start Webcam';

        this.showNotification('Webcam stopped', 'success');
    }

    /**
     * Start webcam detection loop
     */
    startWebcamDetection() {
        const video = document.createElement('video');
        video.srcObject = this.webcamStream;
        video.play();

        this.webcamInterval = setInterval(async () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0);

                const imageBase64 = canvas.toDataURL('image/jpeg');
                const confidence = parseFloat(document.getElementById('confidenceSlider').value);

                const result = await api.detectWebcam(imageBase64, confidence);

                if (result.success) {
                    this.updateDashboardStats(result);
                    chartManager.updateOccupancyChart(result.occupancy_count);
                }
            } catch (error) {
                console.error('Webcam detection error:', error);
            }
        }, 1000); // Process every 1 second
    }

    /**
     * Check API health
     */
    async checkAPIHealth() {
        try {
            const health = await api.healthCheck();
            this.updateModelStatus(health);
        } catch (error) {
            this.updateModelStatus(null, false);
        }
    }

    /**
     * Update model status indicator
     */
    updateModelStatus(health, success = true) {
        const indicator = document.getElementById('modelStatus');
        const dot = indicator.querySelector('.status-dot');
        const text = indicator.querySelector('.status-text');

        if (success && health) {
            dot.style.backgroundColor = '#10b981';
            text.textContent = health.model_loaded ? 'Model Ready' : 'Initializing...';
            document.getElementById('modelDevice').textContent = health.device || 'unknown';
        } else {
            dot.style.backgroundColor = '#ef4444';
            text.textContent = 'Offline';
        }
    }

    /**
     * Test connection to API
     */
    async testConnection() {
        const apiUrl = document.getElementById('apiUrl').value;
        const originalUrl = CONFIG.API.BASE_URL;

        try {
            CONFIG.API.BASE_URL = apiUrl;
            this.showLoading('Testing connection...');

            const health = await api.healthCheck();
            this.hideLoading();
            this.showNotification('Connection successful!', 'success');
        } catch (error) {
            CONFIG.API.BASE_URL = originalUrl;
            this.hideLoading();
            this.showNotification('Connection failed: ' + error.message, 'error');
        }
    }

    /**
     * Add detection to history
     */
    addToHistory(result, filename) {
        const entry = {
            timestamp: new Date(),
            filename: filename,
            occupancy: result.occupancy_count || result.avg_occupancy,
            confidence: result.confidence_threshold,
            detections: result.detections || []
        };

        this.detectionHistory.unshift(entry);

        // Keep only last 100 detections
        if (this.detectionHistory.length > CONFIG.STORAGE.MAX_HISTORY) {
            this.detectionHistory.pop();
        }

        this.saveDetectionHistory();
    }

    /**
     * Export detection data
     */
    exportDetectionData() {
        const data = {
            exportDate: new Date().toISOString(),
            detections: this.detectionHistory
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `detections_${Date.now()}.json`;
        link.click();

        this.showNotification('Data exported successfully', 'success');
    }

    /**
     * Clear detection history
     */
    clearDetectionHistory() {
        if (confirm('Clear all detection history? This cannot be undone.')) {
            this.detectionHistory = [];
            this.saveDetectionHistory();
            this.showNotification('History cleared', 'success');
        }
    }

    /**
     * Save detection history to localStorage
     */
    saveDetectionHistory() {
        if (CONFIG.STORAGE.PERSIST_DETECTIONS) {
            localStorage.setItem(CONFIG.STORAGE.PREFIX + 'history', JSON.stringify(this.detectionHistory));
        }
    }

    /**
     * Load detection history from localStorage
     */
    loadDetectionHistory() {
        if (CONFIG.STORAGE.PERSIST_DETECTIONS) {
            const stored = localStorage.getItem(CONFIG.STORAGE.PREFIX + 'history');
            if (stored) {
                this.detectionHistory = JSON.parse(stored);
            }
        }
    }

    /**
     * Save settings to localStorage
     */
    saveSettings() {
        const settings = {
            confidence: document.getElementById('settingsConfidence')?.value || 0.5,
            apiUrl: document.getElementById('apiUrl')?.value || CONFIG.API.BASE_URL
        };
        localStorage.setItem(CONFIG.STORAGE.PREFIX + 'settings', JSON.stringify(settings));
    }

    /**
     * Load settings from localStorage
     */
    loadSettings() {
        const stored = localStorage.getItem(CONFIG.STORAGE.PREFIX + 'settings');
        if (stored) {
            const settings = JSON.parse(stored);
            if (document.getElementById('settingsConfidence')) {
                document.getElementById('settingsConfidence').value = settings.confidence || 0.5;
            }
            if (document.getElementById('apiUrl')) {
                document.getElementById('apiUrl').value = settings.apiUrl || CONFIG.API.BASE_URL;
            }
        }
        this.loadDetectionHistory();
    }

    /**
     * Show loading spinner
     */
    showLoading(message = 'Processing...') {
        const spinner = document.getElementById('loadingSpinner');
        document.getElementById('spinnerText').textContent = message;
        spinner.style.display = 'flex';
    }

    /**
     * Hide loading spinner
     */
    hideLoading() {
        document.getElementById('loadingSpinner').style.display = 'none';
    }

    /**
     * Show notification toast
     */
    showNotification(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast show ${type}`;

        setTimeout(() => {
            toast.classList.remove('show');
        }, CONFIG.NOTIFICATIONS.AUTO_DISMISS);
    }
}

// Create global UI manager instance
const ui = new UIManager();
