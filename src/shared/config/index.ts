import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config();

const ConfigSchema = z.object({
    // Bot
    BOT_TOKEN: z.string().min(1),
    ADMIN_CHAT_ID: z.string().min(1),

    // Database
    DATABASE_URL: z.string().min(1),

    // Redis
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.string().transform(Number).default('6379'),
    REDIS_PASSWORD: z.string().optional(),

    // Environment
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    // Settings
    MESSAGE_LIMIT_PER_MIN: z.string().transform(Number).default('10'),
    REMOVE_DAYS_AFTER_EXPIRY: z.string().transform(Number).default('7'),

    // Job Settings
    EXPIRY_WARNING_DAYS: z.string().default('1,3,7'),
    VOLUME_THRESHOLD_GB: z.string().transform(Number).default('1'),
    TEST_ACCOUNT_DURATION_HOURS: z.string().transform(Number).default('24'),
    BROADCAST_CHUNK_SIZE: z.string().transform(Number).default('30'),

    // Optional Payment Gateways
    NOWPAYMENTS_API_KEY: z.string().optional(),
    AQAYE_PARDAKHT_API_KEY: z.string().optional(),
    DIGIPAY_API_KEY: z.string().optional(),
    CARD_NUMBER: z.string().optional(),

    // Optional Report Channel
    REPORT_CHANNEL_ID: z.string().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

let _config: Config;

export function loadConfig(): Config {
    if (_config) return _config;

    try {
        _config = ConfigSchema.parse(process.env);
        return _config;
    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error('❌ Configuration error:');
            error.errors.forEach((err) => {
                console.error(`  - ${err.path.join('.')}: ${err.message}`);
            });
        }
        process.exit(1);
    }
}

// Initialize config on module load
export const config = loadConfig();
