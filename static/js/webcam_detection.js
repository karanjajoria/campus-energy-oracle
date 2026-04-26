/**
 * Enhanced Webcam Detection Module
 * Handles real-time detection and live dashboard updates
 */

class WebcamDetectionManager {
    constructor() {
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.stream = null;
        this.isActive = false;
        this.detectionInterval = null;
        this.confidence = 0.5;
        this.stats = {
            current_count: 0,
            max_count: 0,
            min_count: 0,
            avg_count: 0,
            frame_count: 0
        };
        this.detectionHistory = [];
        this.init();
    }

    /**
     * Initialize webcam manager
     */
    async init() {
        // Create hidden video element
        this.video = document.createElement('video');
        this.video.setAttribute('autoplay', true);
        this.video.setAttribute('playsinline', true);
        this.video.setAttribute('muted', true);
        
        // Create hidden canvas for frame capture
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        logger.info('Webcam manager initialized');
    }

    /**
     * Start webcam stream and detection
     */
    async start(confidenceThreshold = 0.5) {
        try {
            if (this.isActive) {
                return { success: false, error: 'Webcam already active' };
            }

            this.confidence = confidenceThreshold;

            logger.info('Requesting webcam access...');

            // Request camera access
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                },
                audio: false
            });

            // Attach stream to video element
            this.video.srcObject = this.stream;

            // Wait for video to load
            await new Promise(resolve => {
                this.video.onloadedmetadata = () => {
                    this.canvas.width = this.video.videoWidth;
                    this.canvas.height = this.video.videoHeight;
                    resolve();
                };
            });

            // Notify backend - start session
            await this.notifyBackendStart();

            // Start detection loop
            this.isActive = true;
            this.startDetectionLoop();

            logger.info('Webcam started successfully');
            return { success: true, message: 'Webcam started' };

        } catch (error) {
            logger.error(`Failed to start webcam: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Stop webcam stream and detection
     */
    async stop() {
        try {
            if (!this.isActive) {
                return { success: false, error: 'Webcam not active' };
            }

            this.isActive = false;

            // Stop detection loop
            if (this.detectionInterval) {
                clearInterval(this.detectionInterval);
                this.detectionInterval = null;
            }

            // Stop video stream
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
                this.stream = null;
            }

            // Notify backend - stop session
            const result = await this.notifyBackendStop();

            logger.info('Webcam stopped');
            return { success: true, stats: result.stats };

        } catch (error) {
            logger.error(`Failed to stop webcam: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Start detection loop - runs at regular intervals
     */
    startDetectionLoop() {
        // Process frames every 100ms (approximately 10 FPS)
        // Adjust this value for different detection frequencies
        this.detectionInterval = setInterval(() => {
            this.processFrame();
        }, 100);

        logger.info('Detection loop started');
    }

    /**
     * Process a single video frame
     */
    async processFrame() {
        try {
            if (!this.isActive || !this.video.srcObject) {
                return;
            }

            // Draw video frame to canvas
            this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

            // Convert to base64
            const frameData = this.canvas.toDataURL('image/jpeg', 0.8);

            // Send to detection API
            const result = await this.detectFrame(frameData);

            if (result.success) {
                // Update live video display
                this.updateLiveDisplay(result);

                // Update dashboard stats
                this.updateDashboard(result);

                // Add to history
                this.detectionHistory.push({
                    timestamp: new Date(),
                    count: result.occupancy_count,
                    confidence: this.confidence
                });
            }

        } catch (error) {
            logger.error(`Frame processing error: ${error.message}`);
        }
    }

    /**
     * Send frame to detection API
     */
    async detectFrame(frameBase64) {
        try {
            const response = await fetch(`${CONFIG.API.BASE_URL}/api/detect/webcam`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    image: frameBase64,
                    confidence: this.confidence
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            return await response.json();

        } catch (error) {
            logger.error(`Detection API error: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update live video display with detected frame
     */
    updateLiveDisplay(result) {
        try {
            if (!result.frame) return;

            // Display annotated frame in UI
            const videoDisplay = document.getElementById('webcamDisplay');
            if (videoDisplay) {
                videoDisplay.src = result.frame;
            }

            // Display current count
            const countDisplay = document.getElementById('webcamCount');
            if (countDisplay) {
                countDisplay.textContent = result.occupancy_count || 0;
            }

        } catch (error) {
            logger.error(`Failed to update live display: ${error.message}`);
        }
    }

    /**
     * Update dashboard statistics
     */
    updateDashboard(result) {
        try {
            if (!result.stats) return;

            // Update stats
            this.stats = result.stats;

            // Update dashboard elements
            this.updateDashboardElements();

            // Update charts
            if (typeof chartManager !== 'undefined' && chartManager) {
                chartManager.updateOccupancyChart(result.occupancy_count);
            }

        } catch (error) {
            logger.error(`Failed to update dashboard: ${error.message}`);
        }
    }

    /**
     * Update all dashboard elements with current stats
     */
    updateDashboardElements() {
        // Current occupancy
        const currentEl = document.getElementById('currentOccupancy');
        if (currentEl) {
            currentEl.textContent = this.stats.current_count || 0;
        }

        // Average occupancy
        const avgEl = document.getElementById('avgOccupancy');
        if (avgEl) {
            avgEl.textContent = this.stats.avg_count || 0;
        }

        // Peak occupancy
        const peakEl = document.getElementById('peakOccupancy');
        if (peakEl) {
            peakEl.textContent = this.stats.max_count || 0;
        }

        // Last update time
        const timeEl = document.getElementById('lastUpdate');
        if (timeEl) {
            const now = new Date();
            timeEl.textContent = now.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        }

        // Webcam stats display
        const webcamStats = document.getElementById('webcamStats');
        if (webcamStats) {
            webcamStats.innerHTML = `
                <div class="stat-row">
                    <span>Current:</span>
                    <strong>${this.stats.current_count}</strong>
                </div>
                <div class="stat-row">
                    <span>Average:</span>
                    <strong>${this.stats.avg_count}</strong>
                </div>
                <div class="stat-row">
                    <span>Peak:</span>
                    <strong>${this.stats.max_count}</strong>
                </div>
                <div class="stat-row">
                    <span>Frames:</span>
                    <strong>${this.stats.frame_count}</strong>
                </div>
                <div class="stat-row">
                    <span>Confidence:</span>
                    <strong>${(this.stats.confidence * 100).toFixed(0)}%</strong>
                </div>
            `;
        }
    }

    /**
     * Notify backend - session start
     */
    async notifyBackendStart() {
        try {
            const response = await fetch(`${CONFIG.API.BASE_URL}/api/webcam/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to start session: ${response.status}`);
            }

            return await response.json();

        } catch (error) {
            logger.error(`Failed to notify backend start: ${error.message}`);
        }
    }

    /**
     * Notify backend - session stop
     */
    async notifyBackendStop() {
        try {
            const response = await fetch(`${CONFIG.API.BASE_URL}/api/webcam/stop`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to stop session: ${response.status}`);
            }

            return await response.json();

        } catch (error) {
            logger.error(`Failed to notify backend stop: ${error.message}`);
        }
    }

    /**
     * Get current stats
     */
    getStats() {
        return {
            isActive: this.isActive,
            stats: this.stats,
            historyLength: this.detectionHistory.length
        };
    }

    /**
     * Get detection history
     */
    getHistory() {
        return this.detectionHistory;
    }

    /**
     * Set confidence threshold
     */
    setConfidence(confidence) {
        this.confidence = Math.max(0.1, Math.min(1.0, parseFloat(confidence)));
    }
}

// Initialize global instance
let webcamManager = null;

/**
 * Initialize webcam manager when DOM is ready
 */
function initWebcamManager() {
    if (!webcamManager) {
        webcamManager = new WebcamDetectionManager();
        logger.info('Webcam manager initialized');
    }
}

/**
 * Start webcam - call from UI
 */
async function startWebcam() {
    if (!webcamManager) {
        initWebcamManager();
    }

    const confidence = parseFloat(document.getElementById('confidenceSlider')?.value || 0.5);
    const result = await webcamManager.start(confidence);

    if (result.success) {
        logger.info('Webcam started');
        // Update UI button
        const btn = document.getElementById('webcamBtn');
        if (btn) {
            btn.textContent = '⏹️ Stop Webcam';
            btn.classList.add('active');
        }

        // Show live display area
        const displayArea = document.getElementById('webcamDisplayArea');
        if (displayArea) {
            displayArea.style.display = 'block';
        }
    } else {
        logger.error(`Failed to start webcam: ${result.error}`);
        showNotification(result.error, 'error');
    }

    return result;
}

/**
 * Stop webcam - call from UI
 */
async function stopWebcam() {
    if (!webcamManager) {
        return { success: false, error: 'Webcam manager not initialized' };
    }

    const result = await webcamManager.stop();

    if (result.success) {
        logger.info('Webcam stopped');
        // Update UI button
        const btn = document.getElementById('webcamBtn');
        if (btn) {
            btn.textContent = '📷 Start Webcam';
            btn.classList.remove('active');
        }

        // Show final stats
        if (result.stats) {
            showNotification(
                `Session ended. Avg occupancy: ${result.stats.avg_occupancy}, Peak: ${result.stats.max_occupancy}`,
                'success'
            );
        }

        // Hide live display area
        const displayArea = document.getElementById('webcamDisplayArea');
        if (displayArea) {
            displayArea.style.display = 'none';
        }
    } else {
        logger.error(`Failed to stop webcam: ${result.error}`);
        showNotification(result.error, 'error');
    }

    return result;
}

/**
 * Toggle webcam on/off
 */
async function toggleWebcam() {
    if (!webcamManager) {
        initWebcamManager();
    }

    if (webcamManager.isActive) {
        return await stopWebcam();
    } else {
        return await startWebcam();
    }
}

/**
 * Update confidence threshold for webcam
 */
function updateWebcamConfidence(value) {
    if (webcamManager) {
        webcamManager.setConfidence(value);
    }
}

/**
 * Get current webcam stats
 */
function getWebcamStats() {
    if (!webcamManager) {
        return { isActive: false, stats: {} };
    }
    return webcamManager.getStats();
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        WebcamDetectionManager,
        startWebcam,
        stopWebcam,
        toggleWebcam,
        updateWebcamConfidence,
        getWebcamStats
    };
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWebcamManager);
} else {
    initWebcamManager();
}