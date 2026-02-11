import type { Panel } from '@prisma/client';
import { IPanelAdapter } from '../../core/interfaces/IPanelAdapter';
import { MarzbanAdapter } from './MarzbanAdapter';
import { MarzneshinAdapter } from './MarzneshinAdapter';
import { XUIAdapter } from './XUIAdapter';
import { SUIPanelAdapter } from './SUIPanelAdapter';
import { WGDashboardAdapter } from './WGDashboardAdapter';
import { MikrotikAdapter } from './MikrotikAdapter';
import { prisma } from '../database/prisma';

export class PanelFactory {
    /**
     * Create a panel adapter from a Panel entity
     */
    static create(panel: Panel): IPanelAdapter {
        const config = {
            url: panel.url,
            username: panel.username,
            password: panel.password,
            inbounds: panel.inbounds || undefined,
            inboundId: panel.inboundId || undefined,
        };

        switch (panel.type) {
            case 'MARZBAN':
                return new MarzbanAdapter(config);

            case 'MARZNESHIN':
                // Marzneshin has different API endpoints and expiry strategies
                return new MarzneshinAdapter({
                    ...config,
                    onHoldEnabled: panel.onHoldEnabled,
                });

            case 'X_UI':
                return new XUIAdapter(config);

            case 'S_UI':
                return new SUIPanelAdapter(config);

            case 'WGDASHBOARD':
                return new WGDashboardAdapter(config);

            case 'MIKROTIK':
                return new MikrotikAdapter(config);

            default:
                throw new Error(`Unknown panel type: ${panel.type}`);
        }
    }

    /**
     * Create a panel adapter by panel name (fetches from database)
     */
    static async createFromName(panelName: string): Promise<IPanelAdapter> {
        const panel = await prisma.panel.findUnique({
            where: { name: panelName },
        });

        if (!panel) {
            throw new Error(`Panel not found: ${panelName}`);
        }

        if (panel.status !== 'ACTIVE') {
            throw new Error(`Panel is not active: ${panelName}`);
        }

        return PanelFactory.create(panel);
    }
}
