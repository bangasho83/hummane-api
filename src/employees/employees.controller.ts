import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Req, Query } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { AuthGuard } from '../auth/auth.guard';
import { Employee, EmployeeSchema } from '../schemas/hr.schema';

@Controller('employees')
@UseGuards(AuthGuard)
export class EmployeesController {
    constructor(private readonly employeesService: EmployeesService) { }

    @Post()
    async create(@Body() data: Employee, @Req() req) {
        const user = req.user;
        if (!user.companyId) throw new Error('User does not belong to a company');

        // 1. Force companyId from token
        data.companyId = user.companyId;

        // 2. Validate and retrieve clean data
        const result = EmployeeSchema.safeParse(data);
        if (!result.success) {
            throw new Error('Validation failed: ' + JSON.stringify(result.error.issues));
        }

        // 3. Persist validated data
        return this.employeesService.create(result.data as Employee);
    }

    @Get()
    async findAll(@Req() req) {
        const user = req.user;
        if (!user.companyId) return []; // Or throw error
        return this.employeesService.findAll(user.companyId);
    }

    @Get(':id')
    async findOne(@Param('id') id: string, @Req() req) {
        const user = req.user;
        if (!user.companyId) return null;
        return this.employeesService.findOne(id, user.companyId);
    }

    @Put(':id')
    async update(@Param('id') id: string, @Body() data: Partial<Employee>, @Req() req) {
        const user = req.user;
        if (!user.companyId) throw new Error('User does not belong to a company');
        return this.employeesService.update(id, data, user.companyId);
    }

    @Delete(':id')
    async remove(@Param('id') id: string, @Req() req) {
        const user = req.user;
        if (!user.companyId) throw new Error('User does not belong to a company');
        return this.employeesService.delete(id, user.companyId);
    }
}
