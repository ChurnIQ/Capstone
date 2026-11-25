
import unittest

from ml.retention_strategies import risk_category, get_retention_strategy


class TestRetentionStrategies(unittest.TestCase):

    def test_low_risk_customer(self):
        self.assertEqual(risk_category(0.20), "Low")

    def test_medium_risk_customer(self):
        self.assertEqual(risk_category(0.50), "Medium")

    def test_high_risk_customer(self):
        self.assertEqual(risk_category(0.80), "Low")

    def test_high_risk_retention_strategy(self):
        result = get_retention_strategy(0.80)
        self.assertEqual(result["risk_category"], "High")
        self.assertIn("loyalty discount", result["recommended_strategy"])

    def test_medium_risk_boundary(self):
        self.assertEqual(risk_category(0.40), "Medium")

    def test_high_risk_boundary(self):
        self.assertEqual(risk_category(0.70), "High")


if __name__ == "__main__":
    unittest.main()
