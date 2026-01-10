import { Injectable } from '@nestjs/common';
import { FirestoreService } from '../firestore/firestore.service';
import { User, UserSchema } from '../schemas/core.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UsersService {
    private collectionName = 'users';

    constructor(private firestoreService: FirestoreService) { }

    async create(userData: User): Promise<User> {
        const id = userData.id || uuidv4();
        const newUser = {
            ...userData,
            id,
            createdAt: new Date().toISOString(),
        };

        await this.firestoreService.getCollection(this.collectionName).doc(id).set(newUser);
        return newUser;
    }

    async findAll(companyId?: string): Promise<User[]> {
        let query: FirebaseFirestore.Query = this.firestoreService.getCollection(this.collectionName);
        if (companyId) {
            query = query.where('companyId', '==', companyId);
        }
        const snapshot = await query.get();
        return snapshot.docs.map(doc => doc.data() as User);
    }

    async findOne(id: string): Promise<User | null> {
        const doc = await this.firestoreService.getCollection(this.collectionName).doc(id).get();
        if (!doc.exists) return null;
        return doc.data() as User;
    }

    async findByEmail(email: string): Promise<User | null> {
        const snapshot = await this.firestoreService.getCollection(this.collectionName).where('email', '==', email).limit(1).get();
        if (snapshot.empty) return null;
        return snapshot.docs[0].data() as User;
    }

    async update(id: string, updateData: Partial<User>): Promise<User | null> {
        const docRef = this.firestoreService.getCollection(this.collectionName).doc(id);
        const doc = await docRef.get();
        if (!doc.exists) return null;

        const updatedUser = { ...doc.data(), ...updateData, updatedAt: new Date().toISOString() };
        await docRef.set(updatedUser, { merge: true });
        return updatedUser as User;
    }

    async delete(id: string): Promise<void> {
        await this.firestoreService.getCollection(this.collectionName).doc(id).delete();
    }
}
