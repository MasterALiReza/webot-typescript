import { prisma } from '../prisma';

export class ProductRepository {
    async findById(id: number): Promise<any | null> {
        return prisma.product.findUnique({
            where: { id },
            include: { panel: true },
        });
    }

    async findAllActive(): Promise<any[]> {
        return prisma.product.findMany({
            where: { isActive: true },
            include: { panel: true },
            orderBy: { price: 'asc' },
        });
    }

    async findByPanelId(panelId: number): Promise<any[]> {
        return prisma.product.findMany({
            where: { panelId, isActive: true },
            orderBy: { price: 'asc' },
        });
    }

    async create(data: {
        name: string;
        description?: string;
        price: number;
        volume: number;
        duration: number;
        panelId: number;
    }): Promise<any> {
        return prisma.product.create({
            data,
        });
    }

    async update(id: number, data: any): Promise<any> {
        return prisma.product.update({
            where: { id },
            data,
        });
    }

    async delete(id: number): Promise<void> {
        await prisma.product.delete({
            where: { id },
        });
    }

    async countAll(): Promise<number> {
        return prisma.product.count();
    }

    async countActive(): Promise<number> {
        return prisma.product.count({
            where: { isActive: true },
        });
    }
}
