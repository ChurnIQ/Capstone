import hmac
import os
from pathlib import Path
from flask import Flask, request, jsonify
from ml.predict import PredictionEngine

model_dir = Path(__file__).resolve().parent.parent / 'ml'
os.environ.setdefault('MODEL_PATH', str(model_dir / 'model.pkl'))
os.environ.setdefault('SCALER_PATH', str(model_dir / 'scaler.pkl'))
app = Flask(__name__)
engine = PredictionEngine()

@app.before_request
def authorize():
    secret = os.environ.get('SESSION_SECRET', '')
    if not secret or not hmac.compare_digest(request.headers.get('X-ML-Secret', ''), secret):
        return jsonify(error='Unauthorized'), 401

@app.route('/internal-ml/predict', methods=['POST'])
def predict():
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or not data:
        return jsonify(error='Expected a customer record'), 400
    try:
        return jsonify(engine.predict(data))
    except (ValueError, TypeError):
        return jsonify(error='Invalid customer features'), 400

@app.route('/internal-ml/model-info')
@app.route('/internal-ml/health')
def info():
    return jsonify(status='ok', **engine.model_info())
