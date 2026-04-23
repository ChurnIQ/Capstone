# Retention strategies mapping
STRATEGIES = {
    'High':   'Personal retention call + exclusive loyalty discount within 24h',
    'Medium': 'Targeted email campaign + feature highlight nudge',
    'Low':    'Routine check-in + monthly newsletter engagement',
}

# Function to categorize risk based on churn probability
def risk_category(probability: float) -> str:
    if probability >= 0.70:
        return 'High'
    if probability >= 0.40:
        return 'Medium'
    return 'Low'

# Function to generate retention strategy output
def get_retention_strategy(probability: float) -> dict:
    risk = risk_category(probability)
    return {
        'risk_category': risk,
        'recommended_strategy': STRATEGIES[risk]
    }
# Map churn risk to actionable retention strategies
# Customize strategies based on user behavior