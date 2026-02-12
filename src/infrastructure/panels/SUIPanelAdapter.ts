import axios, { AxiosInstance } from 'axios';
import { IPanelAdapter, CreateUserInput, PanelUserInfo } from '../../core/interfaces/IPanelAdapter';
import { PanelError } from '../../core/errors';

interface SUIPanelConfig {
    url: string;
    username: string;
    password: string;
    inbounds?: string;
    inboundId?: string;
}

interface SUIPanelLoginResponse {
    success: boolean;
    msg?: string;
    obj?: string; // Session token
}

export class SUIPanelAdapter implements IPanelAdapter {
    private sessionToken: string | null = null;
    private tokenExpiry: number = 0;
    private client: AxiosInstance;

    constructor(private config: SUIPanelConfig) {
        this.client = axios.create({
            baseURL: config.url,
            timeout: 60000, // Increased to 60 seconds
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    async authenticate(): Promise<void> {
        const now = Date.now();

        // Check if token is still valid (expires after 50 minutes)
        if (this.sessionToken && now < this.tokenExpiry) {
            return;
        }

        try {
            const response = await this.client.post<SUIPanelLoginResponse>('/api/login', {
                username: this.config.username,
                password: this.config.password,
            });

            if (!response.data.success || !response.data.obj) {
                throw new PanelError('S-UI Panel authentication failed');
            }

            this.sessionToken = response.data.obj;
            this.tokenExpiry = now + 50 * 60 * 1000; // 50 minutes
        } catch (error: any) {
            if (error instanceof PanelError) throw error;
            throw new PanelError(`S-UI Panel authentication error: ${error.message}`);
        }
    }

    private async request<T>(method: string, endpoint: string, data?: any): Promise<T> {
        await this.authenticate();

        try {
            const response = await this.client.request<T>({
                method,
                url: endpoint,
                data,
                headers: {
                    Authorization: `Bearer ${this.sessionToken}`,
                },
            });

            return response.data;
        } catch (error: any) {
            throw new PanelError(`S-UI Panel API error: ${error.message}`);
        }
    }

    async createUser(input: CreateUserInput): Promise<PanelUserInfo> {
        const inboundId = this.config.inboundId || '1';

        // Calculate expiry time (Unix timestamp in seconds)
        const expiryTime = input.duration > 0
            ? Math.floor((Date.now() + input.duration * 24 * 60 * 60 * 1000) / 1000)
            : 0;

        const totalGB = input.volume * 1024 * 1024 * 1024; // GB to bytes

        const clientData = {
            inbound_id: parseInt(inboundId),
            email: input.username,
            uuid: this.generateUUID(),
            enable: true,
            flow: '',
            limit_ip: 0,
            total_gb: totalGB,
            expire_time: expiryTime * 1000, // milliseconds
            telegram_id: '',
            subscription_id: this.generateRandomString(16),
        };

        try {
            const response = await this.request<any>(
                'POST',
                '/api/panel/inbound/addClient',
                clientData
            );

            if (!response.success) {
                throw new PanelError(`S-UI Panel: Failed to create user - ${response.msg}`);
            }

            // Build subscription URL
            const subscriptionUrl = `${this.config.url}/sub/${clientData.subscription_id}`;

            return {
                username: input.username,
                expire: expiryTime,
                dataLimit: totalGB,
                usedTraffic: 0,
                subscriptionUrl,
                status: 'active',
            };
        } catch (error: any) {
            if (error instanceof PanelError) throw error;
            throw new PanelError(`S-UI Panel createUser error: ${error.message}`);
        }
    }

    async getUser(username: string): Promise<PanelUserInfo | null> {
        try {
            const response = await this.request<any>('GET', '/api/panel/inbound/list');

            if (!response.success) {
                throw new PanelError('S-UI Panel: Failed to fetch inbounds');
            }

            // Search for user in all inbounds
            for (const inbound of response.obj || []) {
                const client = inbound.clientStats?.find((c: any) => c.email === username);

                if (client) {
                    return {
                        username: client.email,
                        expire: Math.floor(client.expiryTime / 1000),
                        dataLimit: client.totalGB || 0,
                        usedTraffic: (client.up || 0) + (client.down || 0),
                        subscriptionUrl: `${this.config.url}/sub/${client.subId}`,
                        status: client.enable ? 'active' : 'disabled',
                    };
                }
            }

            return null;
        } catch (error: any) {
            if (error instanceof PanelError) throw error;
            throw new PanelError(`S-UI Panel getUser error: ${error.message}`);
        }
    }

    async removeUser(username: string): Promise<void> {
        try {
            const inboundId = this.config.inboundId || '1';

            await this.request('POST', `/api/panel/inbound/${inboundId}/delClient`, {
                email: username,
            });
        } catch (error: any) {
            throw new PanelError(`S-UI Panel removeUser error: ${error.message}`);
        }
    }

    async modifyUser(username: string, data: Partial<CreateUserInput>): Promise<void> {
        const user = await this.getUser(username);
        if (!user) {
            throw new PanelError(`S-UI Panel: User ${username} not found`);
        }

        const inboundId = this.config.inboundId || '1';

        const updateData: any = {
            inbound_id: parseInt(inboundId),
            email: username,
        };

        if (data.volume !== undefined) {
            updateData.total_gb = data.volume * 1024 * 1024 * 1024;
        }

        if (data.duration !== undefined) {
            updateData.expire_time = (Date.now() + data.duration * 24 * 60 * 60 * 1000);
        }

        try {
            await this.request('POST', `/api/panel/inbound/updateClient`, updateData);
        } catch (error: any) {
            throw new PanelError(`S-UI Panel modifyUser error: ${error.message}`);
        }
    }

    async revokeSubscription(username: string): Promise<string> {
        const user = await this.getUser(username);
        if (!user) {
            throw new PanelError(`S-UI Panel: User ${username} not found`);
        }

        const inboundId = this.config.inboundId || '1';

        try {
            await this.request('POST', `/api/panel/inbound/updateClient`, {
                inbound_id: parseInt(inboundId),
                email: username,
                enable: false,
            });

            return `User ${username} has been disabled`;
        } catch (error: any) {
            throw new PanelError(`S-UI Panel revokeSubscription error: ${error.message}`);
        }
    }

    async resetDataUsage(username: string): Promise<void> {
        const inboundId = this.config.inboundId || '1';

        try {
            await this.request('POST', `/api/panel/inbound/${inboundId}/resetClientTraffic`, {
                email: username,
            });
        } catch (error: any) {
            throw new PanelError(`S-UI Panel resetDataUsage error: ${error.message}`);
        }
    }

    private generateUUID(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    private generateRandomString(length: number): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
}
