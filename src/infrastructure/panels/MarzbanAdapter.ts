import axios, { AxiosInstance } from 'axios';
import { IPanelAdapter, CreateUserInput, PanelUserInfo } from '../../core/interfaces/IPanelAdapter';
import { PanelError } from '../../core/errors';

interface MarzbanConfig {
    url: string;
    username: string;
    password: string;
    inbounds?: string;
}

export class MarzbanAdapter implements IPanelAdapter {
    private token: string | null = null;
    private tokenExpiry: number = 0;
    private client: AxiosInstance;

    constructor(private config: MarzbanConfig) {
        this.client = axios.create({
            baseURL: config.url,
            timeout: 60000, // Increased to 60 seconds
            maxRedirects: 5,
            validateStatus: (status) => status >= 200 && status < 500,
        });
    }

    async authenticate(): Promise<void> {
        // Check if token is still valid
        if (this.token && Date.now() < this.tokenExpiry) {
            return;
        }

        try {
            const form = new URLSearchParams({
                username: this.config.username,
                password: this.config.password,
            });

            const response = await this.client.post('/api/admin/token', form.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });

            this.token = response.data.access_token;
            // Set expiry to 50 minutes (tokens usually valid for 60 minutes)
            this.tokenExpiry = Date.now() + 50 * 60 * 1000;
        } catch (error: any) {
            throw new PanelError(
                `Authentication failed: ${error.response?.data?.detail || error.message}`,
                'Marzban'
            );
        }
    }

    async createUser(input: CreateUserInput): Promise<PanelUserInfo> {
        await this.authenticate();

        try {
            const expire = Math.floor(Date.now() / 1000) + input.duration * 86400;
            const dataLimit = input.volume * Math.pow(1024, 3); // GB to bytes

            const payload: any = {
                username: input.username,
                data_limit: dataLimit,
                expire,
                status: 'active',
                proxies: { vmess: {}, vless: {} },
            };

            if (input.inbounds) {
                try {
                    payload.inbounds = JSON.parse(input.inbounds);
                } catch {
                    // If parsing fails, use default inbounds
                }
            }

            const response = await this.client.post('/api/user', payload, {
                headers: { Authorization: `Bearer ${this.token}` },
            });

            return this.mapResponseToUserInfo(response.data);
        } catch (error: any) {
            throw new PanelError(
                `Failed to create user: ${error.response?.data?.detail || error.message}`,
                'Marzban'
            );
        }
    }

    async getUser(username: string): Promise<PanelUserInfo | null> {
        await this.authenticate();

        try {
            const response = await this.client.get(`/api/user/${username}`, {
                headers: { Authorization: `Bearer ${this.token}` },
            });

            return this.mapResponseToUserInfo(response.data);
        } catch (error: any) {
            if (error.response?.status === 404) {
                return null;
            }
            throw new PanelError(
                `Failed to get user: ${error.response?.data?.detail || error.message}`,
                'Marzban'
            );
        }
    }

    async removeUser(username: string): Promise<void> {
        await this.authenticate();

        try {
            await this.client.delete(`/api/user/${username}`, {
                headers: { Authorization: `Bearer ${this.token}` },
            });
        } catch (error: any) {
            throw new PanelError(
                `Failed to remove user: ${error.response?.data?.detail || error.message}`,
                'Marzban'
            );
        }
    }

    async modifyUser(username: string, data: Partial<CreateUserInput>): Promise<void> {
        await this.authenticate();

        try {
            const currentUser = await this.getUser(username);
            if (!currentUser) {
                throw new PanelError('User not found', 'Marzban');
            }

            const payload: any = {};

            if (data.volume !== undefined) {
                payload.data_limit = data.volume * Math.pow(1024, 3);
            }

            if (data.duration !== undefined) {
                // Add duration to current expiry
                const currentExpiry = currentUser.expire;
                const additionalSeconds = data.duration * 86400;
                payload.expire = Math.max(currentExpiry, Math.floor(Date.now() / 1000)) + additionalSeconds;
            }

            await this.client.put(`/api/user/${username}`, payload, {
                headers: { Authorization: `Bearer ${this.token}` },
            });
        } catch (error: any) {
            throw new PanelError(
                `Failed to modify user: ${error.response?.data?.detail || error.message}`,
                'Marzban'
            );
        }
    }

    async revokeSubscription(username: string): Promise<string> {
        await this.authenticate();

        try {
            const response = await this.client.post(
                `/api/user/${username}/revoke_sub`,
                {},
                {
                    headers: { Authorization: `Bearer ${this.token}` },
                }
            );

            return response.data.subscription_url || '';
        } catch (error: any) {
            throw new PanelError(
                `Failed to revoke subscription: ${error.response?.data?.detail || error.message}`,
                'Marzban'
            );
        }
    }

    async resetDataUsage(username: string): Promise<void> {
        await this.authenticate();

        try {
            await this.client.post(
                `/api/user/${username}/reset`,
                {},
                {
                    headers: { Authorization: `Bearer ${this.token}` },
                }
            );
        } catch (error: any) {
            throw new PanelError(
                `Failed to reset data usage: ${error.response?.data?.detail || error.message}`,
                'Marzban'
            );
        }
    }

    async getSystemStats(): Promise<any> {
        await this.authenticate();

        try {
            const response = await this.client.get('/api/system', {
                headers: { Authorization: `Bearer ${this.token}` },
            });

            return response.data;
        } catch (error: any) {
            throw new PanelError(
                `Failed to get system stats: ${error.response?.data?.detail || error.message}`,
                'Marzban'
            );
        }
    }

    private mapResponseToUserInfo(data: any): PanelUserInfo {
        return {
            username: data.username,
            status: data.status || 'active',
            usedTraffic: data.used_traffic || 0,
            dataLimit: data.data_limit || 0,
            expire: data.expire || 0,
            subscriptionUrl: data.subscription_url,
        };
    }
}
