from flask import Flask, render_template, jsonify, request, session, redirect, url_for
from datetime import datetime, timedelta
import random
import json

app = Flask(__name__)
app.secret_key = 'your-secret-key-here'  # Change this in production

# Mock data generators
def generate_energy_data():
    """Generate mock real-time energy data"""
    buildings = ['Engineering Block', 'Science Block', 'Admin Block', 'Library', 'Hostel A']
    return [
        {
            'id': f'bldg-{i}',
            'name': building,
            'consumption': round(random.uniform(100, 500), 2),
            'occupancy': random.randint(0, 100),
            'status': random.choice(['normal', 'warning', 'critical']),
            'alerts': random.randint(0, 5)
        }
        for i, building in enumerate(buildings, 1)
    ]

def generate_chart_data(days=7):
    """Generate mock chart data for trends"""
    base_date = datetime.now() - timedelta(days=days)
    return [
        {
            'date': (base_date + timedelta(days=i)).strftime('%Y-%m-%d'),
            'consumption': round(random.uniform(1000, 2000), 2),
            'savings': round(random.uniform(100, 500), 2)
        }
        for i in range(days)
    ]

def generate_alerts():
    """Generate mock alerts"""
    alert_types = [
        ('Room 204 empty with AC running', 'warning', '5 mins ago'),
        ('HVAC Unit 3 maintenance due', 'info', '1 hour ago'),
        ('Peak load threshold reached', 'critical', '2 hours ago'),
        ('Energy consumption 20% above average', 'warning', '3 hours ago')
    ]
    return [
        {
            'message': msg,
            'type': atype,
            'time': time
        }
        for msg, atype, time in alert_types
    ]

def generate_leaderboard():
    """Generate student leaderboard"""
    hostels = ['Hostel A', 'Hostel B', 'Hostel C', 'Hostel D', 'Hostel E']
    return [
        {
            'rank': i,
            'name': hostel,
            'points': random.randint(500, 2000),
            'savings': f'{random.randint(10, 40)}%'
        }
        for i, hostel in enumerate(hostels, 1)
    ]

# Routes
@app.route('/')
def index():
    """Landing page"""
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    """Login page"""
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        user_type = request.form.get('user_type', 'student')
        
        # Mock authentication
        if username and password:
            session['user'] = username
            session['user_type'] = user_type
            
            # Redirect based on user type
            if user_type == 'admin':
                return redirect(url_for('admin_dashboard'))
            elif user_type == 'facility':
                return redirect(url_for('dashboard'))
            else:
                return redirect(url_for('student_dashboard'))
    
    return render_template('login.html')

@app.route('/logout')
def logout():
    """Logout"""
    session.clear()
    return redirect(url_for('index'))

@app.route('/dashboard')
def dashboard():
    """Main facility dashboard"""
    if 'user' not in session:
        return redirect(url_for('login'))
    
    context = {
        'user': session.get('user'),
        'total_consumption': round(random.uniform(2000, 3000), 2),
        'total_savings': round(random.uniform(500, 1000), 2),
        'active_alerts': random.randint(3, 10),
        'occupancy_rate': random.randint(60, 90)
    }
    return render_template('dashboard.html', **context)

@app.route('/student')
def student_dashboard():
    """Student dashboard"""
    if 'user' not in session:
        return redirect(url_for('login'))
    
    context = {
        'user': session.get('user'),
        'my_consumption': round(random.uniform(10, 50), 2),
        'my_savings': round(random.uniform(5, 20), 2),
        'my_rank': random.randint(1, 100),
        'my_points': random.randint(500, 2000),
        'carbon_footprint': round(random.uniform(5, 15), 2)
    }
    return render_template('student_dashboard.html', **context)

@app.route('/admin')
def admin_dashboard():
    """Admin dashboard"""
    if 'user' not in session or session.get('user_type') != 'admin':
        return redirect(url_for('login'))
    
    context = {
        'user': session.get('user'),
        'total_savings': round(random.uniform(15000, 25000), 2),
        'energy_reduction': random.randint(25, 40),
        'co2_avoided': round(random.uniform(100, 200), 2),
        'roi': random.randint(150, 200)
    }
    return render_template('admin_dashboard.html', **context)

# API Endpoints
@app.route('/api/energy/realtime')
def api_energy_realtime():
    """Real-time energy data API"""
    return jsonify({
        'status': 'success',
        'timestamp': datetime.now().isoformat(),
        'data': generate_energy_data()
    })

@app.route('/api/energy/trends')
def api_energy_trends():
    """Energy trends API"""
    days = request.args.get('days', 7, type=int)
    return jsonify({
        'status': 'success',
        'data': generate_chart_data(days)
    })

@app.route('/api/alerts')
def api_alerts():
    """Alerts API"""
    return jsonify({
        'status': 'success',
        'data': generate_alerts()
    })

@app.route('/api/leaderboard')
def api_leaderboard():
    """Leaderboard API"""
    return jsonify({
        'status': 'success',
        'data': generate_leaderboard()
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)