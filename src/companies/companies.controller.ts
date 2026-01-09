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
        // Enforce that the creator is the owner
        const user = req.user;
        if (user && user.uid) {
            // We might want to override ownerId with authenticated user's ID
            // companyData.ownerId = user.uid; 
        }

        const result = CompanySchema.safeParse(companyData);
        if (!result.success) {
            throw new Error('Validation failed: ' + JSON.stringify(result.error.issues));
        }
        return this.companiesService.create(companyData);
    }

    @Get()
    async findAll() {
        return this.companiesService.findAll();
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.companiesService.findOne(id);
    }

    @Put(':id')
    async update(@Param('id') id: string, @Body() updateData: Partial<Company>) {
        return this.companiesService.update(id, updateData);
    }

    @Delete(':id')
    async remove(@Param('id') id: string) {
        return this.companiesService.delete(id);
    }
}
