/**
 * docs/openapi.js – OpenAPI 3.0 description of the REAL ChurnIQ endpoints in
 * routes/api.js. Served by Swagger UI at /api-docs (see app.js).
 */
const unauthorized = {
  description: 'Missing or incorrect Basic Auth credentials (and no logged-in session)',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' },
    example: { error: 'Unauthorized', message: 'Invalid credentials' } } },
};
const serverError = {
  description: 'Server error',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
};
const secured = (extra) => ({ security: [{ basicAuth: [] }], ...extra });
const json = (schema, example) => ({ 'application/json': { schema, ...(example ? { example } : {}) } });

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'ChurnIQ Customer Churn Prediction API',
    version: '1.0.0',
    description:
      'REST API behind the ChurnIQ dashboard (Node/Express + Python Random Forest ML service + MongoDB).\n\n' +
      '**Security:** every `/api` endpoint requires **HTTP Basic Authentication** ' +
      '(`Authorization: Basic base64(user:password)`). Click **Authorize** and enter the API ' +
      'credentials configured in the server environment (`BASIC_AUTH_USER` / `BASIC_AUTH_PASS`). ' +
      'Missing or wrong credentials return **401 Unauthorized**. ' +
      'The web dashboard keeps using its own login + 2FA session.',
  },
  servers: [{ url: '/', description: 'This server' }],
  tags: [
    { name: 'Prediction', description: 'Churn prediction (ML model)' },
    { name: 'Analytics', description: 'Dashboard statistics and model info' },
    { name: 'Account', description: 'Caller information' },
  ],
  security: [{ basicAuth: [] }],
  paths: {
    '/api/predict': {
      post: secured({
        tags: ['Prediction'],
        summary: 'Predict churn for one customer',
        description: 'Runs the Random Forest model (Flask ML service) and stores the prediction in MongoDB.',
        requestBody: { required: true, content: json({ $ref: '#/components/schemas/PredictRequest' }, {
          customer_id: 'API-DEMO-001', customer_name: 'Demo Customer', age: 35,
          no_of_days_subscribed: 120, multi_screen: 'No', mail_subscribed: 'No',
          weekly_mins_watched: 90, minimum_daily_mins: 5, maximum_daily_mins: 40,
          weekly_max_night_mins: 20, videos_watched: 12, maximum_days_inactive: 21,
          customer_support_calls: 5 }) },
        responses: {
          200: { description: 'Prediction result', content: json({ $ref: '#/components/schemas/Prediction' }) },
          400: { description: 'customer_id missing or invalid feature values', content: json({ $ref: '#/components/schemas/Error' }) },
          401: unauthorized, 500: serverError,
        },
      }),
    },
    '/api/predictions': {
      get: secured({
        tags: ['Prediction'], summary: 'Paginated prediction history',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1, minimum: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10, maximum: 50 } },
          { name: 'risk', in: 'query', schema: { type: 'string', enum: ['High', 'Medium', 'Low'] } },
          { name: 'churn', in: 'query', schema: { type: 'integer', enum: [0, 1] } },
          { name: 'search', in: 'query', description: 'Matches customer_id or customer_name', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Predictions with pagination', content: json({ type: 'object', properties: {
          predictions: { type: 'array', items: { $ref: '#/components/schemas/Prediction' } },
          pagination: { type: 'object', properties: { total: { type: 'integer' }, page: { type: 'integer' }, limit: { type: 'integer' }, totalPages: { type: 'integer' } } } } }) },
          401: unauthorized, 500: serverError },
      }),
    },
    '/api/predictions/{id}': {
      get: secured({
        tags: ['Prediction'], summary: 'Single prediction by MongoDB id',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Prediction', content: json({ $ref: '#/components/schemas/Prediction' }) },
          401: unauthorized, 404: { description: 'Prediction not found', content: json({ $ref: '#/components/schemas/Error' }) }, 500: serverError },
      }),
    },
    '/api/upload': {
      post: secured({
        tags: ['Prediction'], summary: 'Bulk predictions from a CSV file',
        description: 'CSV must contain customer_id, weekly_mins_watched, customer_support_calls, maximum_days_inactive.',
        requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', required: ['dataset'],
          properties: { dataset: { type: 'string', format: 'binary', description: 'CSV file' } } } } } },
        responses: { 200: { description: 'Batch summary', content: json({ type: 'object', properties: {
          message: { type: 'string' }, total: { type: 'integer' }, saved: { type: 'integer' }, errors: { type: 'integer' },
          errorDetails: { type: 'array', items: { type: 'object' } } } }) },
          400: { description: 'No file / missing columns', content: json({ $ref: '#/components/schemas/Error' }) }, 401: unauthorized, 500: serverError },
      }),
    },
    '/api/stats': {
      get: secured({ tags: ['Analytics'], summary: 'Overview KPI cards',
        responses: { 200: { description: 'KPIs', content: json({ type: 'object', properties: {
          totalCustomers: { type: 'integer' }, totalPredictions: { type: 'integer' }, highRiskCount: { type: 'integer' },
          churnedCount: { type: 'integer' }, churnRate: { type: 'string' }, churnDelta: { type: 'string', nullable: true },
          modelAccuracy: { type: 'number' }, modelName: { type: 'string' } } }) }, 401: unauthorized, 500: serverError } }),
    },
    '/api/batch-stats': {
      get: secured({ tags: ['Analytics'], summary: 'Aggregate batch prediction stats',
        responses: { 200: { description: 'Totals', content: json({ type: 'object', properties: {
          totalProcessed: { type: 'integer' }, highRiskCount: { type: 'integer' }, avgChurnRate: { type: 'string' } } }) }, 401: unauthorized, 500: serverError } }),
    },
    '/api/analytics/risk-segments': {
      get: secured({ tags: ['Analytics'], summary: 'Risk category breakdown (%)',
        responses: { 200: { description: 'Segments', content: json({ type: 'array', items: { type: 'object', properties: {
          name: { type: 'string' }, value: { type: 'integer' }, color: { type: 'string' } } } }) }, 401: unauthorized, 500: serverError } }),
    },
    '/api/analytics/feature-importance': {
      get: secured({ tags: ['Analytics'], summary: 'Feature weight rankings',
        responses: { 200: { description: 'Feature importances', content: json({ type: 'array', items: { type: 'object', properties: {
          feature: { type: 'string' }, importance: { type: 'number' } } } }) }, 401: unauthorized } }),
    },
    '/api/analytics/churn-trend': {
      get: secured({ tags: ['Analytics'], summary: 'Monthly churn vs retained (last 6 months)',
        responses: { 200: { description: 'Trend', content: json({ type: 'array', items: { type: 'object', properties: {
          name: { type: 'string' }, churn: { type: 'integer' }, retained: { type: 'integer' } } } }) }, 401: unauthorized, 500: serverError } }),
    },
    '/api/models/comparison': {
      get: secured({ tags: ['Analytics'], summary: 'Model evaluation metrics',
        responses: { 200: { description: 'Models compared', content: json({ type: 'array', items: { type: 'object', properties: {
          model: { type: 'string' }, accuracy: { type: 'number' }, precision: { type: 'number' }, recall: { type: 'number' },
          f1: { type: 'number' }, selected: { type: 'boolean' } } } }) }, 401: unauthorized } }),
    },
    '/api/me': {
      get: secured({ tags: ['Account'], summary: 'Who is calling',
        description: 'With Basic Auth returns the API username; with a dashboard session returns the logged-in user.',
        responses: { 200: { description: 'Caller', content: json({ type: 'object', properties: {
          name: { type: 'string' }, email: { type: 'string', nullable: true }, avatar: { type: 'string', nullable: true } } }) }, 401: unauthorized } }),
    },
  },
  components: {
    securitySchemes: { basicAuth: { type: 'http', scheme: 'basic', description: 'API credentials from BASIC_AUTH_USER / BASIC_AUTH_PASS' } },
    schemas: {
      Error: { type: 'object', properties: { error: { type: 'string' }, message: { type: 'string' } } },
      PredictRequest: { type: 'object', required: ['customer_id'], properties: {
        customer_id: { type: 'string' }, customer_name: { type: 'string' }, age: { type: 'number' },
        no_of_days_subscribed: { type: 'number' }, multi_screen: { type: 'string', enum: ['Yes', 'No'] },
        mail_subscribed: { type: 'string', enum: ['Yes', 'No'] }, weekly_mins_watched: { type: 'number' },
        minimum_daily_mins: { type: 'number' }, maximum_daily_mins: { type: 'number' }, weekly_max_night_mins: { type: 'number' },
        videos_watched: { type: 'number' }, maximum_days_inactive: { type: 'number' }, customer_support_calls: { type: 'number' } } },
      Prediction: { type: 'object', properties: {
        _id: { type: 'string' }, customer_id: { type: 'string' }, customer_name: { type: 'string' },
        churn_prediction: { type: 'integer', enum: [0, 1] }, churn_probability: { type: 'number' },
        risk_category: { type: 'string', enum: ['High', 'Medium', 'Low'] },
        churn_reasons: { type: 'array', items: { type: 'string' } },
        recommended_strategies: { type: 'array', items: { type: 'string' } },
        model_used: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' } } },
    },
  },
};
