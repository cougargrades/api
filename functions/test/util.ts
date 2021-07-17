import * as fs from 'fs'
import * as path from 'path'
import * as csvParser from 'csv-parse/lib/sync'
import { path as root } from 'app-root-path'
import { db, firebase } from '../src/_firebaseHelper'
import { GradeDistributionCSVRow as GDR } from '@cougargrades/types'
import { GradeDistributionCSVRow } from '@cougargrades/types/dist/GradeDistributionCSVRow'

/**
 * Shortcut function for parsing CSV files
 * @param fileName 
 * @returns 
 */
export function csv(fileName: string): any[] {
  return csvParser(fs.readFileSync(path.resolve(root, 'test', fileName)), { columns: true });
}

/**
 * Delete an entire collection in parallel
 * @param name 
 * @returns 
 */
export async function deleteCollection(name: string): Promise<void> {
  let docs = await db.collection(name).listDocuments()

  // delete in parallel
  await Promise.all(docs.map(e => e.delete()))

  return;
}

/**
 * Delete multiple collections in parallel
 * @param collections 
 * @returns 
 */
export async function deleteCollections(collections: string[]): Promise<void> {
  // delete in parallel
  await Promise.all(collections.map(e => deleteCollection(e)))
  return;
}

export function loadSampleData(sampleFile: string, done: jest.DoneCallback) {
  (async () => {
    // Clear database
    await deleteCollections(['catalog', 'sections', 'instructors', 'meta', 'groups'])

    // Read data in from CSV file
    let rows: GradeDistributionCSVRow[] = [];
    for (const record of csv(sampleFile)) {
      let value = GDR.tryFromRaw(record);
      if(value !== null) rows.push(value);
    }

    // store a counter
    let totalRemovals = 0;
    let totalAdditions = 0;

    // respond to database changes
    const unsubscribe = db.collection('upload_queue').onSnapshot(snapshot => {
      let numRemovals = snapshot.docChanges().filter(e => e.type === 'removed').length;
      let numAdditions = snapshot.docChanges().filter(e => e.type === 'added').length;
      totalRemovals += numRemovals;
      totalAdditions += numAdditions;

      // detect when upload has finished
      if(rows.length === totalRemovals && rows.length === totalAdditions) {
        // Prevents "A worker process has failed to exit gracefully and has been force exited."
        unsubscribe();
        done();
      }
    });

    // actually start upload in parallel
    await Promise.all(rows.map(e => db.collection('upload_queue').add(e)))
  })();
}

export async function firebaseCleanup() {
  // Prevents "A worker process has failed to exit gracefully and has been force exited."
  await db.terminate();
  await firebase.delete();
}
