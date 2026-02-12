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
        referredBy?: bigint;
    }): Promise<any> {
        return prisma.user.create({
            data: {
                chatId: data.chatId,
                username: data.username,
                firstName: data.firstName,
                referredBy: data.referredBy,
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

    async incrementAffiliateCount(chatId: bigint): Promise<void> {
        await prisma.user.update({
            where: { chatId },
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
        // Use atomic update with check to prevent negative balance
        const result = await prisma.user.updateMany({
            where: {
                id,
                balance: { gte: amount } // Only update if balance is sufficient
            },
            data: { balance: { decrement: amount } },
        });

        if (result.count === 0) {
            throw new Error('Insufficient balance or user not found');
        }
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

    async getReferralCount(chatId: bigint): Promise<number> {
        return prisma.user.count({
            where: { referredBy: chatId },
        });
    }
}
