import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Req } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { AuthGuard } from '../auth/auth.guard';
import { Company, CompanySchema } from '../schemas/core.schema';

@Controller('companies')
@UseGuards(AuthGuard)
export class CompaniesController {
    constructor(private readonly companiesService: CompaniesService) { }

    @Post()
    async create(@Body() companyData: Company, @Req() req) {
        const user = req.user;
        // Force ownerId to be the authenticated user if not provided or to ensure correctness
        if (user && user.uid) {
            companyData.ownerId = user.uid;
        }

        const result = CompanySchema.safeParse(companyData);
        if (!result.success) {
            throw new Error('Validation failed: ' + JSON.stringify(result.error.issues));
        }
        return this.companiesService.create(result.data as Company);
    }

    @Get()
    async findAll(@Req() req) {
        const user = req.user;
        if (!user.companyId) {
            // If they don't have a company link, maybe they own one?
            const owned = await this.companiesService.findByOwner(user.uid);
            return owned ? [owned] : [];
        }
        const company = await this.companiesService.findOne(user.companyId);
        return company ? [company] : [];
    }

    @Get(':id')
    async findOne(@Param('id') id: string, @Req() req) {
        const user = req.user;
        if (user.companyId && id !== user.companyId) {
            // Check if they are owner
            const company = await this.companiesService.findOne(id);
            if (company?.ownerId !== user.uid) {
                return null; // or throw Forbidden
            }
            return company;
        }
        return this.companiesService.findOne(id);
    }

    @Put(':id')
    async update(@Param('id') id: string, @Body() updateData: Partial<Company>, @Req() req) {
        const user = req.user;
        const company = await this.companiesService.findOne(id);
        if (!company) return null;

        // Only owner or someone in the company can update (though usually only owner)
        if (company.ownerId !== user.uid && id !== user.companyId) {
            throw new Error('Forbidden');
        }

        return this.companiesService.update(id, updateData);
    }

    @Delete(':id')
    async remove(@Param('id') id: string, @Req() req) {
        const user = req.user;
        const company = await this.companiesService.findOne(id);
        if (!company) return;

        if (company.ownerId !== user.uid) {
            throw new Error('Forbidden');
        }

        return this.companiesService.delete(id);
    }
}
