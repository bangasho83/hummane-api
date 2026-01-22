import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface EmailRecipient {
    name?: string;
    email: string;
}

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private readonly apiKey: string;
    private readonly senderName: string;
    private readonly senderEmail: string;
    private readonly apiUrl = 'https://api.brevo.com/v3/smtp/email';

    constructor(private configService: ConfigService) {
        this.apiKey = this.configService.get<string>('BREVO_API_KEY') || '';
        this.senderName = this.configService.get<string>('BREVO_SENDER_NAME') || 'Hummane HR';
        this.senderEmail = this.configService.get<string>('BREVO_SENDER_EMAIL') || 'hello@hummane.com';

        if (!this.apiKey) {
            this.logger.warn('BREVO_API_KEY is not set. Email sending will fail.');
        }
    }

    async sendEmail(
        to: EmailRecipient | EmailRecipient[],
        subject: string,
        htmlContent: string
    ): Promise<boolean> {
        if (!this.apiKey) {
            this.logger.error('Cannot send email: BREVO_API_KEY is missing.');
            return false;
        }

        const recipients = Array.isArray(to) ? to : [to];

        const payload = {
            sender: {
                name: this.senderName,
                email: this.senderEmail,
            },
            to: recipients,
            subject: subject,
            htmlContent: htmlContent,
        };

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'api-key': this.apiKey,
                    'content-type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                this.logger.error(`Failed to send email to ${recipients[0].email}: ${response.status} ${response.statusText}`, errorData);
                return false;
            }

            const data = await response.json();
            this.logger.log(`Email sent successfully. MessageId: ${data.messageId}`);
            return true;
        } catch (error) {
            this.logger.error('Error sending email via Brevo:', error);
            return false;
        }
    }
}
