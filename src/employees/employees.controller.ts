import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Req, Query } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { AuthGuard } from '../auth/auth.guard';
import { Employee, EmployeeSchema } from '../schemas/hr.schema';

@Controller('employees')
@UseGuards(AuthGuard)
export class EmployeesController {
    constructor(private readonly employeesService: EmployeesService) { }

    @Post()
    async create(@Body() data: Employee) {
        const result = EmployeeSchema.safeParse(data);
        if (!result.success) {
            throw new Error('Validation failed: ' + JSON.stringify(result.error.issues));
        }
        return this.employeesService.create(data);
    }

    @Get()
    async findAll(@Query('companyId') companyId: string) {
        // In real app, extract companyId from auth token to enforce isolation
        return this.employeesService.findAll(companyId);
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.employeesService.findOne(id);
    }

    @Put(':id')
    async update(@Param('id') id: string, @Body() data: Partial<Employee>) {
        return this.employeesService.update(id, data);
    }

    @Delete(':id')
    async remove(@Param('id') id: string) {
        return this.employeesService.delete(id);
    }
}
