import { Request, Response } from 'express';
import firebase from '../util/firebase';
import { GradeDistributionCSVRow, Patchfile, PatchfileUtil } from '@cougargrades/types';
import { firestore } from 'firebase-admin';
const { FieldValue: FieldValue } = firestore;
import { WriteAction, MergeAction, AppendAction, IncrementAction, CreateAction } from '@cougargrades/types/typings/Patchfile';

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
    const record = new GradeDistributionCSVRow(
      req.body.TERM,
      req.body.SUBJECT,
      req.body.CATALOG_NBR,
      req.body.CLASS_SECTION,
      req.body.COURSE_DESCR,
      req.body.INSTR_LAST_NAME,
      req.body.INSTR_FIRST_NAME,
      req.body.A,
      req.body.B,
      req.body.C,
      req.body.D,
      req.body.F,
      req.body.TOTAL_DROPPED,
      req.body.AVG_GPA,
    );

    const doc = await firebase
      .firestore()
      .collection('upload_queue')
      .add(Object.assign({}, record));

    return res.status(200).json(doc.path);
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
}

export async function uploadPatchFile(req: Request<any, any, Patchfile, any>, res: Response) {
  try {
    if(req.body?.target?.path !== undefined && req.body?.target?.archetype !== undefined) {
      const pf = new Patchfile(req.body?.target?.path, req.body?.target?.archetype);

      for(let item of req.body.actions) {
        if(req.body.target.archetype === 'document') {
          if(item.operation === 'write') {
            pf.write(item.payload);
          }
          else if(item.operation === 'merge') {
            pf.merge(item.payload);
          }
          else if(item.operation === 'append') {
            if(PatchfileUtil.isAppendAction(item)) {
              pf.append(item.arrayfield, item.datatype, item.payload);
            }
          }
          else if(item.operation === 'increment' && PatchfileUtil.isIncrementAction(item)) {
            pf.increment(item.field, item.payload);
          }
        }
        else if(req.body.target.archetype === 'collection') {
          if(item.operation === 'create') {
            pf.create(item.payload);
          }
        }
      }
      //console.log(pf.toString());
      await processPatchFile(pf);
      return res.sendStatus(200);
    }
    else {
      return res.sendStatus(400);
    }
  }
  catch(err) {
    console.error(err);
    return res.sendStatus(500);
  }
}

async function processPatchFile(patch: Patchfile) {
  await firebase.firestore().runTransaction(async (txn) => {
    for(let action of patch.actions) {
      if(action.operation === 'write') await commitPatchWriteOperation(txn, patch, action as WriteAction);
      if(action.operation === 'merge') await commitPatchMergeOperation(txn, patch, action as MergeAction);
      if(action.operation === 'append') await commitPatchAppendOperation(txn, patch, action as AppendAction);
      if(action.operation === 'increment') await commitPatchIncrementOperation(txn, patch, action as IncrementAction);
      if(action.operation === 'create') await commitPatchCreateOperation(txn, patch, action as CreateAction);
    }
    return txn;
  });
}

/**
 * Document exclusive operations
 */

async function commitPatchWriteOperation(txn: firestore.Transaction, patch: Patchfile, action: WriteAction) {
  let ref = firebase.firestore().doc(patch.target.path);
  await txn.set(ref, action.payload, { merge: false });
}

async function commitPatchMergeOperation(txn: firestore.Transaction, patch: Patchfile, action: MergeAction) {
  let ref = firebase.firestore().doc(patch.target.path);
  await txn.set(ref, action.payload, { merge: true });
}

async function commitPatchAppendOperation(txn: firestore.Transaction, patch: Patchfile, action: AppendAction) {
  let ref = firebase.firestore().doc(patch.target.path);

  const temp: any = {};
  temp[action.arrayfield] = FieldValue.arrayUnion(action.payload);

  await txn.update(ref, temp);
}

async function commitPatchIncrementOperation(txn: firestore.Transaction, patch: Patchfile, action: IncrementAction) {
  let ref = firebase.firestore().doc(patch.target.path);

  const temp: any = {};
  temp[action.field] = FieldValue.increment(action.payload);

  await txn.update(ref, temp);
}

/**
 * Collection exclusive operations
 */

async function commitPatchCreateOperation(txn: firestore.Transaction, patch: Patchfile, action: CreateAction) {
  let collection = firebase.firestore().collection(patch.target.path);

  await txn.create(collection.doc(), action.payload);
}
