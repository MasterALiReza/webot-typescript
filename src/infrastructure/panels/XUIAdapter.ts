import axios, { AxiosInstance } from 'axios';
import { IPanelAdapter, CreateUserInput, PanelUserInfo } from '../../core/interfaces/IPanelAdapter';
import { PanelError } from '../../core/errors';

interface XUIConfig {
    url: string;
    username: string;
    password: string;
    inbounds?: string;
    inboundId?: string;
}

interface XUILoginResponse {
    success: boolean;
    msg: string;
    obj: {
        token?: string;
    };
}

export class XUIAdapter implements IPanelAdapter {
    private sessionCookie: string | null = null;
    private cookieExpiry: number = 0;
    private client: AxiosInstance;

    constructor(private config: XUIConfig) {
        this.client = axios.create({
            baseURL: config.url,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
    }

    async authenticate(): Promise<void> {
        const now = Date.now();

        // Check if session is still valid (expires after 50 minutes)
        if (this.sessionCookie && now < this.cookieExpiry) {
            return;
        }

        try {
            const params = new URLSearchParams();
            params.append('username', this.config.username);
            params.append('password', this.config.password);

            const response = await this.client.post<XUILoginResponse>('/login', params);

            if (!response.data.success) {
                throw new PanelError('X-UI authentication failed: ' + response.data.msg);
            }

            // Extract session cookie from Set-Cookie header
            const setCookie = response.headers['set-cookie'];
            if (setCookie && setCookie.length > 0) {
                this.sessionCookie = setCookie[0].split(';')[0];
                this.cookieExpiry = now + 50 * 60 * 1000; // 50 minutes
            } else {
                throw new PanelError('X-UI: No session cookie received');
            }
        } catch (error: any) {
            if (error instanceof PanelError) throw error;
            throw new PanelError(`X-UI authentication error: ${error.message}`);
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
                    Cookie: this.sessionCookie || '',
                },
            });

            return response.data;
        } catch (error: any) {
            throw new PanelError(`X-UI API error: ${error.message}`);
        }
    }

    async createUser(input: CreateUserInput): Promise<PanelUserInfo> {
        const inboundId = this.config.inboundId ? parseInt(this.config.inboundId) : 1;

        // Calculate expiry time (current time + duration in days)
        const expiryTime = input.duration > 0
            ? Date.now() + input.duration * 24 * 60 * 60 * 1000
            : 0;

        const totalGB = input.volume * 1024 * 1024 * 1024; // GB to bytes

        const clientData = {
            id: inboundId,
            settings: JSON.stringify({
                clients: [{
                    id: this.generateUUID(),
                    email: input.username,
                    limitIp: 0,
                    totalGB: totalGB,
                    expiryTime: expiryTime,
                    enable: true,
                    tgId: '',
                    subId: this.generateRandomString(16),
                }],
            }),
        };

        try {
            const response = await this.request<any>(
                'POST',
                `/panel/api/inbounds/addClient`,
                clientData
            );

            if (!response.success) {
                throw new PanelError(`X-UI: Failed to create user - ${response.msg}`);
            }

            // Build subscription URL
            const subscriptionUrl = `${this.config.url}/sub/${clientData.settings}`;

            return {
                username: input.username,
                expire: Math.floor(expiryTime / 1000),
                dataLimit: totalGB,
                usedTraffic: 0,
                subscriptionUrl,
                status: 'active',
            };
        } catch (error: any) {
            if (error instanceof PanelError) throw error;
            throw new PanelError(`X-UI createUser error: ${error.message}`);
        }
    }

    async getUser(username: string): Promise<PanelUserInfo | null> {
        try {
            const response = await this.request<any>('GET', '/panel/api/inbounds/list');

            if (!response.success) {
                throw new PanelError('X-UI: Failed to fetch inbounds');
            }

            // Search for user in all inbounds
            for (const inbound of response.obj || []) {
                const settings = JSON.parse(inbound.settings);
                const client = settings.clients?.find((c: any) => c.email === username);

                if (client) {
                    return {
                        username: client.email,
                        expire: Math.floor(client.expiryTime / 1000),
                        dataLimit: client.totalGB,
                        usedTraffic: client.up + client.down,
                        subscriptionUrl: `${this.config.url}/sub/${client.subId}`,
                        status: client.enable ? 'active' : 'disabled',
                    };
                }
            }

            return null;
        } catch (error: any) {
            if (error instanceof PanelError) throw error;
            throw new PanelError(`X-UI getUser error: ${error.message}`);
        }
    }

    async removeUser(username: string): Promise<void> {
        try {
            const inboundId = this.config.inboundId ? parseInt(this.config.inboundId) : 1;

            await this.request('POST', `/panel/api/inbounds/${inboundId}/delClient/${username}`, {});
        } catch (error: any) {
            throw new PanelError(`X-UI removeUser error: ${error.message}`);
        }
    }

    async modifyUser(username: string, data: Partial<CreateUserInput>): Promise<void> {
        // X-UI requires fetching the user first, then updating
        const user = await this.getUser(username);
        if (!user) {
            throw new PanelError(`X-UI: User ${username} not found`);
        }

        const inboundId = this.config.inboundId ? parseInt(this.config.inboundId) : 1;

        const updateData: any = {
            id: inboundId,
            email: username,
        };

        if (data.volume !== undefined) {
            updateData.totalGB = data.volume * 1024 * 1024 * 1024;
        }

        if (data.duration !== undefined) {
            updateData.expiryTime = Date.now() + data.duration * 24 * 60 * 60 * 1000;
        }

        try {
            await this.request('POST', `/panel/api/inbounds/updateClient/${username}`, updateData);
        } catch (error: any) {
            throw new PanelError(`X-UI modifyUser error: ${error.message}`);
        }
    }

    async revokeSubscription(username: string): Promise<string> {
        // Disable the user
        const user = await this.getUser(username);
        if (!user) {
            throw new PanelError(`X-UI: User ${username} not found`);
        }

        const inboundId = this.config.inboundId ? parseInt(this.config.inboundId) : 1;

        try {
            await this.request('POST', `/panel/api/inbounds/updateClient/${username}`, {
                id: inboundId,
                email: username,
                enable: false,
            });

            return `User ${username} has been disabled`;
        } catch (error: any) {
            throw new PanelError(`X-UI revokeSubscription error: ${error.message}`);
        }
    }

    async resetDataUsage(username: string): Promise<void> {
        const inboundId = this.config.inboundId ? parseInt(this.config.inboundId) : 1;

        try {
            await this.request('POST', `/panel/api/inbounds/${inboundId}/resetClientTraffic/${username}`, {});
        } catch (error: any) {
            throw new PanelError(`X-UI resetDataUsage error: ${error.message}`);
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
