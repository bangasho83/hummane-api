import { BadRequestException, Module, Controller, Get, Post, Body, UseGuards, Req, Query } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { JobsService } from '../jobs/jobs.module';
import { ApplicantsService } from '../applicants/applicants.module';
import { ApplicantSchema, Applicant } from '../schemas/hr.schema';

@Controller('public')
@UseGuards(ApiKeyGuard)
export class PublicController {
    constructor(
        private jobsService: JobsService,
        private applicantsService: ApplicantsService
    ) { }

    @Get('jobs')
    async getJobs(
        @Req() req,
        @Query('jobId') jobId?: string,
        @Query('city') city?: string,
        @Query('country') country?: string,
        @Query('employmentMode') employmentMode?: string,
        @Query('employmentType') employmentType?: string,
        @Query('departmentId') departmentId?: string,
    ) {
        const companyId = req.companyId;
        const jobs = await this.jobsService.findAll(companyId, 50, {
            jobId,
            city,
            country,
            employmentMode,
            employmentType,
            departmentId,
        });
        // Only return open jobs and necessary public fields
        return jobs.filter(job => job.status === 'open');
    }

    @Post('applicants')
    async createApplicant(@Body() data: Applicant, @Req() req) {
        const companyId = req.companyId;
        data.companyId = companyId;

        // Basic validation
        const v = ApplicantSchema.safeParse(data);
        if (!v.success) {
            throw new BadRequestException(v.error.issues);
        }

        return this.applicantsService.create(v.data as Applicant);
    }
}

@Module({
    imports: [], // JobsModule and ApplicantsModule are already exported from their own modules
    controllers: [PublicController],
    providers: [JobsService, ApplicantsService], // We can inject them if they are providers in this module or if we import their modules
})
export class PublicModule { }
