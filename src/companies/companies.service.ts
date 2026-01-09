import { Injectable } from '@nestjs/common';
import { FirestoreService } from '../firestore/firestore.service';
import { Company, CompanySchema } from '../schemas/core.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CompaniesService {
    private collectionName = 'companies';

    constructor(private firestoreService: FirestoreService) { }

    async create(companyData: Company): Promise<Company> {
        const id = companyData.id || uuidv4();
        const newCompany = {
            ...companyData,
            id,
            createdAt: new Date().toISOString(),
        };
        await this.firestoreService.getCollection(this.collectionName).doc(id).set(newCompany);
        return newCompany;
    }

    async findAll(): Promise<Company[]> {
        const snapshot = await this.firestoreService.getCollection(this.collectionName).get();
        return snapshot.docs.map(doc => doc.data() as Company);
    }

    async findOne(id: string): Promise<Company | null> {
        const doc = await this.firestoreService.getCollection(this.collectionName).doc(id).get();
        if (!doc.exists) return null;
        return doc.data() as Company;
    }

    async update(id: string, updateData: Partial<Company>): Promise<Company | null> {
        const docRef = this.firestoreService.getCollection(this.collectionName).doc(id);
        const doc = await docRef.get();
        if (!doc.exists) return null;

        const updatedCompany = { ...doc.data(), ...updateData, updatedAt: new Date().toISOString() }; // updatedAt not in schema but good to have
        await docRef.set(updatedCompany, { merge: true });
        return updatedCompany as Company;
    }

    async delete(id: string): Promise<void> {
        await this.firestoreService.getCollection(this.collectionName).doc(id).delete();
    }
}
