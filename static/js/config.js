/**
 * Configuration file for Classroom Occupancy Detection UI
 */

const CONFIG = {
    // API Configuration
    API: {
        BASE_URL: 'http://localhost:5000',
        ENDPOINTS: {
            HEALTH: '/api/health',
            DETECT_IMAGE: '/api/detect/image',
            DETECT_VIDEO: '/api/detect/video',
            DETECT_WEBCAM: '/api/detect/webcam',
            MODEL_INFO: '/api/model/info',
            DOWNLOAD_VIDEO: '/api/download/video'
        },
        TIMEOUT: 30000 // 30 seconds
    },

    // UI Configuration
    UI: {
        THEME: 'dark',
        ANIMATION_ENABLED: true,
        AUTO_REFRESH: true,
        REFRESH_INTERVAL: 5000 // 5 seconds
    },

    // Detection Configuration
    DETECTION: {
        DEFAULT_CONFIDENCE: 0.5,
        MIN_CONFIDENCE: 0.1,
        MAX_CONFIDENCE: 1.0,
        CONFIDENCE_STEP: 0.05,
        ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/bmp'],
        ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/x-msvideo', 'video/quicktime', 'video/x-matroska'],
        MAX_FILE_SIZE: 100 * 1024 * 1024 // 100MB
    },

    // Chart Configuration
    CHARTS: {
        OCCUPANCY_CHART: {
            MAX_DATA_POINTS: 20,
            UPDATE_INTERVAL: 1000
        },
        COLORS: {
            PRIMARY: 'rgb(99, 102, 241)',
            SECONDARY: 'rgb(236, 72, 153)',
            SUCCESS: 'rgb(16, 185, 129)',
            WARNING: 'rgb(245, 158, 11)',
            DANGER: 'rgb(239, 68, 68)',
            NEUTRAL: 'rgb(107, 114, 128)'
        }
    },

    // Storage Configuration
    STORAGE: {
        PREFIX: 'classroom_',
        PERSIST_DETECTIONS: true,
        MAX_HISTORY: 100
    },

    // Logging
    DEBUG: true,

    // Notification Configuration
    NOTIFICATIONS: {
        AUTO_DISMISS: 3000, // 3 seconds
        POSITION: 'bottom-right'
    }
};

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
