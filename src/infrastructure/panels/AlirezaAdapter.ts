import axios, { AxiosInstance } from 'axios';
import { IPanelAdapter, CreateUserInput, PanelUserInfo } from '../../core/interfaces/IPanelAdapter';
import { PanelError } from '../../core/errors';

interface AlirezaConfig {
    url: string;
    username: string;
    password: string;
    inbounds?: string;
    inboundId?: string;
}

interface AlirezaLoginResponse {
    success: boolean;
    msg: string;
    obj?: {
        sessionId?: string;
    };
}

/**
 * Alireza X-UI Adapter
 * 
 * Alireza is a variant/fork of 3x-ui compatible with the original x-ui API structure.
 * Uses cookie-based authentication like the original PHP implementation.
 * 
 * API Endpoints (based on original botmirzapanel):
 * - Login: /login (POST with form data)
 * - Get inbounds: /xui/API/inbounds (GET)
 * - Add client: /xui/API/inbounds/addClient (POST)
 * - Update client: /xui/API/inbounds/updateClient/{uuid} (POST)
 * - Delete client: /xui/API/inbounds/{inboundId}/delClient/{email} (POST)
 * - Reset traffic: /xui/API/inbounds/{inboundId}/resetClientTraffic/{email} (POST)
 * - Get client traffic: /xui/API/inbounds/getClientTraffics/{email} (GET)
 */
export class AlirezaAdapter implements IPanelAdapter {
    private sessionCookie: string | null = null;
    private sessionExpiry: number = 0;
    private client: AxiosInstance;

    constructor(private config: AlirezaConfig) {
        this.client = axios.create({
            baseURL: config.url,
            timeout: 60000, // Increased to 60 seconds
        });
    }

    async authenticate(): Promise<void> {
        const now = Date.now();

        // Check if session is still valid (expires after 55 minutes)
        if (this.sessionCookie && now < this.sessionExpiry) {
            return;
        }

        try {
            const params = new URLSearchParams();
            params.append('username', this.config.username);
            params.append('password', this.config.password);

            const response = await this.client.post<AlirezaLoginResponse>('/login', params, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });

            if (!response.data.success) {
                throw new PanelError('Alireza authentication failed: ' + response.data.msg);
            }

            // Extract session cookie from Set-Cookie header (like original implementation)
            const setCookie = response.headers['set-cookie'];
            if (setCookie && setCookie.length > 0) {
                this.sessionCookie = setCookie[0].split(';')[0];
                this.sessionExpiry = now + 55 * 60 * 1000; // 55 minutes
            } else {
                throw new PanelError('Alireza: No session cookie received');
            }
        } catch (error: any) {
            if (error instanceof PanelError) throw error;
            throw new PanelError(`Alireza authentication error: ${error.message}`);
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
                    'Cookie': this.sessionCookie || '',
                    'Content-Type': 'application/json',
                },
            });

            return response.data;
        } catch (error: any) {
            throw new PanelError(`Alireza API error: ${error.message}`);
        }
    }

    async createUser(input: CreateUserInput): Promise<PanelUserInfo> {
        const inboundId = this.config.inboundId ? parseInt(this.config.inboundId) : 1;

        // Calculate expiry time
        const expiryTime = input.duration > 0
            ? Date.now() + input.duration * 24 * 60 * 60 * 1000
            : 0;

        const totalGB = input.volume * 1024 * 1024 * 1024; // GB to bytes

        // Generate UUID for client
        const uuid = this.generateUUID();

        const clientData = {
            id: inboundId,
            settings: JSON.stringify({
                clients: [{
                    id: uuid,
                    flow: '',
                    email: input.username,
                    totalGB: totalGB,
                    expiryTime: expiryTime,
                    enable: true,
                    tgId: '',
                    subId: input.username,
                    reset: 0,
                }],
                decryption: 'none',
                fallbacks: [],
            }),
        };

        try {
            const result = await this.request<any>('POST', '/xui/API/inbounds/addClient', clientData);

            if (!result.success) {
                throw new PanelError(`Alireza: Failed to create user - ${result.msg}`);
            }

            // Generate subscription URL
            const subUrl = `${this.config.url}/sub/${input.username}`;

            return {
                username: input.username,
                status: 'active',
                usedTraffic: 0,
                dataLimit: totalGB,
                expire: expiryTime,
                subscriptionUrl: subUrl,
            };
        } catch (error: any) {
            if (error instanceof PanelError) throw error;
            throw new PanelError(`Alireza createUser error: ${error.message}`);
        }
    }

    async getUser(username: string): Promise<PanelUserInfo | null> {
        try {
            const result = await this.request<any>('GET', `/xui/API/inbounds`);

            if (!result.success || !result.obj) {
                return null;
            }

            // Search through all inbounds like original implementation
            const inbounds = result.obj || [];
            let client = null;

            for (const inbound of inbounds) {
                const settings = JSON.parse(inbound.settings || '{}');
                const clients = settings.clients || [];

                client = clients.find((c: any) => c.email === username || c.subId === username);
                if (client) break;
            }

            if (!client) {
                return null;
            }

            const subUrl = `${this.config.url}/sub/${client.subId || client.email}`;

            return {
                username: client.email,
                status: client.enable ? 'active' : 'disabled',
                usedTraffic: 0, // Need to get from stats
                dataLimit: client.totalGB || 0,
                expire: client.expiryTime || 0,
                subscriptionUrl: subUrl,
            };
        } catch (error: any) {
            throw new PanelError(`Alireza getUser error: ${error.message}`);
        }
    }

    async removeUser(username: string): Promise<void> {
        const inboundId = this.config.inboundId ? parseInt(this.config.inboundId) : 1;

        try {
            // Get the client data first like original implementation
            const userData = await this.getUser(username);
            if (!userData) {
                throw new PanelError(`Alireza: User ${username} not found`);
            }

            const result = await this.request<any>('POST', `/xui/API/inbounds/${inboundId}/delClient/${username}`, {});

            if (!result.success) {
                throw new PanelError(`Alireza: Failed to remove user - ${result.msg}`);
            }
        } catch (error: any) {
            if (error instanceof PanelError) throw error;
            throw new PanelError(`Alireza removeUser error: ${error.message}`);
        }
    }

    async modifyUser(username: string, data: Partial<CreateUserInput>): Promise<void> {
        const inboundId = this.config.inboundId ? parseInt(this.config.inboundId) : 1;

        try {
            // Get client data first to get UUID
            const userData = await this.getUser(username);
            if (!userData) {
                throw new PanelError(`Alireza: User ${username} not found`);
            }

            const updateData: any = {
                id: inboundId,
                settings: JSON.stringify({
                    clients: [{
                        email: username,
                    }],
                }),
            };

            if (data.volume !== undefined) {
                updateData.settings = JSON.parse(updateData.settings);
                updateData.settings.clients[0].totalGB = data.volume * 1024 * 1024 * 1024;
                updateData.settings = JSON.stringify(updateData.settings);
            }

            if (data.duration !== undefined && data.duration > 0) {
                updateData.settings = JSON.parse(updateData.settings);
                updateData.settings.clients[0].expiryTime = Date.now() + data.duration * 24 * 60 * 60 * 1000;
                updateData.settings = JSON.stringify(updateData.settings);
            }

            const result = await this.request<any>('POST', `/xui/API/inbounds/updateClient`, updateData);

            if (!result.success) {
                throw new PanelError(`Alireza: Failed to modify user - ${result.msg}`);
            }
        } catch (error: any) {
            if (error instanceof PanelError) throw error;
            throw new PanelError(`Alireza modifyUser error: ${error.message}`);
        }
    }

    async revokeSubscription(username: string): Promise<string> {
        // For Alireza, subscription URLs don't change
        // Return the standard subscription URL
        return `${this.config.url}/sub/${username}`;
    }

    async resetDataUsage(username: string): Promise<void> {
        const inboundId = this.config.inboundId ? parseInt(this.config.inboundId) : 1;

        try {
            const result = await this.request<any>('POST', `/xui/API/inbounds/${inboundId}/resetClientTraffic/${username}`, {});

            if (!result.success) {
                throw new PanelError(`Alireza: Failed to reset data usage - ${result.msg}`);
            }
        } catch (error: any) {
            if (error instanceof PanelError) throw error;
            throw new PanelError(`Alireza resetDataUsage error: ${error.message}`);
        }
    }

    private generateUUID(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}
