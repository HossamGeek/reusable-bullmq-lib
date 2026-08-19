import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { DemoService } from '../services/demo.service';
import {
  BulkDto,
  DelayedDto,
  EnqueueJobDto,
  LoadDto,
  PriorityDto,
  RetryJobDto,
} from '../dto/job.dto';

@Controller()
export class DemoController {
  constructor(private readonly service: DemoService) {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('live')
  live() {
    return { status: 'alive' };
  }

  @Get('ready')
  ready() {
    return this.service.ready();
  }

  @Post('jobs/normal')
  normal(@Body() dto: EnqueueJobDto) {
    return this.service.normal(dto);
  }

  @Post('jobs/bulk')
  bulk(@Body() dto: BulkDto) {
    return this.service.bulk(dto);
  }

  @Post('jobs/delayed')
  delayed(@Body() dto: DelayedDto) {
    return this.service.delayed(dto);
  }

  @Post('jobs/retry-deterministic')
  retry(@Body() dto: RetryJobDto) {
    return this.service.retry(dto);
  }

  @Post('jobs/priority')
  priority(@Body() dto: PriorityDto) {
    return this.service.priority(dto);
  }

  @Post('jobs/load')
  load(@Body() dto: LoadDto) {
    return this.service.load(dto);
  }

  @Get('jobs/stats')
  stats() {
    return this.service.stats();
  }

  @Get('jobs/:id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Delete('jobs/:id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post('jobs/:id/retry')
  retryJob(@Param('id') id: string) {
    return this.service.retryJob(id);
  }
}
