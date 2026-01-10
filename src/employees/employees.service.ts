import { Injectable } from '@nestjs/common';
import { FirestoreService } from '../firestore/firestore.service';
import { Employee } from '../schemas/hr.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class EmployeesService {
    private collectionName = 'employees';

    constructor(private firestoreService: FirestoreService) { }

    async create(data: Employee): Promise<Employee> {
        const id = data.id || uuidv4();
        const newDoc = {
            ...data,
            id,
            createdAt: new Date().toISOString(),
        };
        await this.firestoreService.getCollection(this.collectionName).doc(id).set(newDoc);
        return newDoc;
    }

    async findAll(companyId: string): Promise<Employee[]> {
        // Strict filtering by companyId
        const snapshot = await this.firestoreService.getCollection(this.collectionName)
            .where('companyId', '==', companyId)
            .get();
        return snapshot.docs.map(doc => doc.data() as Employee);
    }

    async findOne(id: string, companyId: string): Promise<Employee | null> {
        const doc = await this.firestoreService.getCollection(this.collectionName).doc(id).get();
        if (!doc.exists) return null;

        const data = doc.data() as Employee;
        if (data.companyId !== companyId) return null; // Enforce isolation

        return data;
    }

    async update(id: string, updateData: Partial<Employee>, companyId: string): Promise<Employee | null> {
        const docRef = this.firestoreService.getCollection(this.collectionName).doc(id);
        const doc = await docRef.get();
        if (!doc.exists) return null;

        const currentData = doc.data() as Employee;
        if (currentData.companyId !== companyId) return null; // Enforce isolation

        const updated = { ...currentData, ...updateData, updatedAt: new Date().toISOString() };
        await docRef.set(updated, { merge: true });
        return updated as Employee;
    }

    async delete(id: string, companyId: string): Promise<void> {
        const docRef = this.firestoreService.getCollection(this.collectionName).doc(id);
        const doc = await docRef.get();

        if (doc.exists) {
            const data = doc.data() as Employee;
            if (data.companyId === companyId) {
                await docRef.delete();
            }
        }
    }
}
