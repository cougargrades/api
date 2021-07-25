import * as functions from 'firebase-functions';
import { db, FieldValue } from '../_firebaseHelper';
import { is } from 'typescript-is';
import { Patchfile as PF, PatchfileUtil } from '@cougargrades/types';
import Patchfile = PF.Patchfile;

export const whenPatchFileAdded = functions
  .runWith({ timeoutSeconds: 540 })
  .firestore.document('patchfile_queue/{qid}')
  .onCreate(async (snapshot, context) => {
    const selfRef = db.collection('patchfile_queue').doc(context.params.qid);

    try {
      // even though we're using a validator in the Express.js definition, we should double check here
      const selfData = snapshot.data();
      if (is<Patchfile>(selfData)) {
        // awaits transaction of Patchfile operation sequence
        await PatchfileUtil.executePatchFile(db, FieldValue as any, selfData);

        // does another transaction that only does 1 thing: deletes this self reference
        // because we're using async/await, if a rejected promise is thrown, it appears as an exception thrown
        // which means that (hopefully) this delete isn't called on failed Patchfiles O_O
        await db.runTransaction(async (txn) => {
          await txn.delete(selfRef);
          return txn;
        });
      } else {
        await db.runTransaction(async (txn) => {
          await txn.update(selfRef, {
            __failureReason: 'Record failed interface test'
          });
          return txn;
        })
      }
    } catch (err) {
      await db.runTransaction(async (txn) => {
        const relocatedRef = db.collection('patchfile_queue_failed').doc();
        await txn.create(relocatedRef, Object.assign(snapshot.data(), {
          __failureReason: `Exception occurred: ${err}`
        }));
        await txn.delete(selfRef);
        return txn;
      });
      // we want the Firebase dev console to record this as a real error, after we did some cleanup of the queue
      throw err;
    }
  });
