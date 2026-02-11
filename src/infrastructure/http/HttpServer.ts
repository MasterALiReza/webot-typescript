
import express, { Express } from 'express';
import { config } from '../../shared/config';
import { logger } from '../../shared/logger';

export class HttpServer {
    private app: Express;
    private port: number;

    constructor() {
        this.app = express();
        this.port = Number(config.PAYMENT_PORT) || 3000;

        this.configureMiddleware();
    }

    private configureMiddleware() {
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        // Logging middleware
        this.app.use((req, _res, next) => {
            logger.info(`HTTP ${req.method} ${req.url}`);
            next();
        });
    }

    public registerRoute(path: string, router: express.Router) {
        this.app.use(path, router);
    }

    public start() {
        this.app.listen(this.port, () => {
            logger.info(`🚀 HTTP Server running on port ${this.port}`);
        });
    }

    public getApp(): Express {
        return this.app;
    }
}
