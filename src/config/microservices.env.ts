
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const microservicesEnv = {
  // Service configuration
  services: {
    gateway: {
      port: parseInt(process.env.GATEWAY_PORT || '4000', 10),
      url: process.env.GATEWAY_URL || 'http://localhost:4000'
    },
    auth: {
      port: parseInt(process.env.AUTH_SERVICE_PORT || '4001', 10),
      url: process.env.AUTH_SERVICE_URL || 'http://localhost:4001'
    },
    content: {
      port: parseInt(process.env.CONTENT_SERVICE_PORT || '4002', 10),
      url: process.env.CONTENT_SERVICE_URL || 'http://localhost:4002'
    },
    website: {
      port: parseInt(process.env.WEBSITE_SERVICE_PORT || '4003', 10),
      url: process.env.WEBSITE_SERVICE_URL || 'http://localhost:4003'
    },
    user: {
      port: parseInt(process.env.USER_SERVICE_PORT || '4004', 10),
      url: process.env.USER_SERVICE_URL || 'http://localhost:4004'
    }
  },

  // Redis configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD,
    ttl: parseInt(process.env.REDIS_TTL || '3600', 10)
  },

  // Security configuration
  security: {
    enableRequestSignature: process.env.ENABLE_REQUEST_SIGNATURE === 'true',
    signatureAlgorithm: process.env.SIGNATURE_ALGORITHM || 'sha256',
    maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb',
    blockedIPs: process.env.BLOCKED_IPS ? process.env.BLOCKED_IPS.split(',') : [],
    enableAdvancedSecurity: process.env.ENABLE_ADVANCED_SECURITY === 'true'
  },

  // Monitoring configuration
  monitoring: {
    enableHealthChecks: process.env.ENABLE_HEALTH_CHECKS === 'true',
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10),
    prometheusEnabled: process.env.PROMETHEUS_ENABLED === 'true',
    prometheusPort: parseInt(process.env.PROMETHEUS_PORT || '9090', 10)
  },

  // Feature flags
  features: {
    enableApiVersioning: process.env.ENABLE_API_VERSIONING === 'true',
    enableSwaggerDocs: process.env.ENABLE_SWAGGER_DOCS === 'true',
    enableMetricsCollection: process.env.ENABLE_METRICS_COLLECTION === 'true',
    enableAuditLogging: process.env.ENABLE_AUDIT_LOGGING === 'true',
    enableMockServices: process.env.ENABLE_MOCK_SERVICES === 'true'
  },

  // Logging configuration
  logging: {
    enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING === 'true',
    enableSecurityLogging: process.env.ENABLE_SECURITY_LOGGING === 'true',
    enableDebugLogging: process.env.ENABLE_DEBUG_LOGGING === 'true'
  }
};

// Validation function
export const validateMicroservicesConfig = (): string[] => {
  const errors: string[] = [];

  // Validate required environment variables
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-super-strong-jwt-secret-key-change-this-in-production-256-bits-minimum') {
    errors.push('JWT_SECRET must be set to a strong, unique value in production');
  }

  if (!process.env.MONGODB_URI) {
    errors.push('MONGODB_URI is required');
  }

  if (process.env.NODE_ENV === 'production') {
    if (!process.env.REDIS_PASSWORD) {
      errors.push('REDIS_PASSWORD is required in production');
    }

    if (!process.env.CORS_ALLOWED_ORIGINS) {
      errors.push('CORS_ALLOWED_ORIGINS must be set in production');
    }
  }

  return errors;
};

// Initialize and validate configuration
const configErrors = validateMicroservicesConfig();
if (configErrors.length > 0) {
  console.error('❌ Configuration errors:');
  configErrors.forEach(error => console.error(`  - ${error}`));
  
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

export default microservicesEnv;