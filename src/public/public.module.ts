import { BadRequestException, Module, Controller, Get, Post, Body, UseGuards, Req, Query } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { JobsService } from '../jobs/jobs.module';
import { ApplicantsService } from '../applicants/applicants.module';
import { ApplicantSchema, Applicant } from '../schemas/hr.schema';
import { StorageService } from '../storage/storage.service';
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
        const companyId = req.companyId;

        // Since we registered @fastify/multipart, we can use req.file() or req.parts()
        // We'll use parts to handle both fields and the file
        const parts = req.parts();
        const data: any = { companyId };
        let resumeUrl: string | undefined;

        for await (const part of parts) {
            if (part.file) {
                // Handle file
                const buffer = await part.toBuffer();
                const fileName = `${uuidv4()}_${part.filename}`;
                resumeUrl = await this.storageService.uploadFile(
                    buffer,
                    `applicants`,
                    fileName,
                    part.mimetype
                );
            } else {
                // Handle field
                // Fastify multipart fields are strings, but our schema expects numbers for some fields
                // We'll parse them later or let Zod handle it if we cast
                data[part.fieldname] = part.value;
            }
        }

        // Convert types for Zod (Fastify multipart sends everything as strings)
        if (data.yearsOfExperience) data.yearsOfExperience = parseFloat(data.yearsOfExperience);
        if (data.currentSalary) data.currentSalary = parseInt(data.currentSalary, 10);
        if (data.expectedSalary) data.expectedSalary = parseInt(data.expectedSalary, 10);
        if (resumeUrl) data.resumeFile = resumeUrl;
        if (!data.appliedDate) data.appliedDate = new Date().toISOString().split('T')[0];
        if (!data.status) data.status = 'new';

        // Basic validation
        const v = ApplicantSchema.safeParse(data);
        if (!v.success) {
            throw new BadRequestException(v.error.issues);
        }

        return this.applicantsService.create(v.data as Applicant);
    }
}

@Module({
    imports: [StorageModule],
    controllers: [PublicController],
    providers: [JobsService, ApplicantsService],
})
export class PublicModule { }
