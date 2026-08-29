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
export * from './infrastructure/persistence/typeorm/transactions';
