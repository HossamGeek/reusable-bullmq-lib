import { Inject, Injectable } from '@nestjs/common';
import { Queue, QueueOptions } from 'bullmq';
import { BULLMQ_OPTIONS, BULLMQ_QUEUE_DEFINITIONS } from '../../shared/constants/tokens';
import { canonicalize } from '../../shared/helpers/canonicalize.helper';
import {
  BullMqRootOptions,
  QueueDefinition,
  RegisteredQueueInfo,
} from '../../shared/interfaces/bullmq.interfaces';

@Injectable()
export class QueueRegistryService {
  private readonly queues = new Map<string, Queue>();
  private readonly signatures = new Map<string, string>();

  constructor(
    @Inject(BULLMQ_OPTIONS) private readonly options: BullMqRootOptions,
    @Inject(BULLMQ_QUEUE_DEFINITIONS) definitions: QueueDefinition[] = [],
  ) {
    for (const definition of definitions) this.register(definition);
  }

  /** Registers a queue once and returns the existing instance for identical options. */
  register(definition: QueueDefinition): Queue {
    const normalized = this.normalize(definition);
    const signature = canonicalize({ name: normalized.name, options: normalized.options });
    const existing = this.queues.get(normalized.name);

    if (existing) {
      if (this.signatures.get(normalized.name) !== signature) {
        throw new Error(`Queue '${normalized.name}' already registered with different options`);
      }

      return existing;
    }

    const queue = new Queue(normalized.name, normalized.options);
    this.queues.set(normalized.name, queue);
    this.signatures.set(normalized.name, signature);

    return queue;
  }

  /** Returns a registered queue or fails when the queue is unknown in this context. */
  get(name: string): Queue {
    const queue = this.queues.get(name);
    if (!queue) throw new Error(`Queue '${name}' is not registered in this application context`);

    return queue;
  }

  /** Lists registered queues with their BullMQ qualified names. */
  list(): RegisteredQueueInfo[] {
    return [...this.queues.values()].map((queue) => ({
      name: queue.name,
      qualifiedName: queue.qualifiedName,
    }));
  }

  /** Closes all queue connections owned by this registry. */
  async closeAll(): Promise<void> {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
  }

  private normalize(definition: QueueDefinition): QueueDefinition & { options: QueueOptions } {
    if (typeof definition.name !== 'string' || definition.name.trim().length === 0) {
      throw new Error('Queue definition requires a non-empty name');
    }

    return {
      ...definition,
      options: {
        ...definition.options,
        connection: this.options.connection,
        prefix: this.options.queuePrefix,
        defaultJobOptions: {
          ...this.options.defaultJobOptions,
          ...definition.options?.defaultJobOptions,
          ...definition.defaultJobOptions,
        },
      },
    };
  }
}
