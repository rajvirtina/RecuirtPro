import Bull from 'bull';
export declare const enqueueEmail: (options: {
    to: string;
    subject: string;
    template?: string;
    data?: Record<string, any>;
    html?: string;
}) => Promise<Bull.Job<any>>;
export declare const enqueueCrossPortalPosting: (options: {
    jobId: string;
    portals: string[];
    jobData: Record<string, any>;
}) => Promise<Bull.Job<any>>;
export declare const closeQueues: () => Promise<void>;
//# sourceMappingURL=queueProcessors.d.ts.map