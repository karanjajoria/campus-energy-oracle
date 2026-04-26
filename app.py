"""
Classroom Occupancy Detection - Production Flask API
Handles model inference, static file serving, and detection results
Fully integrated with the UI structure you provided
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

# ==================== Logger Setup ====================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== Flask App Setup ====================

# Get absolute paths based on this file's location
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_DIR = os.path.join(BASE_DIR, 'templates')
STATIC_DIR = os.path.join(BASE_DIR, 'static')

# Initialize Flask app with proper configuration
app = Flask(
    __name__,
    template_folder=TEMPLATE_DIR,
    static_folder=STATIC_DIR,
    static_url_path='/static'
)

# CORS Configuration - Allow API calls from UI
CORS(app, resources={
    r"/api/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# Disable Jinja2 template caching during development
app.jinja_env.auto_reload = True
app.config['TEMPLATES_AUTO_RELOAD'] = True

# ==================== Configuration ====================

UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp'}
ALLOWED_VIDEO_EXTENSIONS = {'mp4', 'avi', 'mov', 'mkv'}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
CONFIDENCE_THRESHOLD = 0.5

# Create upload directory if it doesn't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

# Model configuration
MODEL_PATH = os.path.join(BASE_DIR, 'models', 'SMFA_Yolo26x.pt')

# Global model and device
model = None
device = None

# ==================== Model Loading ====================

def load_model():
    """
    Load YOLO model from disk
    Returns: True if successful, False otherwise
    """
    global model, device
    try:
        # Determine device (CUDA if available, else CPU)
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
        logger.info(f"Device selected: {device}")
        
        # Check if model file exists
        if not os.path.exists(MODEL_PATH):
            logger.error(f"Model file not found at: {MODEL_PATH}")
            return False
        
        logger.info(f"Loading YOLO model from: {MODEL_PATH}")
        model = YOLO(MODEL_PATH)
        model.to(device)
        
        logger.info(f"✓ Model loaded successfully on {device}")
        return True
        
    except Exception as e:
        logger.error(f"✗ Failed to load model: {str(e)}")
        return False

# ==================== File Validation ====================

def allowed_file(filename, file_type='image'):
    """
    Check if file extension is allowed
    Args:
        filename: Name of the file to check
        file_type: 'image' or 'video'
    Returns: True if allowed, False otherwise
    """
    if '.' not in filename:
        return False
    
    ext = filename.rsplit('.', 1)[1].lower()
    
    if file_type == 'image':
        return ext in ALLOWED_IMAGE_EXTENSIONS
    elif file_type == 'video':
        return ext in ALLOWED_VIDEO_EXTENSIONS
    
    return False

# ==================== Detection Drawing ====================

def draw_detections(image, results):
    """
    Draw bounding boxes and labels on detected persons
    Args:
        image: Input image (OpenCV format)
        results: YOLO detection results
    Returns: Image with annotations drawn
    """
    if results and len(results) > 0:
        for result in results:
            if result.boxes is not None:
                for box in result.boxes:
                    # Get box coordinates
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    conf = box.conf[0].item()
                    cls = int(box.cls[0].item())
                    
                    # Draw bounding box rectangle
                    cv2.rectangle(image, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    
                    # Draw label with confidence
                    label = f"Person {conf:.2f}"
                    label_size, _ = cv2.getTextSize(
                        label, 
                        cv2.FONT_HERSHEY_SIMPLEX, 
                        0.6, 
                        2
                    )
                    
                    # Draw label background
                    cv2.rectangle(
                        image, 
                        (x1, y1 - 25), 
                        (x1 + label_size[0], y1), 
                        (0, 255, 0), 
                        -1
                    )
                    
                    # Draw label text
                    cv2.putText(
                        image, 
                        label, 
                        (x1, y1 - 5), 
                        cv2.FONT_HERSHEY_SIMPLEX, 
                        0.6, 
                        (0, 0, 0), 
                        2
                    )
    
    return image

# ==================== Image Conversion ====================

def image_to_base64(image):
    """
    Convert OpenCV image to base64 string for transmission
    Args:
        image: Input image (OpenCV format)
    Returns: Base64 encoded string
    """
    _, buffer = cv2.imencode('.jpg', image)
    img_base64 = base64.b64encode(buffer).decode('utf-8')
    return img_base64

# ==================== UI Routes ====================

@app.route('/')
def index():
    """
    Serve the main dashboard HTML
    Returns: Rendered index.html with Flask context
    """
    logger.info("Dashboard requested")
    try:
        return render_template('index.html')
    except Exception as e:
        logger.error(f"Error rendering template: {e}")
        return jsonify({'error': f'Could not load template: {str(e)}'}), 500

@app.route('/static/<path:filename>')
def serve_static(filename):
    """
    Serve static files (CSS, JS) explicitly
    Args:
        filename: Path to static file
    Returns: Static file content
    """
    return send_from_directory(STATIC_DIR, filename)

# ==================== Debug Routes ====================

@app.route('/debug/info', methods=['GET'])
def debug_info():
    """
    Debug endpoint showing configuration and file status
    Useful for troubleshooting static file issues
    Returns: JSON with debug information
    """
    return jsonify({
        'status': 'debug',
        'base_dir': BASE_DIR,
        'template_dir': TEMPLATE_DIR,
        'static_dir': STATIC_DIR,
        'upload_folder': UPLOAD_FOLDER,
        'model_path': MODEL_PATH,
        'directories_exist': {
            'templates': os.path.exists(TEMPLATE_DIR),
            'static': os.path.exists(STATIC_DIR),
            'static/css': os.path.exists(os.path.join(STATIC_DIR, 'css')),
            'static/js': os.path.exists(os.path.join(STATIC_DIR, 'js')),
            'models': os.path.exists(os.path.dirname(MODEL_PATH)),
        },
        'files_exist': {
            'index.html': os.path.exists(os.path.join(TEMPLATE_DIR, 'index.html')),
            'styles.css': os.path.exists(os.path.join(STATIC_DIR, 'css', 'styles.css')),
            'config.js': os.path.exists(os.path.join(STATIC_DIR, 'js', 'config.js')),
            'model_file': os.path.exists(MODEL_PATH),
        },
        'model_status': {
            'loaded': model is not None,
            'device': device,
        },
        'timestamp': datetime.now().isoformat()
    }), 200

@app.route('/debug/test', methods=['GET'])
def debug_test():
    """
    Test endpoint to verify API is working
    Returns: Simple test message
    """
    return jsonify({
        'message': 'API is working correctly',
        'timestamp': datetime.now().isoformat()
    }), 200

# ==================== API Routes - Health Check ====================

@app.route('/api/health', methods=['GET'])
def health_check():
    """
    Health check endpoint
    Returns: Server health status and model information
    """
    logger.info("Health check requested")
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None,
        'device': device,
        'timestamp': datetime.now().isoformat()
    }), 200

@app.route('/api/model/info', methods=['GET'])
def model_info():
    """
    Get information about the loaded model
    Returns: Model details and configuration
    """
    if model is None:
        return jsonify({'error': 'Model not loaded'}), 500
    
    return jsonify({
        'model_path': MODEL_PATH,
        'device': device,
        'framework': 'PyTorch + YOLOv11',
        'task': 'Object Detection (Person)',
        'input_size': '640x640',
        'confidence_threshold': CONFIDENCE_THRESHOLD,
        'timestamp': datetime.now().isoformat()
    }), 200

# ==================== API Routes - Image Detection ====================

@app.route('/api/detect/image', methods=['POST'])
def detect_image():
    """
    Detect people in uploaded image
    
    Request:
        - file: Image file (PNG, JPG, GIF, BMP)
        - confidence: Detection confidence threshold (0.1-1.0)
    
    Returns:
        JSON with:
        - occupancy_count: Number of people detected
        - detections: List of detection details (coordinates, confidence)
        - annotated_image: Base64 encoded image with bounding boxes
    """
    try:
        # Validate request
        if 'file' not in request.files:
            return jsonify({'error': 'No file part in request'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename, 'image'):
            return jsonify({
                'error': f'Invalid file type. Allowed: {", ".join(ALLOWED_IMAGE_EXTENSIONS)}'
            }), 400
        
        if model is None:
            return jsonify({'error': 'Model not loaded'}), 500
        
        logger.info(f"Processing image: {file.filename}")
        
        # Read and decode image
        img_bytes = file.read()
        nparr = np.frombuffer(img_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            return jsonify({'error': 'Failed to decode image'}), 400
        
        # Get confidence threshold from request
        confidence = request.form.get('confidence', CONFIDENCE_THRESHOLD, type=float)
        confidence = max(0.1, min(1.0, confidence))  # Clamp between 0.1 and 1.0
        
        logger.info(f"Running inference with confidence: {confidence}")
        
        # Run YOLO inference
        results = model(image, conf=confidence, device=device)
        
        # Extract detections
        person_count = 0
        detections = []
        
        if results and len(results) > 0:
            for result in results:
                if result.boxes is not None:
                    for box in result.boxes:
                        conf = box.conf[0].item()
                        x1, y1, x2, y2 = map(float, box.xyxy[0])
                        
                        detections.append({
                            'x1': round(x1, 2),
                            'y1': round(y1, 2),
                            'x2': round(x2, 2),
                            'y2': round(y2, 2),
                            'width': round(x2 - x1, 2),
                            'height': round(y2 - y1, 2),
                            'confidence': round(conf, 3),
                            'person_id': person_count
                        })
                        person_count += 1
        
        # Draw annotations on image
        annotated_image = draw_detections(image.copy(), results)
        img_base64 = image_to_base64(annotated_image)
        
        logger.info(f"Image detection complete: {person_count} people detected")
        
        return jsonify({
            'success': True,
            'occupancy_count': person_count,
            'confidence_threshold': confidence,
            'detections': detections,
            'annotated_image': f'data:image/jpeg;base64,{img_base64}',
            'timestamp': datetime.now().isoformat()
        }), 200
    
    except Exception as e:
        logger.error(f"Error in image detection: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

# ==================== API Routes - Video Detection ====================

@app.route('/api/detect/video', methods=['POST'])
def detect_video():
    """
    Detect people in uploaded video
    Processes each frame and creates annotated output video
    
    Request:
        - file: Video file (MP4, AVI, MOV, MKV)
        - confidence: Detection confidence threshold (0.1-1.0)
    
    Returns:
        JSON with:
        - frames_processed: Total frames analyzed
        - avg_occupancy: Average people count across frames
        - max_occupancy: Peak occupancy
        - min_occupancy: Minimum occupancy
        - output_video: Download link for processed video
        - occupancy_data: Per-frame occupancy counts
    """
    try:
        # Validate request
        if 'file' not in request.files:
            return jsonify({'error': 'No file part in request'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename, 'video'):
            return jsonify({
                'error': f'Invalid file type. Allowed: {", ".join(ALLOWED_VIDEO_EXTENSIONS)}'
            }), 400
        
        if model is None:
            return jsonify({'error': 'Model not loaded'}), 500
        
        logger.info(f"Processing video: {file.filename}")
        
        # Save uploaded video temporarily
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        input_path = os.path.join(UPLOAD_FOLDER, f"input_{timestamp}_{filename}")
        output_path = os.path.join(UPLOAD_FOLDER, f"output_{timestamp}_{filename}")
        
        file.save(input_path)
        logger.info(f"Video saved to: {input_path}")
        
        # Open video file
        cap = cv2.VideoCapture(input_path)
        
        # Get video properties
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        logger.info(f"Video properties: {width}x{height}, {fps}fps, {total_frames} frames")
        
        # Create video writer
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        
        # Process video
        frame_count = 0
        detections_per_frame = []
        confidence = request.form.get('confidence', CONFIDENCE_THRESHOLD, type=float)
        confidence = max(0.1, min(1.0, confidence))
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Run inference on frame
            results = model(frame, conf=confidence, device=device)
            
            # Count detections in this frame
            person_count = 0
            if results and len(results) > 0:
                for result in results:
                    if result.boxes is not None:
                        person_count += len(result.boxes)
            
            detections_per_frame.append(person_count)
            
            # Draw detections
            frame = draw_detections(frame, results)
            
            # Add info text
            cv2.putText(
                frame, 
                f"People: {person_count}", 
                (10, 30), 
                cv2.FONT_HERSHEY_SIMPLEX, 
                1, 
                (0, 255, 0), 
                2
            )
            cv2.putText(
                frame, 
                f"Frame: {frame_count}/{total_frames}", 
                (10, 70), 
                cv2.FONT_HERSHEY_SIMPLEX, 
                0.7, 
                (0, 255, 0), 
                2
            )
            
            # Write frame to output
            out.write(frame)
            frame_count += 1
            
            # Log progress every 30 frames
            if frame_count % 30 == 0:
                logger.info(f"Processed {frame_count}/{total_frames} frames")
        
        # Release resources
        cap.release()
        out.release()
        
        # Calculate statistics
        avg_occupancy = np.mean(detections_per_frame) if detections_per_frame else 0
        max_occupancy = max(detections_per_frame) if detections_per_frame else 0
        min_occupancy = min(detections_per_frame) if detections_per_frame else 0
        
        logger.info(f"Video processing complete: {frame_count} frames processed")
        logger.info(f"Occupancy stats - Avg: {avg_occupancy:.2f}, Max: {max_occupancy}, Min: {min_occupancy}")
        
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
        logger.error(f"Error in video detection: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

# ==================== API Routes - Webcam Detection ====================

@app.route('/api/detect/webcam', methods=['POST'])
def detect_webcam():
    """
    Real-time detection from webcam
    Receives base64 encoded frame and returns detections
    
    Request (JSON):
        - image: Base64 encoded image data
        - confidence: Detection confidence threshold (0.1-1.0)
    
    Returns:
        JSON with:
        - occupancy_count: Number of people in frame
        - detections: List of detection details
        - frame: Base64 encoded annotated frame
    """
    try:
        if model is None:
            return jsonify({'error': 'Model not loaded'}), 500
        
        # Parse JSON request
        data = request.get_json()
        if 'image' not in data:
            return jsonify({'error': 'No image data in request'}), 400
        
        # Decode base64 image
        try:
            img_data = data['image'].split(',')[1]
            nparr = np.frombuffer(base64.b64decode(img_data), np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        except Exception as e:
            logger.error(f"Failed to decode image: {e}")
            return jsonify({'error': 'Failed to decode image data'}), 400
        
        if frame is None:
            return jsonify({'error': 'Failed to decode image'}), 400
        
        # Get confidence threshold
        confidence = data.get('confidence', CONFIDENCE_THRESHOLD)
        confidence = max(0.1, min(1.0, float(confidence)))
        
        # Run inference
        results = model(frame, conf=confidence, device=device)
        
        # Extract detections
        person_count = 0
        detections = []
        
        if results and len(results) > 0:
            for result in results:
                if result.boxes is not None:
                    for box in result.boxes:
                        conf = box.conf[0].item()
                        x1, y1, x2, y2 = map(float, box.xyxy[0])
                        
                        detections.append({
                            'x1': round(x1, 2),
                            'y1': round(y1, 2),
                            'x2': round(x2, 2),
                            'y2': round(y2, 2),
                            'confidence': round(conf, 3)
                        })
                        person_count += 1
        
        # Draw annotations
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
        logger.error(f"Error in webcam detection: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

# ==================== API Routes - Video Download ====================

@app.route('/api/download/video/<filename>', methods=['GET'])
def download_video(filename):
    """
    Download processed video file
    Args:
        filename: Name of the video file to download
    Returns: Video file for download
    """
    try:
        logger.info(f"Video download requested: {filename}")
        return send_from_directory(
            UPLOAD_FOLDER, 
            filename, 
            as_attachment=True,
            mimetype='video/mp4'
        )
    except Exception as e:
        logger.error(f"Error downloading video: {str(e)}")
        return jsonify({'error': 'Video not found'}), 404

# ==================== Error Handlers ====================

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

# ==================== Application Startup ====================

def print_startup_banner():
    """Print startup information banner"""
    print("\n" + "="*70)
    print("  🎓 CLASSROOM OCCUPANCY DETECTION - API SERVER")
    print("="*70)
    print()
    print(f"  Base Directory:     {BASE_DIR}")
    print(f"  Template Directory: {TEMPLATE_DIR}")
    print(f"  Static Directory:   {STATIC_DIR}")
    print(f"  Upload Folder:      {UPLOAD_FOLDER}")
    print(f"  Model Path:         {MODEL_PATH}")
    print()
    print("  Directory Checks:")
    print(f"    ✓ Templates: {os.path.exists(TEMPLATE_DIR)}")
    print(f"    ✓ Static:    {os.path.exists(STATIC_DIR)}")
    print(f"    ✓ Models:    {os.path.exists(os.path.dirname(MODEL_PATH))}")
    print()
    print("  File Checks:")
    print(f"    ✓ index.html:   {os.path.exists(os.path.join(TEMPLATE_DIR, 'index.html'))}")
    print(f"    ✓ styles.css:   {os.path.exists(os.path.join(STATIC_DIR, 'css', 'styles.css'))}")
    print(f"    ✓ config.js:    {os.path.exists(os.path.join(STATIC_DIR, 'js', 'config.js'))}")
    print(f"    ✓ Model file:   {os.path.exists(MODEL_PATH)}")
    print()
    print("  Model Status:")
    print(f"    ✓ Loaded:  {model is not None}")
    print(f"    ✓ Device:  {device}")
    print()
    print("="*70)
    print("  Server URL: http://localhost:5000")
    print("  Debug URL:  http://localhost:5000/debug/info")
    print("  Press CTRL+C to stop")
    print("="*70 + "\n")

if __name__ == '__main__':
    logger.info("="*70)
    logger.info("Starting Classroom Occupancy Detection API...")
    logger.info("="*70)
    
    # Load model
    logger.info("\nLoading ML model...")
    model_loaded = load_model()
    
    if model_loaded:
        logger.info("✓ Model loaded successfully\n")
    else:
        logger.warning("✗ Model loading failed - detection endpoints will return errors\n")
    
    # Print startup banner
    print_startup_banner()
    
    # Run Flask app
    try:
        app.run(
            host='0.0.0.0',
            port=5000,
            debug=True,
            use_reloader=False,
            threaded=True
        )
    except KeyboardInterrupt:
        logger.info("\nServer stopped by user")
    except Exception as e:
        logger.error(f"Server error: {e}")