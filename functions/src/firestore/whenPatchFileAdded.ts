import * as functions from 'firebase-functions';
import { firestore } from 'firebase-admin';
const { FieldValue } = firestore;
import { db } from '../_firebaseHelper';
import { is } from 'typescript-is';
import { AppendAction, CreateAction, IncrementAction, MergeAction, Patchfile, WriteAction } from '@cougargrades/types/dist/Patchfile';

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
        await processPatchFile(selfData);

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

async function processPatchFile(patch: Patchfile) {
  await db.runTransaction(async (txn) => {
    for (const action of patch.actions) {
      if (action.operation === 'write')
        await commitPatchWriteOperation(txn, patch, action as WriteAction);
      if (action.operation === 'merge')
        await commitPatchMergeOperation(txn, patch, action as MergeAction);
      if (action.operation === 'append')
        await commitPatchAppendOperation(txn, patch, action as AppendAction);
      if (action.operation === 'increment')
        await commitPatchIncrementOperation(
          txn,
          patch,
          action as IncrementAction,
        );
      if (action.operation === 'create')
        await commitPatchCreateOperation(txn, patch, action as CreateAction);
    }
    return txn;
  });
}

/**
 * Document exclusive operations
 */
async function commitPatchWriteOperation(
  txn: firestore.Transaction,
  patch: Patchfile,
  action: WriteAction,
) {
  const ref = db.doc(patch.target.path);
  await txn.set(ref, action.payload, { merge: false });
}

async function commitPatchMergeOperation(
  txn: firestore.Transaction,
  patch: Patchfile,
  action: MergeAction,
) {
  const ref = db.doc(patch.target.path);
  const snap = await txn.get(ref);
  if (snap.exists) {
    await txn.set(ref, action.payload, { merge: true });
  }
}

async function commitPatchAppendOperation(
  txn: firestore.Transaction,
  patch: Patchfile,
  action: AppendAction,
) {
  const ref = db.doc(patch.target.path);
  const temp: any = {};

  if(action.datatype === 'firebase.firestore.DocumentReference') {
    const refToAppend = db.doc(action.payload);
    temp[action.arrayfield] = FieldValue.arrayUnion(refToAppend);
  }
  else {
    temp[action.arrayfield] = FieldValue.arrayUnion(action.payload);
  }

  await txn.update(ref, temp);
}

async function commitPatchIncrementOperation(
  txn: firestore.Transaction,
  patch: Patchfile,
  action: IncrementAction,
) {
  const ref = db.doc(patch.target.path);

  const temp: any = {};
  temp[action.field] = FieldValue.increment(action.payload);

  await txn.update(ref, temp);
}

/**
 * Collection exclusive operations
 */
async function commitPatchCreateOperation(
  txn: firestore.Transaction,
  patch: Patchfile,
  action: CreateAction,
) {
  const collection = db.collection(patch.target.path);

  await txn.create(collection.doc(), action.payload);
}