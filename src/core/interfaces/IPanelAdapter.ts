// Core domain interface for Panel Adapters
export interface CreateUserInput {
    username: string;
    volume: number;    // in GB
    duration: number;  // in days
    inbounds?: string; // JSON string of inbound configs
}

export interface PanelUserInfo {
    username: string;
    status: 'active' | 'disabled' | 'limited' | 'expired' | 'on_hold' | 'Unsuccessful';
    usedTraffic: number;  // in bytes
    dataLimit: number;    // in bytes
    expire: number;       // unix timestamp
    subscriptionUrl?: string;
}

export interface IPanelAdapter {
    /**
     * Authenticate with the panel API
     */
    authenticate(): Promise<void>;

    /**
     * Create a new user on the panel
     */
    createUser(input: CreateUserInput): Promise<PanelUserInfo>;

    /**
     * Get user information from the panel
     */
    getUser(username: string): Promise<PanelUserInfo | null>;

    /**
     * Remove a user from the panel
     */
    removeUser(username: string): Promise<void>;

    /**
     * Modify user settings (extend duration, add volume, etc.)
     */
    modifyUser(username: string, data: Partial<CreateUserInput>): Promise<void>;

    /**
     * Revoke subscription and get a new subscription URL
     */
    revokeSubscription(username: string): Promise<string>;

    /**
     * Reset user's data usage to zero
     */
    resetDataUsage(username: string): Promise<void>;

    /**
     * Get system statistics (optional)
     */
    getSystemStats?(): Promise<any>;
}
