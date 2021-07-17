
import { db, firebase } from '../src/_firebaseHelper'
import { GradeDistributionCSVRow as GDR } from '@cougargrades/types'
import { GradeDistributionCSVRow } from '@cougargrades/types/dist/GradeDistributionCSVRow'
import { csv, deleteCollections } from './util'

describe('whenUploadQueueAdded', () => {

  /**
   * Load sample data into the database before running the tests
   * Allows a 1 minute timeout
   */
  beforeAll((done) => {
    (async () => {
      // Clear database
      await deleteCollections(['catalog', 'sections', 'instructors', 'meta', 'groups'])

      // Read data in from CSV file
      let rows: GradeDistributionCSVRow[] = [];
      for (const record of csv('sample002.csv')) {
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
  }, 1 * 60e3);

  afterAll(async () => {
    // Prevents "A worker process has failed to exit gracefully and has been force exited."
    await db.terminate();
    await firebase.delete();
  })

  test('upload_queue is empty', async () => {
    let docs = await db.collection('upload_queue').listDocuments();
    expect(docs.length).toEqual(0)
  })

  test('sections is not empty', async () => {
    let docs = await db.collection('sections').listDocuments();
    expect(docs.length).toBeGreaterThan(0)
  })
})
