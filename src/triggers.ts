import * as functions from 'firebase-functions';
import firebase from './util/firebase';
import { firestore } from 'firebase-admin';
import {
  GradeDistributionCSVRow,
  Course,
  //Section,
  Instructor,
  Util,
  GPA,
} from '@cougargrades/types';
const { FieldValue: FieldValue } = firestore;
const db = firebase.firestore();

export const whenUploadQueueAdded2 = functions
  .runWith({ memory: '512MB', timeoutSeconds: 540 })
  .firestore.document('upload_queue/{qid}')
  .onCreate(async (snapshot, context) => {
    // process upload
    const selfRef = db.collection('upload_queue').doc(context.params.qid);
    const record = new GradeDistributionCSVRow(
      snapshot.data()['TERM'],
      snapshot.data()['SUBJECT'],
      snapshot.data()['CATALOG_NBR'],
      snapshot.data()['CLASS_SECTION'],
      snapshot.data()['COURSE_DESCR'],
      snapshot.data()['INSTR_LAST_NAME'],
      snapshot.data()['INSTR_FIRST_NAME'],
      snapshot.data()['A'],
      snapshot.data()['B'],
      snapshot.data()['C'],
      snapshot.data()['D'],
      snapshot.data()['F'],
      snapshot.data()['TOTAL_DROPPED'],
      snapshot.data()['AVG_GPA'],
    );
    db.runTransaction(async (txn) => {
      // create all references (to locations that may not exist)
      const courseRef = db.collection('catalog').doc(record.getCourseMoniker());
      const sectionRef = db
        .collection('sections')
        .doc(record.getSectionMoniker());
      const instructorRef = db
        .collection('instructors')
        .doc(record.getInstructorMoniker());
      const catalogMetaRef = db.collection('meta').doc('catalog');

      // perform all reads
      const courseSnap = await txn.get(courseRef);
      const sectionSnap = await txn.get(sectionRef);
      const instructorSnap = await txn.get(instructorRef);
      const catalogMetaSnap = await txn.get(catalogMetaRef);
      let courseData: Course;
      //let sectionData: Section;
      let instructorData: Instructor;

      ////
      //
      // Check Firestore for existence of all the things and set defaults
      //
      ////

      // if the catalog meta doesn't exist
      if (!catalogMetaSnap.exists) {
        // create catalog meta with default values (current course)
        await txn.set(catalogMetaRef, {
          latestTerm: record.TERM,
        });
      } else {
        // if the catalog meta already exists, compare its term to the proposed term
        if (Util.termCode(record.TERM) > catalogMetaSnap.data()!.latestTerm) {
          // update the "latestTerm" value
          await txn.update(catalogMetaRef, {
            latestTerm: Util.termCode(record.TERM),
          });
        }
      }

      // if course doesn't exist
      if (!courseSnap.exists) {
        // create default course with record data
        await txn.set(courseRef, record.toCourse());
        courseData = Object.assign({}, record.toCourse());
      } else {
        // if course already exists
        // save real course data
        courseData = Course.prototype.cloneFrom(courseSnap.data() as Course);
      }

      // if section doesn't exist
      if (!sectionSnap.exists) {
        // add section to course with record data (save reference)
        // insert instructorRef and courseRef
        const t = Object.assign(record.toSection(), {
          instructors: [instructorRef],
          course: courseRef,
        });
        await txn.set(sectionRef, t);
        //sectionData = Object.assign({}, t);
      } else {
        // update existing section to include additional instructor
        // sectionData = Section.prototype.cloneFrom(
        //   sectionSnap.data() as Section,
        // );
        await txn.update(sectionRef, {
          instructorNames: FieldValue.arrayUnion({
            firstName: record.INSTR_FIRST_NAME,
            lastName: record.INSTR_LAST_NAME,
          }),
          instructors: FieldValue.arrayUnion(instructorRef), // add reference to instructor that might not exist yet
        });
      }

      // if instructor doesn't exist
      if (!instructorSnap.exists) {
        // create default instructor with record data
        await txn.set(instructorRef, record.toInstructor());
        instructorData = Object.assign({}, record.toInstructor());
      } else {
        // if instructor already exists
        // save instructor course data
        instructorData = Instructor.prototype.cloneFrom(
          instructorSnap.data() as Instructor,
        );
      }

      ////
      //
      // Set complex updates now that defaults have been initialized
      //
      ////

      // update GPA statistics
      const courseGPA = GPA.prototype.cloneFrom(courseData.GPA);
      if (record.AVG_GPA !== undefined) courseGPA.include(record.AVG_GPA);
      // only update course data if this section doesnt already exist
      // TL;DR dont double-count sections with multiple instructors
      if (!sectionSnap.exists) {
        // if the section didn't exist already, update all the counters for this Course
        await txn.update(courseRef, {
          instructors: FieldValue.arrayUnion(instructorRef),
          sections: FieldValue.arrayUnion(sectionRef),
          sectionCount: courseData.sectionCount + 1,
          'GPA._average.n': courseGPA._average.n,
          'GPA._average.sum': courseGPA._average.sum,
          'GPA.average': courseGPA._average.value(),
          'GPA._standardDeviation.n': courseGPA._standardDeviation.n,
          'GPA._standardDeviation.delta': courseGPA._standardDeviation.delta,
          'GPA._standardDeviation.mean': courseGPA._standardDeviation.mean,
          'GPA._standardDeviation.M2': courseGPA._standardDeviation.M2,
          'GPA._standardDeviation.ddof': courseGPA._standardDeviation.ddof,
          'GPA.standardDeviation': courseGPA._standardDeviation.value(),
          'GPA.maximum': courseGPA._mmr.maximum,
          'GPA.minimum': courseGPA._mmr.minimum,
          'GPA.range': courseGPA._mmr.range,
          // TODO: median
        });
      } else {
        // if the section DID already exist, update only the `instructors` field
        // FieldValue.arrayUnion() dedupes this
        await txn.update(courseRef, {
          instructors: FieldValue.arrayUnion(instructorRef),
        });
      }

      /**
         * this extra temporary variable nonsense is necessary because 
         * Javascript doesn't let you use template strings when defining 
         * the key of a literal object.
         * 
         * Example (valid):
                {
                    'hello world': 2
                }
                obj['hello world'] => 2
            Example (syntax error)
                {
                    `hello ${name}`: 2
                }
                obj[`hello ${name}`] => 2
         */

      // test if instructor has taught this course before
      const hasTaught = () =>
        Util.isDocumentReferenceArray(instructorData.courses)
          ? instructorData.courses
              .map((e) => e.id)
              .includes(record.getCourseMoniker())
          : instructorData.courses
              .map((e) => e._id)
              .includes(record.getCourseMoniker());
      const not = (exp: any) => !exp;

      // If section previously existed AND the new record is for the same instructor, this is a duplicate
      // So DONT do the following if this is a duplicate
      // ...see that little `not()` right there?
      if (
        not(
          sectionSnap.exists &&
            instructorData.firstName === record.INSTR_FIRST_NAME &&
            instructorData.lastName === record.INSTR_LAST_NAME,
        )
      ) {
        // update GPA statistics
        const instructorGPA = GPA.prototype.cloneFrom(instructorData.GPA);
        if (record.AVG_GPA !== undefined) instructorGPA.include(record.AVG_GPA);
        const toUpdate: any = {
          courses: FieldValue.arrayUnion(courseRef),
          courses_count: hasTaught()
            ? FieldValue.increment(0)
            : FieldValue.increment(1),
          sections: FieldValue.arrayUnion(sectionRef),
          sections_count: FieldValue.increment(1),
          'GPA._average.n': instructorGPA._average.n,
          'GPA._average.sum': instructorGPA._average.sum,
          'GPA.average': instructorGPA._average.value(),
          'GPA._standardDeviation.n': instructorGPA._standardDeviation.n,
          'GPA._standardDeviation.delta':
            instructorGPA._standardDeviation.delta,
          'GPA._standardDeviation.mean': instructorGPA._standardDeviation.mean,
          'GPA._standardDeviation.M2': instructorGPA._standardDeviation.M2,
          'GPA._standardDeviation.ddof': instructorGPA._standardDeviation.ddof,
          'GPA.standardDeviation': instructorGPA._standardDeviation.value(),
          'GPA.maximum': instructorGPA._mmr.maximum,
          'GPA.minimum': instructorGPA._mmr.minimum,
          'GPA.range': instructorGPA._mmr.range,
          // TODO: median
        };
        // update department count, initialize count if does not exist
        toUpdate[`departments.${record.SUBJECT}`] =
          (instructorData.departments as any)[record.SUBJECT] === undefined
            ? 1
            : FieldValue.increment(1);
        await txn.update(instructorRef, toUpdate);
      }

      await txn.delete(selfRef);
      return txn;
    });
  });
