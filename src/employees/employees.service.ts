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

    async findAll(companyId?: string): Promise<Employee[]> {
        let query: FirebaseFirestore.Query = this.firestoreService.getCollection(this.collectionName);
        if (companyId) {
            query = query.where('companyId', '==', companyId);
        }
        const snapshot = await query.get();
        return snapshot.docs.map(doc => doc.data() as Employee);
    }

    async findOne(id: string): Promise<Employee | null> {
        const doc = await this.firestoreService.getCollection(this.collectionName).doc(id).get();
        if (!doc.exists) return null;
        return doc.data() as Employee;
    }

    async update(id: string, updateData: Partial<Employee>): Promise<Employee | null> {
        const docRef = this.firestoreService.getCollection(this.collectionName).doc(id);
        const doc = await docRef.get();
        if (!doc.exists) return null;

        const updated = { ...doc.data(), ...updateData, updatedAt: new Date().toISOString() };
        await docRef.set(updated, { merge: true });
        return updated as Employee;
    }

    async delete(id: string): Promise<void> {
        await this.firestoreService.getCollection(this.collectionName).doc(id).delete();
    }
}
