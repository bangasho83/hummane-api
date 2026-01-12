import { BadRequestException, Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Req, Query } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { AuthGuard } from '../auth/auth.guard';
import { CompanyGuard } from '../auth/company.guard';
import { Employee, EmployeeSchema } from '../schemas/hr.schema';
import { parseLimit } from '../utils/pagination';

@Controller('employees')
@UseGuards(AuthGuard, CompanyGuard)
export class EmployeesController {
    constructor(private readonly employeesService: EmployeesService) { }

    @Post()
    async create(@Body() data: Employee, @Req() req) {
        const user = req.user;
        // 1. Force companyId from token
        data.companyId = user.companyId;

        // 2. Validate and retrieve clean data
        const result = EmployeeSchema.safeParse(data);
        if (!result.success) {
            throw new BadRequestException(result.error.issues);
        }

        // 3. Persist validated data
        return this.employeesService.create(result.data as Employee);
    }

    @Get()
    async findAll(@Req() req, @Query('limit') limit?: string) {
        const user = req.user;
        return this.employeesService.findAll(user.companyId, parseLimit(limit));
    }

    @Get(':id')
    async findOne(@Param('id') id: string, @Req() req) {
        const user = req.user;
        return this.employeesService.findOne(id, user.companyId);
    }

    @Put(':id')
    async update(@Param('id') id: string, @Body() data: Partial<Employee>, @Req() req) {
        const user = req.user;
        const updateData = { ...data };
        delete (updateData as Partial<Employee>).companyId;
        return this.employeesService.update(id, updateData, user.companyId);
    }

    @Delete(':id')
    async remove(@Param('id') id: string, @Req() req) {
        const user = req.user;
        return this.employeesService.delete(id, user.companyId);
    }
}
