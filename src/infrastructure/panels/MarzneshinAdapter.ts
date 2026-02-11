import axios, { AxiosInstance } from 'axios';
import { IPanelAdapter, CreateUserInput, PanelUserInfo } from '../../core/interfaces/IPanelAdapter';
import { PanelError } from '../../core/errors';

interface MarzneshinConfig {
    url: string;
    username: string;
    password: string;
    inbounds?: string;
    onHoldEnabled?: boolean; // Enable "start on first use" strategy
}

interface MarzneshinExpireStrategy {
    type: 'never' | 'fixed_date' | 'start_on_first_use';
    expireDate?: string; // ISO 8601 format
    usageDuration?: number; // seconds for start_on_first_use
}

export class MarzneshinAdapter implements IPanelAdapter {
    private token: string | null = null;
    private tokenExpiry: number = 0;
    private client: AxiosInstance;

    constructor(private config: MarzneshinConfig) {
        this.client = axios.create({
            baseURL: config.url,
            timeout: 30000,
        });
    }

    async authenticate(): Promise<void> {
        // Check if token is still valid (10-minute cache)
        if (this.token && Date.now() < this.tokenExpiry) {
            return;
        }

        try {
            const form = new URLSearchParams({
                username: this.config.username,
                password: this.config.password,
            });

            // Marzneshin uses /api/admins/token (not /api/admin/token)
            const response = await this.client.post('/api/admins/token', form.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });

            this.token = response.data.access_token;
            // Set expiry to 10 minutes (Marzneshin tokens expire faster)
            this.tokenExpiry = Date.now() + 10 * 60 * 1000;
        } catch (error: any) {
            throw new PanelError(
                `Marzneshin authentication failed: ${error.response?.data?.detail || error.message}`,
                'Marzneshin'
            );
        }
    }

    async createUser(input: CreateUserInput): Promise<PanelUserInfo> {
        await this.authenticate();

        try {
            const payload: any = {
                username: input.username,
                data_limit: input.volume * Math.pow(1024, 3), // GB to bytes
            };

            // Marzneshin uses service_ids instead of proxies
            if (this.config.inbounds) {
                try {
                    payload.service_ids = JSON.parse(this.config.inbounds);
                } catch {
                    // If parsing fails, use empty array
                    payload.service_ids = [];
                }
            }

            // Handle expiry strategy
            const expireStrategy = this.calculateExpireStrategy(input.duration);
            payload.expire_strategy = expireStrategy.type;

            if (expireStrategy.type === 'fixed_date') {
                payload.expire_date = expireStrategy.expireDate;
            } else if (expireStrategy.type === 'start_on_first_use') {
                payload.expire_date = null;
                payload.usage_duration = expireStrategy.usageDuration;
            } else {
                // never
                payload.expire_date = null;
            }

            // Marzneshin uses /api/users (plural, not singular)
            const response = await this.client.post('/api/users', payload, {
                headers: { Authorization: `Bearer ${this.token}` },
            });

            return this.mapResponseToUserInfo(response.data);
        } catch (error: any) {
            throw new PanelError(
                `Marzneshin failed to create user: ${error.response?.data?.detail || error.message}`,
                'Marzneshin'
            );
        }
    }

    async getUser(username: string): Promise<PanelUserInfo | null> {
        await this.authenticate();

        try {
            // Marzneshin uses /api/users/{username}
            const response = await this.client.get(`/api/users/${username}`, {
                headers: { Authorization: `Bearer ${this.token}` },
            });

            return this.mapResponseToUserInfo(response.data);
        } catch (error: any) {
            if (error.response?.status === 404) {
                return null;
            }
            throw new PanelError(
                `Marzneshin failed to get user: ${error.response?.data?.detail || error.message}`,
                'Marzneshin'
            );
        }
    }

    async removeUser(username: string): Promise<void> {
        await this.authenticate();

        try {
            await this.client.delete(`/api/users/${username}`, {
                headers: { Authorization: `Bearer ${this.token}` },
            });
        } catch (error: any) {
            throw new PanelError(
                `Marzneshin failed to remove user: ${error.response?.data?.detail || error.message}`,
                'Marzneshin'
            );
        }
    }

    async modifyUser(username: string, data: Partial<CreateUserInput>): Promise<void> {
        await this.authenticate();

        try {
            const currentUser = await this.getUser(username);
            if (!currentUser) {
                throw new PanelError('User not found', 'Marzneshin');
            }

            const payload: any = {};

            if (data.volume !== undefined) {
                payload.data_limit = data.volume * Math.pow(1024, 3);
            }

            if (data.duration !== undefined) {
                // For Marzneshin, we need to recalculate the entire expiry
                const expireStrategy = this.calculateExpireStrategy(data.duration);
                payload.expire_strategy = expireStrategy.type;

                if (expireStrategy.type === 'fixed_date') {
                    payload.expire_date = expireStrategy.expireDate;
                } else if (expireStrategy.type === 'start_on_first_use') {
                    payload.usage_duration = expireStrategy.usageDuration;
                }
            }

            // Must include username in payload
            payload.username = username;

            await this.client.put(`/api/users/${username}`, payload, {
                headers: { Authorization: `Bearer ${this.token}` },
            });
        } catch (error: any) {
            throw new PanelError(
                `Marzneshin failed to modify user: ${error.response?.data?.detail || error.message}`,
                'Marzneshin'
            );
        }
    }

    async revokeSubscription(username: string): Promise<string> {
        await this.authenticate();

        try {
            const response = await this.client.post(
                `/api/users/${username}/revoke_sub`,
                {},
                {
                    headers: { Authorization: `Bearer ${this.token}` },
                }
            );

            return response.data.subscription_url || '';
        } catch (error: any) {
            throw new PanelError(
                `Marzneshin failed to revoke subscription: ${error.response?.data?.detail || error.message}`,
                'Marzneshin'
            );
        }
    }

    async resetDataUsage(username: string): Promise<void> {
        await this.authenticate();

        try {
            await this.client.post(
                `/api/users/${username}/reset`,
                {},
                {
                    headers: { Authorization: `Bearer ${this.token}` },
                }
            );
        } catch (error: any) {
            throw new PanelError(
                `Marzneshin failed to reset data usage: ${error.response?.data?.detail || error.message}`,
                'Marzneshin'
            );
        }
    }

    async getSystemStats(): Promise<any> {
        await this.authenticate();

        try {
            // Marzneshin has different endpoint for system stats
            const response = await this.client.get('/api/system/stats/users', {
                headers: { Authorization: `Bearer ${this.token}` },
            });

            return response.data;
        } catch (error: any) {
            throw new PanelError(
                `Marzneshin failed to get system stats: ${error.response?.data?.detail || error.message}`,
                'Marzneshin'
            );
        }
    }

    private calculateExpireStrategy(durationDays: number): MarzneshinExpireStrategy {
        if (durationDays === 0) {
            return { type: 'never' };
        }

        // If on-hold is enabled, use start_on_first_use
        if (this.config.onHoldEnabled) {
            return {
                type: 'start_on_first_use',
                usageDuration: durationDays * 86400, // days to seconds
            };
        }

        // Otherwise use fixed_date
        const expireTimestamp = Math.floor(Date.now() / 1000) + durationDays * 86400;
        const expireDate = new Date(expireTimestamp * 1000).toISOString();

        return {
            type: 'fixed_date',
            expireDate,
        };
    }

    private mapResponseToUserInfo(data: any): PanelUserInfo {
        // Calculate status based on multiple fields
        let status = 'active';

        if (!data.enabled) {
            status = 'disabled';
        } else if (data.expire_strategy === 'start_on_first_use') {
            status = 'on_hold';
        } else if (data.expired) {
            status = 'expired';
        } else if (data.data_limit && data.used_traffic >= data.data_limit) {
            status = 'limited';
        }

        // Convert expire_date (ISO string) to timestamp
        let expire = 0;
        if (data.expire_date) {
            expire = Math.floor(new Date(data.expire_date).getTime() / 1000);
        }

        return {
            username: data.username,
            status: status as 'active' | 'disabled' | 'limited' | 'expired' | 'on_hold',
            usedTraffic: data.used_traffic || 0,
            dataLimit: data.data_limit || 0,
            expire,
            subscriptionUrl: data.subscription_url,
        };
    }
}
