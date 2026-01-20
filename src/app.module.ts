import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PostgresModule } from './postgres/postgres.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CompaniesModule } from './companies/companies.module';
import { EmployeesModule } from './employees/employees.module';
import { DepartmentsModule } from './departments/departments.module';
import { RolesModule } from './roles/roles.module';
import { JobsModule } from './jobs/jobs.module';
import { ApplicantsModule } from './applicants/applicants.module';
import { LeaveTypesModule } from './leaves/leave-types.module';
import { LeaveRecordsModule } from './leaves/leave-records.module';
import { HolidaysModule } from './holidays/holidays.module';
import { FeedbackModule } from './feedback/feedback.module';
import { DocumentsModule } from './documents/documents.module';
import { InvitationsModule } from './invitations/invitations.module';
import { PublicModule } from './public/public.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        PostgresModule,
        AuthModule,
        UsersModule,
        CompaniesModule,
        EmployeesModule,
        DepartmentsModule,
        RolesModule,
        JobsModule,
        ApplicantsModule,
        LeaveTypesModule,
        LeaveRecordsModule,
        HolidaysModule,
        FeedbackModule,
        DocumentsModule,
        InvitationsModule,
        PublicModule,
    ],
    controllers: [],
    providers: [],
})
export class AppModule { }
