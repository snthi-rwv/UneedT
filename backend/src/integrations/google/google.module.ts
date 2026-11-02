import { Module } from '@nestjs/common';
import { GoogleOAuthClient } from './google-oauth.client';
import { GmailClient } from './gmail.client';

@Module({ providers: [GoogleOAuthClient, GmailClient], exports: [GoogleOAuthClient, GmailClient] })
export class GoogleModule {}