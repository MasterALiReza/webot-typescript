// Custom error classes for the application

export class AppError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly statusCode: number = 500
    ) {
        super(message);
        this.name = 'AppError';
        Error.captureStackTrace(this, this.constructor);
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string) {
        super(`${resource} not found`, 'NOT_FOUND', 404);
        this.name = 'NotFoundError';
    }
}

export class ValidationError extends AppError {
    constructor(message: string) {
        super(message, 'VALIDATION_ERROR', 400);
        this.name = 'ValidationError';
    }
}

export class InsufficientBalanceError extends AppError {
    constructor() {
        super('Insufficient balance', 'INSUFFICIENT_BALANCE', 400);
        this.name = 'InsufficientBalanceError';
    }
}

export class PanelError extends AppError {
    constructor(message: string, panelName: string = 'Unknown') {
        super(`Panel error (${panelName}): ${message}`, 'PANEL_ERROR', 500);
        this.name = 'PanelError';
    }
}

export class PaymentError extends AppError {
    constructor(message: string) {
        super(`Payment error: ${message}`, 'PAYMENT_ERROR', 500);
        this.name = 'PaymentError';
    }
}
