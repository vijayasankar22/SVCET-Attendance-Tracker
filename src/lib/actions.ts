'use server';

import { getAdminServices } from "./firebase-admin";

export async function cleanupOldRecords() {
    const { adminDb } = await getAdminServices();
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const snapshot = await adminDb.collection('lateRecords')   
            .where('timestamp', '>=', today)
            .orderBy('timestamp', 'desc')
            .limit(2)
            .get();

        if (snapshot.empty) {
            return { message: 'No records found for today to delete.' };
        }

        const batch = adminDb.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        return { message: `Successfully deleted ${snapshot.size} record(s).` };

    } catch (error: any) {
        console.error("Error cleaning up records: ", error);
        throw new Error('Failed to cleanup records. Check server logs for details.');
    }
}

export async function cleanupAllRecords() {
    const { adminDb } = await getAdminServices();
    try {
        const snapshot = await adminDb.collection('lateRecords').limit(500).get();

        if (snapshot.empty) {
            return { message: 'No records found to delete.' };
        }

        const batch = adminDb.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();

        // If there might be more records than the limit, you might want to loop
        // but for a simple cleanup, one batch is fine.
        return { message: `Successfully deleted ${snapshot.size} record(s).` };

    } catch (error: any) {
        console.error("Error deleting all records: ", error);
        throw new Error('Failed to delete all records. Check server logs.');
    }
}

export async function cleanupRecordsBeforeDate() {
    const { adminDb } = await getAdminServices();
    try {
        // Set the target date to September 22, 2025
        const cutoffDate = new Date('2025-09-22T00:00:00Z');

        const snapshot = await adminDb.collection('lateRecords')
            .where('timestamp', '<', cutoffDate)
            .get();

        if (snapshot.empty) {
            return { message: 'No records found before September 22, 2025.' };
        }

        const batch = adminDb.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        return { message: `Successfully deleted ${snapshot.size} record(s) from before Sep 22, 2025.` };

    } catch (error: any) {
        console.error("Error cleaning up old records: ", error);
        throw new Error('Failed to cleanup old records. Check server logs.');
    }
}
