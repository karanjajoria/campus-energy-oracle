/**
 * API Communication Module
 * Handles all communication with the Flask backend
 */

class APIClient {
    constructor(config = CONFIG) {
        this.baseURL = config.API.BASE_URL;
        this.endpoints = config.API.ENDPOINTS;
        this.timeout = config.API.TIMEOUT;
        this.debug = config.DEBUG;
    }

    /**
     * Construct full URL from endpoint
     */
    getURL(endpoint) {
        return `${this.baseURL}${endpoint}`;
    }

    /**
     * Utility function to create timeout promise
     */
    createTimeoutPromise() {
        return new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), this.timeout)
        );
    }

    /**
     * Make a fetch request with timeout
     */
    async fetchWithTimeout(url, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    /**
     * Health check
     */
    async healthCheck() {
        try {
            const response = await this.fetchWithTimeout(
                this.getURL(this.endpoints.HEALTH)
            );
            if (!response.ok) throw new Error('Health check failed');
            const data = await response.json();
            this.log('Health check successful', data);
            return data;
        } catch (error) {
            this.error('Health check failed', error);
            throw error;
        }
    }

    /**
     * Get model information
     */
    async getModelInfo() {
        try {
            const response = await this.fetchWithTimeout(
                this.getURL(this.endpoints.MODEL_INFO)
            );
            if (!response.ok) throw new Error('Failed to get model info');
            const data = await response.json();
            this.log('Model info retrieved', data);
            return data;
        } catch (error) {
            this.error('Failed to get model info', error);
            throw error;
        }
    }

    /**
     * Detect people in image
     * @param {File} file - Image file
     * @param {number} confidence - Confidence threshold
     * @returns {Promise<Object>} Detection results
     */
    async detectImage(file, confidence = 0.5) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('confidence', confidence);

            const startTime = performance.now();
            const response = await this.fetchWithTimeout(
                this.getURL(this.endpoints.DETECT_IMAGE),
                {
                    method: 'POST',
                    body: formData
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Detection failed');
            }

            const data = await response.json();
            const processingTime = ((performance.now() - startTime) / 1000).toFixed(2);
            data.processingTime = processingTime;

            this.log('Image detection successful', data);
            return data;
        } catch (error) {
            this.error('Image detection failed', error);
            throw error;
        }
    }

    /**
     * Detect people in video
     * @param {File} file - Video file
     * @param {number} confidence - Confidence threshold
     * @returns {Promise<Object>} Detection results
     */
    async detectVideo(file, confidence = 0.5) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('confidence', confidence);

            const startTime = performance.now();
            const response = await this.fetchWithTimeout(
                this.getURL(this.endpoints.DETECT_VIDEO),
                {
                    method: 'POST',
                    body: formData
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Detection failed');
            }

            const data = await response.json();
            const processingTime = ((performance.now() - startTime) / 1000).toFixed(2);
            data.processingTime = processingTime;

            this.log('Video detection successful', data);
            return data;
        } catch (error) {
            this.error('Video detection failed', error);
            throw error;
        }
    }

    /**
     * Real-time webcam detection
     * @param {string} imageBase64 - Base64 encoded image
     * @param {number} confidence - Confidence threshold
     * @returns {Promise<Object>} Detection results
     */
    async detectWebcam(imageBase64, confidence = 0.5) {
        try {
            const response = await this.fetchWithTimeout(
                this.getURL(this.endpoints.DETECT_WEBCAM),
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        image: imageBase64,
                        confidence: confidence
                    })
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Detection failed');
            }

            const data = await response.json();
            return data;
        } catch (error) {
            this.error('Webcam detection failed', error);
            throw error;
        }
    }

    /**
     * Validate file
     */
    validateFile(file, fileType = 'image') {
        const allowedTypes = fileType === 'image' ?
            CONFIG.DETECTION.ALLOWED_IMAGE_TYPES :
            CONFIG.DETECTION.ALLOWED_VIDEO_TYPES;

        if (!allowedTypes.includes(file.type)) {
            throw new Error(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`);
        }

        if (file.size > CONFIG.DETECTION.MAX_FILE_SIZE) {
            throw new Error(`File size exceeds ${CONFIG.DETECTION.MAX_FILE_SIZE / 1024 / 1024}MB limit`);
        }

        return true;
    }

    /**
     * Logging utilities
     */
    log(message, data = null) {
        if (this.debug) {
            console.log(`[API] ${message}`, data);
        }
    }

    error(message, error = null) {
        console.error(`[API ERROR] ${message}`, error);
    }
}

// Create global API instance
const api = new APIClient(CONFIG);
