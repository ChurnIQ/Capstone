from flask import Flask, request, jsonify
from predict import PredictionEngine

app = Flask(__name__)

# Load model once at startup
engine = PredictionEngine()


# ── Health check ──────────────────────────────────────────────────────────────
@app.route('/health')
def health():
    return jsonify({'status': 'ok', **engine.model_info()})


# ── Single prediction ─────────────────────────────────────────────────────────
# POST /predict
# Body: { customer_id?, age, no_of_days_subscribed, multi_screen, mail_subscribed,
#         weekly_mins_watched, minimum_daily_mins, maximum_daily_mins,
#         weekly_max_night_mins, videos_watched, maximum_days_inactive,
#         customer_support_calls }
@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json(force=True, silent=True)
    if not data:
        return jsonify({'error': 'Invalid or missing JSON body'}), 400
    try:
        return jsonify(engine.predict(data))
    except Exception as exc:
        return jsonify({'error': str(exc)}), 500


# ── Batch prediction ──────────────────────────────────────────────────────────
# POST /predict/batch
# Body: [ { customer_id, ...features }, ... ]
@app.route('/predict/batch', methods=['POST'])
def predict_batch():
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, list):
        return jsonify({'error': 'Expected a JSON array of customer records'}), 400
    try:
        return jsonify(engine.predict_batch(data))
    except Exception as exc:
        return jsonify({'error': str(exc)}), 500


# ── Feature importance ────────────────────────────────────────────────────────
@app.route('/feature-importance')
def feature_importance():
    return jsonify(engine.feature_importance())


# ── Model metadata ────────────────────────────────────────────────────────────
@app.route('/model-info')
def model_info():
    return jsonify(engine.model_info())


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
