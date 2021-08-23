
import { db } from '../src/_firebaseHelper'

describe('emulator', () => {
  test('can read and write to firestore', async () => {
    // sample data
    const data = { hello: 'world', sample: null };
    // gets a reference
    let docRef = db.collection('test').doc('foo');
    // attempts a write
    await docRef.set(data);
    // attempts a read
    let docSnap = await db.collection('test').doc('foo').get();
    // check if the write was successful
    expect(docSnap.exists).toEqual(true);
    expect(docSnap.data()).toEqual(data);
  })
})
