import { db } from '../src/_firebaseHelper'
import { firebaseCleanup, loadSampleData } from './util'

describe('whenUploadQueueAdded', () => {
  describe('sample002.csv', () => {
    /**
     * Load sample data into the database before running the tests
     * Allows a 1 minute timeout
     */
    beforeAll((done) => {
      loadSampleData('sample002.csv', done);
    }, 1 * 60e3);

    afterAll(async () => {
      await firebaseCleanup();
    })

    test('upload_queue is empty', async () => {
      let docs = await db.collection('upload_queue').listDocuments();
      expect(docs.length).toEqual(0)
    })

    test('sections is not empty', async () => {
      let docs = await db.collection('sections').listDocuments();
      expect(docs.length).toBeGreaterThan(0)
    })

    test('COSC 1306', async () => {
      let doc = await db.doc('/catalog/COSC 1306').get();
      expect(doc.exists).toEqual(true);
      expect(doc.data()).toHaveProperty('catalogNumber', '1306')
      expect(doc.data()).toHaveProperty('department', 'COSC')
      expect(doc.data()).toHaveProperty('description', 'Computer Science & Program')
      expect(doc.data()).toHaveProperty('enrollment.totalA', 154)
      expect(doc.data()).toHaveProperty('enrollment.totalB', 74)
      expect(doc.data()).toHaveProperty('enrollment.totalC', 10)
      expect(doc.data()).toHaveProperty('enrollment.totalD', 0)
      expect(doc.data()).toHaveProperty('enrollment.totalEnrolled', 286)
      expect(doc.data()).toHaveProperty('enrollment.totalF', 0)
      expect(doc.data()).toHaveProperty('enrollment.totalW', 48)
      expect(doc.data()).toHaveProperty('firstTaught', 202101)
      expect(doc.data()).toHaveProperty('GPA')
      expect(doc.data()!.GPA.average).toBeCloseTo(1.889)
      expect(doc.data()!.GPA.maximum).toBeCloseTo(2.472)
      expect(doc.data()!.GPA.median).toBeCloseTo(0)
      expect(doc.data()!.GPA.minimum).toBeCloseTo(1.027)
      expect(doc.data()!.GPA.range).toBeCloseTo(1.445)
      expect(doc.data()!.GPA.standardDeviation).toBeCloseTo(0.485)
    })
  })
})
