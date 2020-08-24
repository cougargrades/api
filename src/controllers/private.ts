import { Request, Response } from 'express';
import firebase from '../util/firebase';
import { GradeDistributionCSVRow } from '@cougargrades/types';

export async function getSelfToken(req: Request, res: Response) {
  try {
    let access_token = req.get('X-Access-Token'); // retrieves the X-Access-Token header field
    let doc = firebase.firestore().collection('tokens').doc(access_token!);
    let snapshot = await doc.get();
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
    let record = new GradeDistributionCSVRow(
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

    let doc = await firebase
      .firestore()
      .collection('upload_queue')
      .add(Object.assign({}, record));

    return res.status(200).json(doc.path);
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
}
