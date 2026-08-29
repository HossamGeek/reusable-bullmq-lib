export * from './notification.module';

// Domain
export * from './domain/enums';
export * from './domain/value-objects';
export * from './domain/contexts';
export * from './domain/entities';

// Application contracts
export * from './application/dto';
export * from './application/commands';
export * from './application/errors';
export * from './application/ports/persistence';
export * from './application/ports/queue';

// Application policies, config, services
export * from './application/policies';
export * from './application/config';
export * from './application/services';
export * from './application/ports/resolution';

// Application services
export * from './application/services';

// Presentation (transport-shared contracts)
export * from './presentation/dto';
export * from './presentation/mappers';

// Infrastructure persistence
export * from './infrastructure/persistence/typeorm/entities';
export * from './infrastructure/persistence/typeorm/mappers';
export * from './infrastructure/persistence/typeorm/repositories';

// Infrastructure queue
export * from './infrastructure/queue/bullmq';

// Infrastructure scheduler
export * from './infrastructure/scheduler';
export * from './infrastructure/persistence/typeorm/transactions';
