"""
Classroom Occupancy Detection - Flask API
Handles model inference and returns detection results
FIXED VERSION WITH PROPER STATIC FILE HANDLING
"""

import os
import json
import base64
import io
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np
import torch
from flask import Flask, request, jsonify, render_template, send_from_directory, url_for
from flask_cors import CORS
from werkzeug.utils import secure_filename
from ultralytics import YOLO
from PIL import Image
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get the absolute path to the project directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_DIR = os.path.join(BASE_DIR, 'templates')
STATIC_DIR = os.path.join(BASE_DIR, 'static')

# Initialize Flask app with PROPER paths
app = Flask(
    __name__,
    template_folder=TEMPLATE_DIR,
    static_folder=STATIC_DIR,
    static_url_path='/static'
)

# CORS Configuration
CORS(app, resources={
    r"/api/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# Disable Jinja2 template caching for development
app.jinja_env.auto_reload = True
app.config['TEMPLATES_AUTO_RELOAD'] = True

# Configuration
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp'}
ALLOWED_VIDEO_EXTENSIONS = {'mp4', 'avi', 'mov', 'mkv'}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
CONFIDENCE_THRESHOLD = 0.5

# Create upload directory
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

# Model path
MODEL_PATH = os.path.join(BASE_DIR, 'models', 'SMFA_Yolo26x.pt')

# Global model
model = None
device = None

def load_model():
    """Load YOLO model"""
    global model, device
    try:
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
        logger.info(f"Loading model from {MODEL_PATH}...")
        
        # Check if model file exists
        if not os.path.exists(MODEL_PATH):
            logger.warning(f"Model file not found at {MODEL_PATH}")
            return False
        
        model = YOLO(MODEL_PATH)
        model.to(device)
        logger.info(f"✓ Model loaded successfully on {device}")
        return True
    except Exception as e:
        logger.error(f"✗ Failed to load model: {str(e)}")
        return False

def allowed_file(filename, file_type='image'):
    """Check if file extension is allowed"""
    if '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[1].lower()
    if file_type == 'image':
        return ext in ALLOWED_IMAGE_EXTENSIONS
    elif file_type == 'video':
        return ext in ALLOWED_VIDEO_EXTENSIONS
    return False

def draw_detections(image, results):
    """Draw bounding boxes on image"""
    if results and len(results) > 0:
        for result in results:
            if result.boxes is not None:
                for box in result.boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    conf = box.conf[0].item()
                    cls = int(box.cls[0].item())
                    
                    # Draw rectangle
                    cv2.rectangle(image, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    
                    # Draw label
                    label = f"Person {conf:.2f}"
                    label_size, _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
                    cv2.rectangle(image, (x1, y1 - 25), (x1 + label_size[0], y1), (0, 255, 0), -1)
                    cv2.putText(image, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)
    return image

def image_to_base64(image):
    """Convert OpenCV image to base64 string"""
    _, buffer = cv2.imencode('.jpg', image)
    img_base64 = base64.b64encode(buffer).decode('utf-8')
    return img_base64

# ==================== Debug Routes ====================

@app.route('/debug/info', methods=['GET'])
def debug_info():
    """Debug endpoint to show file paths and status"""
    return jsonify({
        'base_dir': BASE_DIR,
        'template_dir': TEMPLATE_DIR,
        'static_dir': STATIC_DIR,
        'upload_folder': UPLOAD_FOLDER,
        'template_dir_exists': os.path.exists(TEMPLATE_DIR),
        'static_dir_exists': os.path.exists(STATIC_DIR),
        'index_html_exists': os.path.exists(os.path.join(TEMPLATE_DIR, 'index.html')),
        'model_path': MODEL_PATH,
        'model_exists': os.path.exists(MODEL_PATH),
        'model_loaded': model is not None,
        'device': device
    }), 200

# ==================== UI Routes ====================

@app.route('/')
def index():
    """Serve main dashboard"""
    logger.info("Serving index.html")
    try:
        return render_template('index.html')
    except Exception as e:
        logger.error(f"Error rendering template: {e}")
        return f"<h1>Error</h1><p>Could not load template: {e}</p>", 500

@app.route('/static/<path:filename>')
def serve_static(filename):
    """Serve static files explicitly"""
    return send_from_directory(STATIC_DIR, filename)

# ==================== API Routes ====================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    logger.info("Health check requested")
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None,
        'device': device,
        'timestamp': datetime.now().isoformat()
    }), 200

@app.route('/api/detect/image', methods=['POST'])
def detect_image():
    """
    Detect people in uploaded image
    
    Returns:
        JSON with detected people count and annotated image
    """
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file part'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400
        
        if not allowed_file(file.filename, 'image'):
            return jsonify({'error': 'Invalid file type'}), 400
        
        if model is None:
            return jsonify({'error': 'Model not loaded'}), 500
        
        # Read image
        img_bytes = file.read()
        nparr = np.frombuffer(img_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            return jsonify({'error': 'Failed to decode image'}), 400
        
        # Get confidence threshold from request
        confidence = request.form.get('confidence', CONFIDENCE_THRESHOLD, type=float)
        
        # Run inference
        results = model(image, conf=confidence, device=device)
        
        # Count detections
        person_count = 0
        detections = []
        
        if results and len(results) > 0:
            for result in results:
                if result.boxes is not None:
                    for box in result.boxes:
                        conf = box.conf[0].item()
                        x1, y1, x2, y2 = map(float, box.xyxy[0])
                        
                        detections.append({
                            'x1': x1,
                            'y1': y1,
                            'x2': x2,
                            'y2': y2,
                            'confidence': round(conf, 3),
                            'person_id': person_count
                        })
                        person_count += 1
        
        # Draw detections
        annotated_image = draw_detections(image.copy(), results)
        img_base64 = image_to_base64(annotated_image)
        
        logger.info(f"Image detection completed: {person_count} people detected")
        
        return jsonify({
            'success': True,
            'occupancy_count': person_count,
            'confidence_threshold': confidence,
            'detections': detections,
            'annotated_image': f'data:image/jpeg;base64,{img_base64}',
            'timestamp': datetime.now().isoformat()
        }), 200
    
    except Exception as e:
        logger.error(f"Error in detect_image: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/detect/video', methods=['POST'])
def detect_video():
    """
    Detect people in uploaded video
    Returns processed video with annotations
    """
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file part'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400
        
        if not allowed_file(file.filename, 'video'):
            return jsonify({'error': 'Invalid file type'}), 400
        
        if model is None:
            return jsonify({'error': 'Model not loaded'}), 500
        
        # Save uploaded video
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        input_path = os.path.join(app.config['UPLOAD_FOLDER'], f"input_{timestamp}_{filename}")
        output_path = os.path.join(app.config['UPLOAD_FOLDER'], f"output_{timestamp}_{filename}")
        
        file.save(input_path)
        
        # Process video
        cap = cv2.VideoCapture(input_path)
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        
        frame_count = 0
        detections_per_frame = []
        confidence = request.form.get('confidence', CONFIDENCE_THRESHOLD, type=float)
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Run inference
            results = model(frame, conf=confidence, device=device)
            
            # Count detections
            person_count = 0
            if results and len(results) > 0:
                for result in results:
                    if result.boxes is not None:
                        person_count += len(result.boxes)
            
            detections_per_frame.append(person_count)
            
            # Draw detections
            frame = draw_detections(frame, results)
            
            # Add frame info
            cv2.putText(frame, f"People: {person_count}", (10, 30), 
                       cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            cv2.putText(frame, f"Frame: {frame_count}", (10, 70), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            
            out.write(frame)
            frame_count += 1
        
        cap.release()
        out.release()
        
        # Calculate statistics
        avg_occupancy = np.mean(detections_per_frame) if detections_per_frame else 0
        max_occupancy = max(detections_per_frame) if detections_per_frame else 0
        min_occupancy = min(detections_per_frame) if detections_per_frame else 0
        
        logger.info(f"Video detection completed: {frame_count} frames processed")
        
        return jsonify({
            'success': True,
            'frames_processed': frame_count,
            'avg_occupancy': round(avg_occupancy, 2),
            'max_occupancy': int(max_occupancy),
            'min_occupancy': int(min_occupancy),
            'output_video': f'/api/download/video/{os.path.basename(output_path)}',
            'occupancy_data': detections_per_frame,
            'timestamp': datetime.now().isoformat()
        }), 200
    
    except Exception as e:
        logger.error(f"Error in detect_video: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/detect/webcam', methods=['POST'])
def detect_webcam():
    """
    Real-time detection from webcam using base64 encoded frame
    """
    try:
        if model is None:
            return jsonify({'error': 'Model not loaded'}), 500
        
        data = request.get_json()
        if 'image' not in data:
            return jsonify({'error': 'No image data'}), 400
        
        # Decode base64 image
        try:
            img_data = data['image'].split(',')[1]
            nparr = np.frombuffer(base64.b64decode(img_data), np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        except Exception as e:
            logger.error(f"Failed to decode image: {e}")
            return jsonify({'error': 'Failed to decode image'}), 400
        
        if frame is None:
            return jsonify({'error': 'Failed to decode image'}), 400
        
        confidence = data.get('confidence', CONFIDENCE_THRESHOLD)
        
        # Run inference
        results = model(frame, conf=confidence, device=device)
        
        # Count and collect detections
        person_count = 0
        detections = []
        
        if results and len(results) > 0:
            for result in results:
                if result.boxes is not None:
                    for box in result.boxes:
                        conf = box.conf[0].item()
                        x1, y1, x2, y2 = map(float, box.xyxy[0])
                        
                        detections.append({
                            'x1': x1,
                            'y1': y1,
                            'x2': x2,
                            'y2': y2,
                            'confidence': round(conf, 3)
                        })
                        person_count += 1
        
        # Draw detections
        annotated_frame = draw_detections(frame.copy(), results)
        img_base64 = image_to_base64(annotated_frame)
        
        return jsonify({
            'success': True,
            'occupancy_count': person_count,
            'detections': detections,
            'frame': f'data:image/jpeg;base64,{img_base64}',
            'timestamp': datetime.now().isoformat()
        }), 200
    
    except Exception as e:
        logger.error(f"Error in detect_webcam: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/download/video/<filename>', methods=['GET'])
def download_video(filename):
    """Download processed video"""
    try:
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename, as_attachment=True)
    except Exception as e:
        logger.error(f"Error downloading video: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/model/info', methods=['GET'])
def model_info():
    """Get model information"""
    if model is None:
        return jsonify({'error': 'Model not loaded'}), 500
    
    return jsonify({
        'model_path': MODEL_PATH,
        'device': device,
        'framework': 'PyTorch + YOLOv11',
        'task': 'Object Detection (Person)',
        'input_size': '640x640',
        'confidence_threshold': CONFIDENCE_THRESHOLD
    }), 200

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    logger.warning(f"404 error: {error}")
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    logger.error(f"500 error: {error}")
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    logger.info("="*60)
    logger.info("🎓 CLASSROOM OCCUPANCY DETECTION API")
    logger.info("="*60)
    
    logger.info(f"Base Directory: {BASE_DIR}")
    logger.info(f"Template Directory: {TEMPLATE_DIR}")
    logger.info(f"Static Directory: {STATIC_DIR}")
    logger.info(f"Upload Folder: {UPLOAD_FOLDER}")
    
    # Verify directories
    logger.info("\nDirectory Check:")
    logger.info(f"  Templates exist: {os.path.exists(TEMPLATE_DIR)}")
    logger.info(f"  Static exist: {os.path.exists(STATIC_DIR)}")
    logger.info(f"  index.html exists: {os.path.exists(os.path.join(TEMPLATE_DIR, 'index.html'))}")
    
    # Load model
    logger.info("\nModel Loading:")
    if load_model():
        logger.info("  ✓ Model loaded successfully")
    else:
        logger.warning("  ✗ Model not loaded - API will return errors for detection requests")
    
    logger.info("\n" + "="*60)
    logger.info("Starting server on http://localhost:5000")
    logger.info("Press CTRL+C to stop")
    logger.info("="*60 + "\n")
    
    # Run Flask app
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True,
        use_reloader=False
    )