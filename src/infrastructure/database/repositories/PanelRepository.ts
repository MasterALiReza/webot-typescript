import { prisma } from '../prisma';

export class PanelRepository {
    async findById(id: number): Promise<any | null> {
        return prisma.panel.findUnique({
            where: { id },
        });
    }

    async findByName(name: string): Promise<any | null> {
        return prisma.panel.findUnique({
            where: { name },
        });
    }

    async findAllActive(): Promise<any[]> {
        return prisma.panel.findMany({
            where: { status: 'ACTIVE' },
            orderBy: { name: 'asc' },
        });
    }

    async findAll(): Promise<any[]> {
        return prisma.panel.findMany({
            orderBy: { name: 'asc' },
        });
    }

    async create(data: {
        name: string;
        type: string;
        url: string;
        username: string;
        password: string;
        inbounds?: string;
        inboundId?: string;
    }): Promise<any> {
        return prisma.panel.create({
            data: {
                ...data,
                type: data.type as any,
            },
        });
    }

    async update(id: number, data: any): Promise<any> {
        return prisma.panel.update({
            where: { id },
            data,
        });
    }

    async delete(id: number): Promise<void> {
        await prisma.panel.delete({
            where: { id },
        });
    }

    async countAll(): Promise<number> {
        return prisma.panel.count();
    }

    async countActive(): Promise<number> {
        return prisma.panel.count({
            where: { status: 'ACTIVE' },
        });
    }
}
