import { prisma } from '../prisma';

export class InvoiceRepository {
    async findById(id: number): Promise<any | null> {
        return prisma.invoice.findUnique({
            where: { id },
            include: {
                user: true,
                product: true,
                panel: true,
            },
        });
    }

    async findByUsername(username: string): Promise<any | null> {
        return prisma.invoice.findFirst({
            where: { username },
            include: {
                user: true,
                product: true,
                panel: true,
            },
        });
    }

    async findByUserId(userId: number): Promise<any[]> {
        return prisma.invoice.findMany({
            where: { userId },
            include: { product: true, panel: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findActiveByUserId(userId: number): Promise<any[]> {
        return prisma.invoice.findMany({
            where: {
                userId,
                status: 'ACTIVE',
            },
            include: { product: true, panel: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findExpiring(limit: number = 10): Promise<any[]> {
        return prisma.invoice.findMany({
            where: {
                status: {
                    in: ['ACTIVE', 'END_OF_VOLUME'],
                },
                productName: { not: 'usertest' },
            },
            include: { user: true },
            take: limit,
            orderBy: { createdAt: 'asc' },
        });
    }

    async findTestAccounts(limit: number = 10): Promise<any[]> {
        return prisma.invoice.findMany({
            where: {
                productName: 'usertest',
                status: 'ACTIVE',
            },
            include: { user: true },
            take: limit,
        });
    }

    async create(data: {
        userId: number;
        productId: number;
        panelId: number;
        username: string;
        configUrl?: string;
        subscriptionUrl?: string;
        serviceLocation: string;
        productName: string;
        productPrice: number;
        expiresAt?: Date;
    }): Promise<any> {
        return prisma.invoice.create({
            data,
        });
    }

    async updateStatus(id: number, status: string): Promise<any> {
        return prisma.invoice.update({
            where: { id },
            data: { status: status as any },
        });
    }

    async updateByUsername(username: string, data: any): Promise<any> {
        return prisma.invoice.updateMany({
            where: { username },
            data,
        }) as any;
    }

    async countByStatus(status: string): Promise<number> {
        return prisma.invoice.count({
            where: { status: status as any },
        });
    }

    async countTestAccounts(): Promise<number> {
        return prisma.invoice.count({
            where: {
                productName: 'usertest',
                status: 'ACTIVE',
            },
        });
    }

    async getTotalRevenue(): Promise<number> {
        const result = await prisma.invoice.aggregate({
            _sum: { productPrice: true },
        });
        return Number(result._sum.productPrice || 0);
    }

    async getRevenueToday(): Promise<number> {
        const dayAgo = new Date();
        dayAgo.setDate(dayAgo.getDate() - 1);

        const result = await prisma.invoice.aggregate({
            _sum: { productPrice: true },
            where: {
                createdAt: { gte: dayAgo },
            },
        });
        return Number(result._sum.productPrice || 0);
    }

    async countActiveByUserId(userId: number): Promise<number> {
        return prisma.invoice.count({
            where: {
                userId,
                status: 'ACTIVE',
            },
        });
    }
}
