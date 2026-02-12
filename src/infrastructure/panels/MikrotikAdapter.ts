import axios, { AxiosInstance } from 'axios';
import { IPanelAdapter, CreateUserInput, PanelUserInfo } from '../../core/interfaces/IPanelAdapter';
import { PanelError } from '../../core/errors';

interface MikrotikConfig {
    url: string;
    username: string;
    password: string;
    inbounds?: string; // Profile/Group name
    inboundId?: string; // Profile/Group name (same as inbounds)
}

/**
 * MikroTik RouterOS Adapter
 * 
 * Based on original botmirzapanel Mikrotik implementation.
 * Uses HTTP Basic Authentication with RouterOS REST API.
 * 
 * API Endpoints:
 * - System resource: /rest/system/resource
 * - Add user: /rest/user-manager/user/add
 * - Get user: /rest/user-manager/user?name={username}
 * - Set profile: /rest/user-manager/user-profile/add
 * - Get volume: /rest/user-manager/user/monitor
 * - Delete user: /rest/user-manager/user/remove
 */
export class MikrotikAdapter implements IPanelAdapter {
    private client: AxiosInstance;
    private profileName: string;

    // @ts-ignore - config is used in constructor body
    constructor(private config: MikrotikConfig) {
        this.profileName = config.inboundId || config.inbounds || 'default';

        this.client = axios.create({
            baseURL: config.url,
            timeout: 60000, // Increased to 60 seconds
            auth: {
                username: config.username,
                password: config.password,
            },
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    async authenticate(): Promise<void> {
        try {
            const response = await this.client.get('/rest/system/resource');

            if (response.status !== 200) {
                throw new PanelError('Mikrotik authentication failed');
            }
        } catch (error: any) {
            if (error.response?.status === 401) {
                throw new PanelError('Mikrotik authentication failed: Invalid credentials');
            }
            throw new PanelError(`Mikrotik authentication error: ${error.message}`);
        }
    }

    async createUser(input: CreateUserInput): Promise<PanelUserInfo> {
        try {
            // Create user
            const userData = {
                name: input.username,
                password: this.generatePassword(),
            };

            const createResponse = await this.client.post('/rest/user-manager/user/add', userData);

            if (!createResponse.data) {
                throw new PanelError('Mikrotik: Failed to create user');
            }

            // Set user profile/group
            await this.setUserProfile(input.username, this.profileName);

            // Note: MikroTik User Manager doesn't have built-in volume/expiry limits per user
            // These need to be managed through profiles or external monitoring
            // For now, we return basic user info

            return {
                username: input.username,
                status: 'active',
                usedTraffic: 0,
                dataLimit: input.volume * 1024 * 1024 * 1024,
                expire: input.duration > 0 ? Date.now() + (input.duration * 24 * 60 * 60 * 1000) : 0,
                subscriptionUrl: '', // MikroTik doesn't use subscription URLs
            };
        } catch (error: any) {
            if (error instanceof PanelError) throw error;
            throw new PanelError(`Mikrotik createUser error: ${error.message}`);
        }
    }

    async getUser(username: string): Promise<PanelUserInfo | null> {
        try {
            const response = await this.client.get(`/rest/user-manager/user?name=${username}`);

            if (!response.data || response.data.length === 0) {
                return null;
            }

            const user = response.data[0];

            // Get user volume data
            let usedTraffic = 0;
            try {
                const volumeData = await this.getUserVolume(user['.id']);
                usedTraffic = (volumeData['upload-bytes'] || 0) + (volumeData['download-bytes'] || 0);
            } catch {
                // If volume check fails, continue with 0
            }

            return {
                username: user.name,
                status: user.disabled ? 'disabled' : 'active',
                usedTraffic,
                dataLimit: 0, // MikroTik doesn't store per-user limits
                expire: 0,
                subscriptionUrl: '',
            };
        } catch (error: any) {
            if (error.response?.status === 404) {
                return null;
            }
            throw new PanelError(`Mikrotik getUser error: ${error.message}`);
        }
    }

    async removeUser(username: string): Promise<void> {
        try {
            // Get user ID first
            const response = await this.client.get(`/rest/user-manager/user?name=${username}`);

            if (!response.data || response.data.length === 0) {
                throw new PanelError(`Mikrotik: User ${username} not found`);
            }

            const userId = response.data[0]['.id'];

            await this.client.post('/rest/user-manager/user/remove', {
                '.id': userId,
            });
        } catch (error: any) {
            if (error instanceof PanelError) throw error;
            throw new PanelError(`Mikrotik removeUser error: ${error.message}`);
        }
    }

    async modifyUser(username: string, data: Partial<CreateUserInput>): Promise<void> {
        try {
            // MikroTik User Manager has limited modify capabilities
            // Most settings are controlled through profiles
            // We can only really change the password or profile

            if (data.inbounds) {
                // Change user profile
                await this.setUserProfile(username, data.inbounds);
            }

            // Note: Volume and expiry are typically managed through profiles in MikroTik
            // Direct per-user modifications are limited
        } catch (error: any) {
            if (error instanceof PanelError) throw error;
            throw new PanelError(`Mikrotik modifyUser error: ${error.message}`);
        }
    }

    async revokeSubscription(_username: string): Promise<string> {
        // MikroTik doesn't use subscription URLs
        // Could potentially reset password here
        return '';
    }

    async resetDataUsage(_username: string): Promise<void> {
        // MikroTik User Manager doesn't support resetting individual user traffic
        // This would need to be done through custom scripts or database manipulation
        throw new PanelError('Mikrotik: Reset data usage not supported by User Manager API');
    }

    // Helper methods
    private async setUserProfile(username: string, profileName: string): Promise<void> {
        try {
            await this.client.post('/rest/user-manager/user-profile/add', {
                user: username,
                profile: profileName,
            });
        } catch (error: any) {
            throw new PanelError(`Mikrotik: Failed to set user profile - ${error.message}`);
        }
    }

    private async getUserVolume(userId: string): Promise<any> {
        try {
            const response = await this.client.post('/rest/user-manager/user/monitor', {
                once: true,
                '.id': userId,
            });

            return response.data[0] || {};
        } catch (error: any) {
            throw new PanelError(`Mikrotik: Failed to get user volume - ${error.message}`);
        }
    }

    private generatePassword(length: number = 12): string {
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < length; i++) {
            password += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        return password;
    }
}
