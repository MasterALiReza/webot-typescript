import axios, { AxiosInstance } from 'axios';
import { IPanelAdapter, CreateUserInput, PanelUserInfo } from '../../core/interfaces/IPanelAdapter';
import { PanelError } from '../../core/errors';
import * as crypto from 'crypto';

interface WGDashboardConfig {
    url: string;
    username: string;
    password: string; // This is the API key
    inbounds?: string; // Configuration name
    inboundId?: string; // Configuration name (same as inbounds)
}

/**
 * WireGuard Dashboard Adapter
 * 
 * Based on original botmirzapanel WGDashboard implementation.
 * Uses API key authentication and manages WireGuard peers.
 * 
 * API Endpoints:
 * - Get configuration info: /api/getWireguardConfigurationInfo?configurationName={name}
 * - Get available IPs: /api/getAvailableIPs/{configName}
 * - Add peer: /api/addPeers/{configName}
 * - Update peer: /api/updatePeerSettings/{configName}
 * - Delete peer: /api/deletePeers/{configName}
 * - Reset data: /api/resetPeerData/{configName}
 * - Download config: /api/downloadPeer/{configName}?id={publicKey}
 * - Save job: /api/savePeerScheduleJob
 * - Delete job: /api/deletePeerScheduleJob
 * - Restrict peer: /api/restrictPeers/{configName}
 * - Allow access: /api/allowAccessPeers/{configName}
 */
export class WGDashboardAdapter implements IPanelAdapter {
    private client: AxiosInstance;
    private configName: string;

    // @ts-ignore - config is used in constructor body
    constructor(private config: WGDashboardConfig) {
        this.configName = config.inboundId || config.inbounds || 'wg0';

        this.client = axios.create({
            baseURL: config.url,
            timeout: 30000,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'wg-dashboard-apikey': config.password, // API key as password
            },
        });
    }

    async authenticate(): Promise<void> {
        // WGDashboard uses API key, no session needed
        // Just verify the API key works by making a test request
        try {
            await this.client.get(`/api/getWireguardConfigurationInfo?configurationName=${this.configName}`);
        } catch (error: any) {
            throw new PanelError(`WGDashboard authentication failed: ${error.message}`);
        }
    }

    async createUser(input: CreateUserInput): Promise<PanelUserInfo> {
        try {
            // Generate WireGuard keys
            const keys = this.generateWGKeys();

            // Get available IP
            const availableIP = await this.getAvailableIP();

            // Create peer data
            const peerData = {
                name: input.username,
                allowed_ips: [availableIP],
                private_key: keys.privateKey,
                public_key: keys.publicKey,
                preshared_key: keys.presharedKey,
            };

            const response = await this.client.post(
                `/api/addPeers/${this.configName}`,
                peerData
            );

            if (!response.data.status) {
                throw new PanelError(`WGDashboard: Failed to create peer - ${response.data.message || 'Unknown error'}`);
            }

            // Set expiry and volume jobs if needed
            if (input.duration > 0) {
                const expiryTimestamp = Math.floor(Date.now() / 1000) + (input.duration * 24 * 60 * 60);
                await this.setJob('date_start', expiryTimestamp, keys.publicKey);
            }

            if (input.volume > 0) {
                const volumeBytes = input.volume * 1024 * 1024 * 1024;
                await this.setJob('total_data', volumeBytes, keys.publicKey);
            }

            // Get config file
            const configFile = await this.downloadConfig(keys.publicKey);

            return {
                username: input.username,
                status: 'active',
                usedTraffic: 0,
                dataLimit: input.volume * 1024 * 1024 * 1024,
                expire: input.duration > 0 ? Date.now() + (input.duration * 24 * 60 * 60 * 1000) : 0,
                subscriptionUrl: configFile,
            };
        } catch (error: any) {
            if (error instanceof PanelError) throw error;
            throw new PanelError(`WGDashboard createUser error: ${error.message}`);
        }
    }

    async getUser(username: string): Promise<PanelUserInfo | null> {
        try {
            const response = await this.client.get(
                `/api/getWireguardConfigurationInfo?configurationName=${this.configName}`
            );

            if (!response.data.data) {
                return null;
            }

            // Merge normal and restricted peers
            const allPeers = [
                ...(response.data.data.configurationPeers || []),
                ...(response.data.data.configurationRestrictedPeers || []),
            ];

            const peer = allPeers.find((p: any) => p.name === username);

            if (!peer) {
                return null;
            }

            // Get config file for subscription
            const configFile = await this.downloadConfig(peer.public_key);

            return {
                username: peer.name,
                status: peer.restricted ? 'disabled' : 'active',
                usedTraffic: peer.total_data_usage || 0,
                dataLimit: peer.total_data || 0,
                expire: peer.date_start || 0,
                subscriptionUrl: configFile,
            };
        } catch (error: any) {
            throw new PanelError(`WGDashboard getUser error: ${error.message}`);
        }
    }

    async removeUser(username: string): Promise<void> {
        try {
            // Get peer to find public key
            const user = await this.getUser(username);
            if (!user) {
                throw new PanelError(`WGDashboard: User ${username} not found`);
            }

            // Allow access first (like original implementation)
            await this.allowAccessPeer(username);

            // Get public key from user info
            const response = await this.client.get(
                `/api/getWireguardConfigurationInfo?configurationName=${this.configName}`
            );

            const allPeers = [
                ...(response.data.data.configurationPeers || []),
                ...(response.data.data.configurationRestrictedPeers || []),
            ];

            const peer = allPeers.find((p: any) => p.name === username);
            if (!peer) {
                throw new PanelError(`WGDashboard: User ${username} not found`);
            }

            await this.client.post(
                `/api/deletePeers/${this.configName}`,
                { peers: [peer.public_key] }
            );
        } catch (error: any) {
            if (error instanceof PanelError) throw error;
            throw new PanelError(`WGDashboard removeUser error: ${error.message}`);
        }
    }

    async modifyUser(username: string, data: Partial<CreateUserInput>): Promise<void> {
        try {
            const user = await this.getUser(username);
            if (!user) {
                throw new PanelError(`WGDashboard: User ${username} not found`);
            }

            const updateData: any = {};

            if (data.volume !== undefined) {
                const volumeBytes = data.volume * 1024 * 1024 * 1024;
                updateData.total_data = volumeBytes;
            }

            if (data.duration !== undefined && data.duration > 0) {
                const expiryTimestamp = Math.floor(Date.now() / 1000) + (data.duration * 24 * 60 * 60);
                updateData.date_start = expiryTimestamp;
            }

            if (Object.keys(updateData).length > 0) {
                await this.client.post(
                    `/api/updatePeerSettings/${this.configName}`,
                    updateData
                );
            }
        } catch (error: any) {
            if (error instanceof PanelError) throw error;
            throw new PanelError(`WGDashboard modifyUser error: ${error.message}`);
        }
    }

    async revokeSubscription(username: string): Promise<string> {
        // WGDashboard configs don't change, return the same config
        const user = await this.getUser(username);
        return user?.subscriptionUrl || '';
    }

    async resetDataUsage(username: string): Promise<void> {
        try {
            const user = await this.getUser(username);
            if (!user) {
                throw new PanelError(`WGDashboard: User ${username} not found`);
            }

            // Get public key
            const response = await this.client.get(
                `/api/getWireguardConfigurationInfo?configurationName=${this.configName}`
            );

            const allPeers = [
                ...(response.data.data.configurationPeers || []),
                ...(response.data.data.configurationRestrictedPeers || []),
            ];

            const peer = allPeers.find((p: any) => p.name === username);
            if (!peer) {
                throw new PanelError(`WGDashboard: User ${username} not found`);
            }

            await this.client.post(
                `/api/resetPeerData/${this.configName}`,
                {
                    id: peer.public_key,
                    type: 'total',
                }
            );
        } catch (error: any) {
            if (error instanceof PanelError) throw error;
            throw new PanelError(`WGDashboard resetDataUsage error: ${error.message}`);
        }
    }

    // Helper methods
    private async getAvailableIP(): Promise<string> {
        try {
            const response = await this.client.get(`/api/getAvailableIPs/${this.configName}`);
            const ips = response.data.data;
            const firstKey = Object.keys(ips)[0];
            return ips[firstKey][0];
        } catch (error: any) {
            throw new PanelError(`WGDashboard: Failed to get available IP - ${error.message}`);
        }
    }

    private async downloadConfig(publicKey: string): Promise<string> {
        try {
            const response = await this.client.get(
                `/api/downloadPeer/${this.configName}?id=${encodeURIComponent(publicKey)}`
            );
            return response.data.data || '';
        } catch (error: any) {
            throw new PanelError(`WGDashboard: Failed to download config - ${error.message}`);
        }
    }

    private async setJob(field: string, value: number, publicKey: string): Promise<void> {
        try {
            const jobData = {
                Job: {
                    JobID: this.generateUUID(),
                    Configuration: this.configName,
                    Peer: publicKey,
                    Field: field,
                    Operator: 'lgt',
                    Value: String(value),
                    CreationDate: '',
                    ExpireDate: null,
                    Action: 'restrict',
                },
            };

            await this.client.post('/api/savePeerScheduleJob', jobData);
        } catch (error: any) {
            // Job setting is optional, don't throw error
            console.error(`WGDashboard: Failed to set job - ${error.message}`);
        }
    }

    private async allowAccessPeer(username: string): Promise<void> {
        try {
            const response = await this.client.get(
                `/api/getWireguardConfigurationInfo?configurationName=${this.configName}`
            );

            const allPeers = [
                ...(response.data.data.configurationPeers || []),
                ...(response.data.data.configurationRestrictedPeers || []),
            ];

            const peer = allPeers.find((p: any) => p.name === username);
            if (!peer) return;

            await this.client.post(
                `/api/allowAccessPeers/${this.configName}`,
                { peers: [peer.public_key] }
            );
        } catch (error: any) {
            // Don't throw, this is a cleanup operation
            console.error(`WGDashboard: Failed to allow access - ${error.message}`);
        }
    }

    private generateWGKeys(): { privateKey: string; publicKey: string; presharedKey: string } {
        // Generate random 32-byte keys for WireGuard
        const privateKey = crypto.randomBytes(32).toString('base64');
        const publicKey = crypto.randomBytes(32).toString('base64');
        const presharedKey = crypto.randomBytes(32).toString('base64');

        return { privateKey, publicKey, presharedKey };
    }

    private generateUUID(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}
