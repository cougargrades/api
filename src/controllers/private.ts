import { Request, Response } from 'express';
import firebase from '../util/firebase';
import { firestore } from 'firebase-admin';
const { FieldValue: FieldValue } = firestore;
import { is } from 'typescript-is';
import { GradeDistributionCSVRow } from '@cougargrades/types/dist/GradeDistributionCSVRow';
import {
  Patchfile,
  WriteAction,
  MergeAction,
  AppendAction,
  IncrementAction,
  CreateAction,
} from '@cougargrades/types/dist/Patchfile';

export async function getSelfToken(req: Request, res: Response) {
  try {
    const access_token = req.get('X-Access-Token'); // retrieves the X-Access-Token header field
    const doc = firebase.firestore().collection('tokens').doc(access_token!);
    const snapshot = await doc.get();
    if (!snapshot.exists) {
      return res.sendStatus(404);
    } else {
      return res.status(200).json(snapshot.data());
    }
  } catch (err) {
    console.log(err);
    return res.sendStatus(500);
  }
}

export async function uploadRecord(
  req: Request<any, any, GradeDistributionCSVRow, any>,
  res: Response,
) {
  try {
    // even though we're using a validator in the Express.js definition, we should double check here
    if (is<GradeDistributionCSVRow>(req.body)) {
      const doc = await firebase
        .firestore()
        .collection('upload_queue')
        .add(req.body);

      return res.status(200).json(doc.path);
    } else {
      return res.sendStatus(400);
    }
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
}

export async function uploadPatchFile(
  req: Request<any, any, Patchfile, any>,
  res: Response,
) {
  try {
    // even though we're using a validator in the Express.js definition, we should double check here
    if (is<Patchfile>(req.body)) {
      await processPatchFile(req.body);
      return res.sendStatus(200);
    } else {
      return res.sendStatus(400);
    }
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
}

async function processPatchFile(patch: Patchfile) {
  await firebase.firestore().runTransaction(async (txn) => {
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
  const ref = firebase.firestore().doc(patch.target.path);
  await txn.set(ref, action.payload, { merge: false });
}

async function commitPatchMergeOperation(
  txn: firestore.Transaction,
  patch: Patchfile,
  action: MergeAction,
) {
  const ref = firebase.firestore().doc(patch.target.path);
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
  const ref = firebase.firestore().doc(patch.target.path);

  const temp: any = {};
  temp[action.arrayfield] = FieldValue.arrayUnion(action.payload);

  await txn.update(ref, temp);
}

async function commitPatchIncrementOperation(
  txn: firestore.Transaction,
  patch: Patchfile,
  action: IncrementAction,
) {
  const ref = firebase.firestore().doc(patch.target.path);

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
  const collection = firebase.firestore().collection(patch.target.path);

  await txn.create(collection.doc(), action.payload);
}
