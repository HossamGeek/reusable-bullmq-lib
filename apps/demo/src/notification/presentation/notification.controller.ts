import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  CreateNotificationDto,
  CreateNotificationMapper,
  NotificationApplicationService,
} from '@app/notification';

@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notificationApplicationService: NotificationApplicationService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateNotificationDto): Promise<{ accepted: true }> {
    const input = CreateNotificationMapper.toInput(dto);
    await this.notificationApplicationService.create(input);
    return { accepted: true };
  }
}
