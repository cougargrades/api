import * as functions from 'firebase-functions';
import firebase from './util/firebase';
import { GradeDistributionCSVRow as GDR, Course, Instructor, Util, GPA, Average, StandardDeviation } from '@cougargrades/types';
import { GradeDistributionCSVRow } from '@cougargrades/types/dist/GradeDistributionCSVRow';
import { firestore } from 'firebase-admin';
const { FieldValue: FieldValue } = firestore;
const db = firebase.firestore();
import { is } from 'typescript-is';

export const whenUploadQueueAdded = functions
  .runWith({ memory: '256MB', timeoutSeconds: 540 })
  .firestore.document('upload_queue/{qid}')
  .onCreate(async (snapshot, context) => {
    // process upload
    const selfRef = db.collection('upload_queue').doc(context.params.qid);

    // if snapshot data is NOT the format we want, don't process this document
    if(!is<GradeDistributionCSVRow>(snapshot.data())) {
      console.error('Record failed interface test: ', snapshot.data());
      return;
    }

    const record = snapshot.data() as GradeDistributionCSVRow;

    const transaction = db.runTransaction(async (txn) => {
      // create all references (to locations that may not exist)
      const courseRef = db.collection('catalog').doc(GDR.getCourseMoniker(record));
      const sectionRef = db
        .collection('sections')
        .doc(GDR.getSectionMoniker(record));
      const instructorRef = db
        .collection('instructors')
        .doc(GDR.getInstructorMoniker(record));
      const catalogMetaRef = db.collection('meta').doc('catalog');

      // perform all reads
      const courseSnap = await txn.get(courseRef);
      const sectionSnap = await txn.get(sectionRef);
      const instructorSnap = await txn.get(instructorRef);
      const catalogMetaSnap = await txn.get(catalogMetaRef);
      let courseData: Course;
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
        await txn.set(courseRef, GDR.toCourse(record));
        courseData = GDR.toCourse(record);
      } else {
        // if course already exists
        // save real course data
        courseData = courseSnap.data() as Course;
      }

      // if section doesn't exist
      if (!sectionSnap.exists) {
        // add section to course with record data (save reference)
        // insert instructorRef and courseRef
        
        const t = Object.assign(
          GDR.toSection(record),
          {
            instructors: [instructorRef],
            course: courseRef,
          },
        );
        await txn.set(sectionRef, t);
      } else {
        // update existing section to include additional instructor
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
        await txn.set(
          instructorRef,
          GDR.toInstructor(record),
        );
        instructorData = GDR.toInstructor(record);
      } else {
        // if instructor already exists
        // save instructor course data
        instructorData = instructorSnap.data() as Instructor;
      }

      ////
      //
      // Set complex updates now that defaults have been initialized
      //
      ////

      // update GPA statistics
      // only update course data if this section doesnt already exist
      // TL;DR dont double-count sections with multiple instructors
      if (!sectionSnap.exists) {
        // if the section didn't exist already, update all the counters for this Course
        if (courseSnap.exists) {
          if (record.AVG_GPA !== undefined)
            GPA.include(courseData.GPA, record.AVG_GPA);

          courseData.enrollment.totalA += GDR.toCourse(record).enrollment.totalA;
          courseData.enrollment.totalB += GDR.toCourse(record).enrollment.totalB;
          courseData.enrollment.totalC += GDR.toCourse(record).enrollment.totalC;
          courseData.enrollment.totalD += GDR.toCourse(record).enrollment.totalD;
          courseData.enrollment.totalF += GDR.toCourse(record).enrollment.totalF;
          courseData.enrollment.totalQ += GDR.toCourse(record).enrollment.totalQ;
          courseData.enrollment.totalEnrolled += GDR.toCourse(record).enrollment.totalEnrolled;

          courseData.firstTaught = Math.min(
            courseData.firstTaught,
            GDR.toCourse(record).firstTaught,
          );
          courseData.lastTaught = Math.max(
            courseData.lastTaught,
            GDR.toCourse(record).lastTaught,
          );
        }

        await txn.update(courseRef, {
          instructors: FieldValue.arrayUnion(instructorRef),
          sections: FieldValue.arrayUnion(sectionRef),
          sectionCount: courseData.sectionCount + 1,
          'GPA._average.n': courseData.GPA._average.n,
          'GPA._average.sum': courseData.GPA._average.sum,
          'GPA.average': Average.value(courseData.GPA._average),
          'GPA._standardDeviation.n': courseData.GPA._standardDeviation.n,
          'GPA._standardDeviation.delta': courseData.GPA._standardDeviation.delta,
          'GPA._standardDeviation.mean': courseData.GPA._standardDeviation.mean,
          'GPA._standardDeviation.M2': courseData.GPA._standardDeviation.M2,
          'GPA._standardDeviation.ddof': courseData.GPA._standardDeviation.ddof,
          'GPA.standardDeviation': StandardDeviation.value(courseData.GPA._standardDeviation),
          'GPA.maximum': courseData.GPA._mmr.maximum,
          'GPA.minimum': courseData.GPA._mmr.minimum,
          'GPA.range': courseData.GPA._mmr.range,
          'enrollment.totalA': courseData.enrollment.totalA,
          'enrollment.totalB': courseData.enrollment.totalB,
          'enrollment.totalC': courseData.enrollment.totalC,
          'enrollment.totalD': courseData.enrollment.totalD,
          'enrollment.totalF': courseData.enrollment.totalF,
          'enrollment.totalQ': courseData.enrollment.totalQ,
          'enrollment.totalEnrolled': courseData.enrollment.totalEnrolled,
          firstTaught: courseData.firstTaught,
          lastTaught: courseData.lastTaught,
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
              .includes(GDR.getCourseMoniker(record))
          : instructorData.courses
              .map((e) => e._id)
              .includes(GDR.getCourseMoniker(record));
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
        if (instructorSnap.exists) {
          if (record.AVG_GPA !== undefined)
            GPA.include(instructorData.GPA, record.AVG_GPA);

          instructorData.enrollment.totalA += GDR.toInstructor(record).enrollment.totalA;
          instructorData.enrollment.totalB += GDR.toInstructor(record).enrollment.totalB;
          instructorData.enrollment.totalC += GDR.toInstructor(record).enrollment.totalC;
          instructorData.enrollment.totalD += GDR.toInstructor(record).enrollment.totalD;
          instructorData.enrollment.totalF += GDR.toInstructor(record).enrollment.totalF;
          instructorData.enrollment.totalQ += GDR.toInstructor(record).enrollment.totalQ;
          instructorData.enrollment.totalEnrolled += GDR.toInstructor(record).enrollment.totalEnrolled;
        }
        const toUpdate: any = {
          courses: FieldValue.arrayUnion(courseRef),
          courses_count: hasTaught()
            ? FieldValue.increment(0)
            : FieldValue.increment(1),
          sections: FieldValue.arrayUnion(sectionRef),
          sections_count: FieldValue.increment(1),
          'GPA._average.n': instructorData.GPA._average.n,
          'GPA._average.sum': instructorData.GPA._average.sum,
          'GPA.average': Average.value(instructorData.GPA._average),
          'GPA._standardDeviation.n': instructorData.GPA._standardDeviation.n,
          'GPA._standardDeviation.delta': instructorData.GPA._standardDeviation.delta,
          'GPA._standardDeviation.mean':
            instructorData.GPA._standardDeviation.mean,
          'GPA._standardDeviation.M2': instructorData.GPA._standardDeviation.M2,
          'GPA._standardDeviation.ddof':
            instructorData.GPA._standardDeviation.ddof,
          'GPA.standardDeviation': StandardDeviation.value(instructorData.GPA._standardDeviation),
          'GPA.maximum': instructorData.GPA._mmr.maximum,
          'GPA.minimum': instructorData.GPA._mmr.minimum,
          'GPA.range': instructorData.GPA._mmr.range,
          'enrollment.totalA': instructorData.enrollment.totalA,
          'enrollment.totalB': instructorData.enrollment.totalB,
          'enrollment.totalC': instructorData.enrollment.totalC,
          'enrollment.totalD': instructorData.enrollment.totalD,
          'enrollment.totalF': instructorData.enrollment.totalF,
          'enrollment.totalQ': instructorData.enrollment.totalQ,
          'enrollment.totalEnrolled': instructorData.enrollment.totalEnrolled,
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

    try {
      await transaction;
    } catch (err) {
      console.error(err);
      // Error: 10 ABORTED: Too much contention on these documents. Please try again.
      // see: https://github.com/cougargrades/api-2.0.0/issues/24
      if (err.code === 10) {
        // If the transaction timed out due to contention, add it back to the queue up to 3 times.
        const retryCount = snapshot.data().__retryCount || 0;
        // please work, i dont want a recursive mess
        if (retryCount < 3) {
          // idk how we would fail to delete a unique doc then create a unique doc, so imma leave it
          await db.runTransaction(async (txn) => {
            // new document that will try this whole process again while this execution can terminate
            const survivorRef = db.collection('upload_queue').doc();
            await txn.delete(selfRef);
            await txn.set(
              survivorRef,
              Object.assign(snapshot.data(), { __retryCount: retryCount + 1 }),
            );
          });
        } else {
          throw new Error(`Re-Queued too many times: ${snapshot.ref.path}`);
        }
      }
    }
  });
