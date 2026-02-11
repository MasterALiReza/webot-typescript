import { prisma } from '../prisma';

export class UserRepository {
    async findByChatId(chatId: bigint): Promise<any | null> {
        return prisma.user.findUnique({
            where: { chatId },
        });
    }

    async findById(id: number): Promise<any | null> {
        return prisma.user.findUnique({
            where: { id },
        });
    }

    async findByRefCode(refCode: string): Promise<any | null> {
        return prisma.user.findUnique({
            where: { refCode },
        });
    }

    async create(data: {
        chatId: bigint;
        username?: string;
        firstName?: string;
    }): Promise<any> {
        return prisma.user.create({
            data: {
                chatId: data.chatId,
                username: data.username,
                firstName: data.firstName,
            },
        });
    }

    async update(id: number, data: any): Promise<any> {
        return prisma.user.update({
            where: { id },
            data,
        });
    }

    async updateByChatId(chatId: bigint, data: any): Promise<any> {
        return prisma.user.update({
            where: { chatId },
            data,
        });
    }

    async incrementAffiliateCount(id: number): Promise<void> {
        await prisma.user.update({
            where: { id },
            data: { affiliateCount: { increment: 1 } },
        });
    }

    async addBalance(id: number, amount: number): Promise<void> {
        await prisma.user.update({
            where: { id },
            data: { balance: { increment: amount } },
        });
    }

    async deductBalance(id: number, amount: number): Promise<void> {
        await prisma.user.update({
            where: { id },
            data: { balance: { decrement: amount } },
        });
    }

    async setStep(chatId: bigint, step: string): Promise<void> {
        await prisma.user.update({
            where: { chatId },
            data: { step },
        });
    }

    async setProcessingValue(
        chatId: bigint,
        field: 'processingValue' | 'processingValueOne' | 'processingValueTwo' | 'processingValueThree' | 'processingValueFour',
        value: string
    ): Promise<void> {
        await prisma.user.update({
            where: { chatId },
            data: { [field]: value },
        });
    }

    async incrementMessageCount(id: number): Promise<void> {
        await prisma.user.update({
            where: { id },
            data: { messageCount: { increment: 1 } },
        });
    }

    async resetMessageCount(id: number, lastMessageTime: number): Promise<void> {
        await prisma.user.update({
            where: { id },
            data: { messageCount: 1, lastMessageTime },
        });
    }

    async countAll(): Promise<number> {
        return prisma.user.count();
    }

    async countBlocked(): Promise<number> {
        return prisma.user.count({
            where: { userStatus: 'BLOCKED' },
        });
    }
}
