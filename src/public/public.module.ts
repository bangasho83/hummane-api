import { BadRequestException, Module, Controller, Get, Post, Body, UseGuards, Req, Query } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { JobsService } from '../jobs/jobs.module';
import { ApplicantsService } from '../applicants/applicants.module';
import { ApplicantSchema, Applicant } from '../schemas/hr.schema';
import { StorageService } from '../storage/storage.service';
import { StorageModule } from '../storage/storage.module';
import { v4 as uuidv4 } from 'uuid';

@Controller('public')
@UseGuards(ApiKeyGuard)
export class PublicController {
    constructor(
        private jobsService: JobsService,
        private applicantsService: ApplicantsService,
        private storageService: StorageService
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
    async createApplicant(@Req() req) {
        console.log('[PublicController] createApplicant request received');
        try {
            const companyId = req.companyId;
            const parts = req.parts();
            const data: any = { companyId };
            let resumeUrl: string | undefined;

            for await (const part of parts) {
                if (part.file) {
                    console.log(`[PublicController] Processing file: ${part.filename}`);
                    const buffer = await part.toBuffer();
                    const fileName = `${uuidv4()}_${part.filename}`;
                    resumeUrl = await this.storageService.uploadFile(
                        buffer,
                        `applicants`,
                        fileName,
                        part.mimetype
                    );
                } else {
                    console.log(`[PublicController] Processing field: ${part.fieldname} = ${part.value}`);
                    data[part.fieldname] = part.value;
                }
            }

            console.log('[PublicController] All parts processed, preparing data...');

            // Convert types for Zod
            if (data.yearsOfExperience) data.yearsOfExperience = parseFloat(data.yearsOfExperience);
            if (data.currentSalary) data.currentSalary = parseInt(data.currentSalary, 10);
            if (data.expectedSalary) data.expectedSalary = parseInt(data.expectedSalary, 10);
            if (resumeUrl) data.resumeFile = resumeUrl;
            if (!data.appliedDate) data.appliedDate = new Date().toISOString().split('T')[0];
            if (!data.status) data.status = 'new';

            console.log('[PublicController] Validating data with Zod...');
            const v = ApplicantSchema.safeParse(data);
            if (!v.success) {
                console.warn('[PublicController] Validation failed:', v.error.issues);
                throw new BadRequestException(v.error.issues);
            }

            console.log('[PublicController] Calling ApplicantsService.create...');
            const result = await this.applicantsService.create(v.data as Applicant);
            console.log('[PublicController] Applicant created successfully');
            return result;
        } catch (error) {
            console.error('[PublicController] Error in createApplicant:', error);
            if (error instanceof BadRequestException) throw error;
            throw new BadRequestException({
                message: 'An error occurred while processing your application.',
                error: error.message,
                stack: error.stack
            });
        }
    }
}

@Module({
    imports: [StorageModule],
    controllers: [PublicController],
    providers: [JobsService, ApplicantsService],
})
export class PublicModule { }
