import os
import joblib
import numpy as np
import pandas as pd

FEATURES = [
    'age',
    'no_of_days_subscribed',
    'multi_screen',
    'mail_subscribed',
    'weekly_mins_watched',
    'minimum_daily_mins',
    'maximum_daily_mins',
    'weekly_max_night_mins',
    'videos_watched',
    'maximum_days_inactive',
    'customer_support_calls',
]

# Risk-based fallback strategies (used when no specific reasons are detected)
STRATEGIES = {
    'High':   'Personal retention call + exclusive loyalty discount within 24h',
    'Medium': 'Targeted email campaign + feature highlight nudge',
    'Low':    'Routine check-in + monthly newsletter engagement',
}


class PredictionEngine:
    def __init__(self):
        model_path  = os.environ.get('MODEL_PATH',  'model.pkl')
        scaler_path = os.environ.get('SCALER_PATH', 'scaler.pkl')

        if not os.path.exists(model_path):
            raise FileNotFoundError(
                f"Model file not found at '{model_path}'. "
                "Run train.py first or set MODEL_PATH to your .pkl file."
            )

        self.model      = joblib.load(model_path)
        self.model_name = type(self.model).__name__   # cached at startup
        self.scaler     = joblib.load(scaler_path) if os.path.exists(scaler_path) else None

    # ── Preprocessing ─────────────────────────────────────────────────────────

    @staticmethod
    def _bool_field(value):
        return 1 if str(value).strip().lower() in ('yes', '1', 'true') else 0

    def _preprocess(self, data: dict):
        """Returns (scaled DataFrame, raw row dict) for inference and reason detection."""
        row = {
            'age':                    float(data.get('age', 30)),
            'no_of_days_subscribed':  float(data.get('no_of_days_subscribed', 180)),
            'multi_screen':           self._bool_field(data.get('multi_screen', 'no')),
            'mail_subscribed':        self._bool_field(data.get('mail_subscribed', 'no')),
            'weekly_mins_watched':    float(data.get('weekly_mins_watched', 120)),
            'minimum_daily_mins':     float(data.get('minimum_daily_mins', 10)),
            'maximum_daily_mins':     float(data.get('maximum_daily_mins', 60)),
            'weekly_max_night_mins':  float(data.get('weekly_max_night_mins', 30)),
            'videos_watched':         float(data.get('videos_watched', 30)),
            'maximum_days_inactive':  float(data.get('maximum_days_inactive', 0)),
            'customer_support_calls': float(data.get('customer_support_calls', 0)),
        }
        X = pd.DataFrame([row], columns=FEATURES)
        if self.scaler:
            X = pd.DataFrame(self.scaler.transform(X), columns=FEATURES)
        return X, row

    @staticmethod
    def _risk_category(probability: float) -> str:
        if probability >= 0.70:
            return 'High'
        if probability >= 0.40:
            return 'Medium'
        return 'Low'

    # ── Churn reason engine ───────────────────────────────────────────────────

    def _identify_reasons(self, row: dict) -> list:
        reasons = []
        if row['maximum_days_inactive'] > 7:
            reasons.append('High inactivity')
        if row['weekly_mins_watched'] < 60:
            reasons.append('Low engagement')
        if row['customer_support_calls'] > 3:
            reasons.append('Frequent complaints')
        if row['mail_subscribed'] == 0:
            reasons.append('Not receiving updates')
        if row['multi_screen'] == 0:
            reasons.append('Limited feature usage')
        return reasons

    def _generate_strategies(self, reasons: list, risk: str) -> list:
        mapping = {
            'High inactivity':       'Send re-engagement offer + personalized recommendations',
            'Low engagement':        'Recommend trending content + push notifications',
            'Frequent complaints':   'Priority customer support + issue resolution call',
            'Not receiving updates': 'Enable email subscription + targeted campaigns',
            'Limited feature usage': 'Promote multi-screen benefits + free trial upgrade',
        }
        strategies = [mapping[r] for r in reasons if r in mapping]
        # Fallback to risk-tier strategy when no specific reasons detected
        if not strategies:
            strategies = [STRATEGIES[risk]]
        return strategies

    # ── Public API ────────────────────────────────────────────────────────────

    def predict(self, data: dict) -> dict:
        X, row      = self._preprocess(data)
        probability = self.model.predict_proba(X)[0][1]
        risk        = self._risk_category(probability)
        reasons     = self._identify_reasons(row)
        strategies  = self._generate_strategies(reasons, risk)

        result = {
            'churn_prediction':       int(probability >= 0.5),
            'churn_probability':      round(float(probability), 4),
            'risk_category':          risk,
            'churn_reasons':          reasons,
            'recommended_strategies': strategies,
            'recommended_strategy':   STRATEGIES[risk],  # singular — backward compat
        }
        if data.get('customer_id') is not None:
            result['customer_id'] = data['customer_id']
        return result

    def predict_batch(self, records: list) -> list:
        results = []
        for record in records:
            try:
                results.append(self.predict(record))
            except Exception as exc:
                results.append({
                    'customer_id': record.get('customer_id'),
                    'error': str(exc),
                })
        return results

    def feature_importance(self) -> list:
        if not hasattr(self.model, 'feature_importances_'):
            return []
        pairs = zip(FEATURES, self.model.feature_importances_)
        return [
            {'feature': f, 'importance': round(float(i), 4)}
            for f, i in sorted(pairs, key=lambda x: -x[1])
        ]

    def model_info(self) -> dict:
        return {
            'model_name': self.model_name,
            'features':   FEATURES,
            'has_scaler': self.scaler is not None,
        }
