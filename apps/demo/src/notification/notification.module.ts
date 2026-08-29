import { Module } from '@nestjs/common';
import {
  NOTIFICATION_CONTEXT_RESOLVER,
  NOTIFICATION_WORKFLOW_PROVIDERS,
  NotificationModule as NotificationLibraryModule,
  RECIPIENT_DESTINATION_RESOLVER,
} from '@app/notification';
import { NotificationController } from './presentation/notification.controller';
import { DemoNotificationContextResolver } from './resolvers/demo-notification-context.resolver';
import { DemoRecipientDestinationResolver } from './resolvers/demo-recipient-destination.resolver';
import { DatabaseModule, SharedConfigModule } from '@app/database';
@Module({
  imports: [SharedConfigModule, DatabaseModule,NotificationLibraryModule],
  controllers: [NotificationController],
  providers: [
    { provide: RECIPIENT_DESTINATION_RESOLVER, useClass: DemoRecipientDestinationResolver },
    { provide: NOTIFICATION_CONTEXT_RESOLVER, useClass: DemoNotificationContextResolver },
    ...NOTIFICATION_WORKFLOW_PROVIDERS,
  ],
})
export class NotificationModule {}
