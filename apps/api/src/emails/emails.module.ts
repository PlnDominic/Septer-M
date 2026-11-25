import { Global, Module } from '@nestjs/common';
import { HttpService } from '../common/http.service';
import { EmailService } from './email.service';
import { OrderNotifier } from './order-notifier.service';

@Global()
@Module({ providers: [HttpService, EmailService, OrderNotifier], exports: [HttpService, EmailService, OrderNotifier] })
export class EmailsModule {}
