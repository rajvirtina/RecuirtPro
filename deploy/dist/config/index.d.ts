export declare const config: {
    env: string;
    port: number;
    server: {
        url: string;
    };
    mongoUri: string;
    jwt: {
        secret: string;
        expire: string;
        refreshSecret: string;
        refreshExpire: string;
    };
    corsOrigin: string[];
    email: {
        host: string;
        port: number;
        secure: boolean;
        user: string;
        password: string;
        from: string;
        fromName: string;
    };
    sms: {
        apiKey: string;
        senderId: string;
        provider: string;
    };
    aws: {
        accessKeyId: string;
        secretAccessKey: string;
        region: string;
        s3Bucket: string;
    };
    redis: {
        host: string;
        port: number;
        password: string;
        tls: boolean;
    };
    microsoft: {
        clientId: string;
        clientSecret: string;
        tenantId: string;
        redirectUri: string;
    };
    google: {
        clientId: string;
        clientSecret: string;
        redirectUri: string;
    };
    zoho: {
        clientId: string;
        clientSecret: string;
        redirectUri: string;
    };
    naukri: {
        apiKey: string;
        apiSecret: string;
        baseUrl: string;
    };
    linkedin: {
        clientId: string;
        clientSecret: string;
    };
    features: {
        proctoring: boolean;
        naukriIntegration: boolean;
        linkedinIntegration: boolean;
        mfa: boolean;
        emailVerification: boolean;
    };
    rateLimit: {
        windowMs: number;
        maxRequests: number;
    };
    maxFileSize: number;
    logging: {
        level: string;
        filePath: string;
    };
    frontend: {
        url: string;
    };
    frontendUrl: string;
    companyName: string;
    supportEmail: string;
    encryptionKey: string;
    llm: {
        serviceUrl: string;
        apiSecretKey: string;
    };
    github: {
        clientId: string;
        clientSecret: string;
        token: string;
    };
    retention: {
        resumes: number;
        auditLogs: number;
        applications: number;
    };
};
export default config;
//# sourceMappingURL=index.d.ts.map