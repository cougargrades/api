import * as functions from 'firebase-functions';

// the only thing we care about from this package is FieldValue
import * as admin from 'firebase-admin';
const { FieldValue } = admin.firestore;

// used for automatically generated Type Guards
import { is } from 'typescript-is';

// our common interfaces
import { Average, Course, GPA, GradeDistributionCSVRow as GDR, Instructor, Section, StandardDeviation, Util } from '@cougargrades/types';
import { GradeDistributionCSVRow } from '@cougargrades/types/dist/GradeDistributionCSVRow';

// preconfigured Firestore intance
import { db } from '../_firebaseHelper';

// the actual function which is the focus of this file
export const whenUploadQueueAdded = functions
  .runWith({ timeoutSeconds: 540 })
  .firestore.document('upload_queue/{qid}')
  .onCreate(async (snapshot, context) => {
    // process upload
    const selfRef = db.collection('upload_queue').doc(context.params.qid);

    // if snapshot data is NOT the format we want, don't process this document
    if (!is<GradeDistributionCSVRow>(snapshot.data())) {
      await db.runTransaction(async (txn) => {
        await txn.update(selfRef, Object.assign(snapshot.data(), {
          __failureReason: 'Record failed interface test'
        }));
        return txn;
      })
      console.error('Record failed interface test: ', snapshot.data());
      return;
    }

    const record = snapshot.data() as GradeDistributionCSVRow;

    const transaction = db.runTransaction(async (txn) => {
      // create all references (to locations that may not exist)
      const courseRef = db
        .collection('catalog')
        .doc(GDR.getCourseMoniker(record));
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
      // denoted variables to cache the result from the snapshot
      let courseData: Course;
      let sectionData: Section;
      let instructorData: Instructor;
      /**
       * Variables to hold the updates we're going to compose, then send off
       * 
       * When updating these partials, a special type will be used because 
       * we will address individual fields with dotted-strings due
       * to how Firestore processes updates.
       * 
       * See: https://firebase.google.com/docs/reference/js/firebase.firestore.Transaction#data:-updatedata
       */
      let courseToUpdate: Partial<Course> & { [key: string]: any } = {};
      let sectionToUpdate: Partial<Section> & { [key: string]: any } = {};
      let instructorToUpdate: Partial<Instructor> & { [key: string]: any } = {};

      /**
       * ----------------
       * Check Firestore for existence of all the things and set defaults.
       * 
       * Default values (provided by @cougargrades/types) CANNOT contain 
       * Firestore document references due to the nature of how the 
       * Firestore SDK works. Because of that, we will update those
       * fields later.
       * ----------------
       */

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
        // cache real course data for use in this trigger
        courseData = courseSnap.data() as Course;
      }

      // if section doesn't exist
      if (!sectionSnap.exists) {
        // create default section with record data
        await txn.set(sectionRef, GDR.toSection(record));
        sectionData = GDR.toSection(record);
      } else {
        sectionData = sectionSnap.data() as Section;
      }

      // if instructor doesn't exist
      if (!instructorSnap.exists) {
        // create default instructor with record data
        await txn.set(instructorRef, GDR.toInstructor(record));
        instructorData = GDR.toInstructor(record);
      } else {
        // if instructor already exists
        // save instructor course data
        instructorData = instructorSnap.data() as Instructor;
      }

      /**
       * ----------------
       * Now that defaults are set, we're going to update all the references set between each document.
       * These references can't be set by @cougargrades/types (see above why), so we have to do it here.
       * ----------------
       */

      // update course to include include instructors
      courseToUpdate = {
        instructors: FieldValue.arrayUnion(instructorRef),
        sections: FieldValue.arrayUnion(sectionRef),
        // include already added fields
        ...courseToUpdate
      };

      // update section to include the instructor submitted
      // arrayUnion prevents a duplicate
      sectionToUpdate = {
        instructorNames: FieldValue.arrayUnion({
          firstName: record.INSTR_FIRST_NAME,
          lastName: record.INSTR_LAST_NAME,
        }),
        instructors: FieldValue.arrayUnion(instructorRef),
        // include already added fields
        ...sectionToUpdate
      };

      instructorToUpdate = {
        courses: FieldValue.arrayUnion(courseRef),
        sections: FieldValue.arrayUnion(sectionRef),
        // include already added fields
        ...instructorToUpdate
      };

      /**
       * ----------------
       * Update GPA stuff
       * ----------------
       */

      // Course
      // if the section doesn't exist, then we want to include this data in our Course calculation
      if (!sectionSnap.exists) {

        /**
         * @cougargrades/types will initialize the Course.GPA field, 
         * so we have to be careful not to overwrite our running total
         * with the starting values of just one.
         * 
         * If the course already exists, we can confidently say that
         * the GPA information inside of courseData is the 
         * running total and NOT the values of just this record.
         */
        if (courseSnap.exists) {
          // check if record has missing AVG
          if (record.AVG_GPA !== undefined) {
            // include in GPA
            GPA.include(courseData.GPA, record.AVG_GPA);

            // stage our updates
            courseToUpdate = {
              'GPA._average.n': courseData.GPA._average.n,
              'GPA._average.sum': courseData.GPA._average.sum,
              'GPA.average': Average.value(courseData.GPA._average),
              'GPA._standardDeviation.n': courseData.GPA._standardDeviation.n,
              'GPA._standardDeviation.delta': courseData.GPA._standardDeviation.delta,
              'GPA._standardDeviation.mean': courseData.GPA._standardDeviation.mean,
              'GPA._standardDeviation.M2': courseData.GPA._standardDeviation.M2,
              'GPA._standardDeviation.ddof': courseData.GPA._standardDeviation.ddof,
              'GPA.standardDeviation': StandardDeviation.value(courseData.GPA._standardDeviation,),
              'GPA._mmr.maximum': courseData.GPA._mmr.maximum,
              'GPA._mmr.minimum': courseData.GPA._mmr.minimum,
              'GPA._mmr.range': courseData.GPA._mmr.range,
              'GPA.maximum': courseData.GPA._mmr.maximum,
              'GPA.minimum': courseData.GPA._mmr.minimum,
              'GPA.range': courseData.GPA._mmr.range,
              ...courseToUpdate
            };
          }
        }
      }

      // Instructor
      /**
       * In premise, we want to include the GPA calculation if the provided 
       * Instructor ISN'T part of the existing known instructors. We don't
       * want to count a section twice for a specific instructor.
       * 
       * However, @cougargrades/types will initialize the Section.instructorNames field
       * when this Section is first created. That means that checking if the
       * Instructor is included in instructorNames works fine for the >=2nd instructor, 
       * but WON'T work for the first instructor.
       * 
       * However, the first instructor is added when the Section doesn't exist, so we can
       * check against that.
       */

      // If the section doesn't exist (first instructor) OR if the proposed instructor isn't included in Section.instructorNames (2nd and onward instructor)
      if (!sectionSnap.exists || (Array.isArray(sectionData.instructorNames) && sectionData.instructorNames.findIndex(e => e.firstName === record.INSTR_FIRST_NAME && e.lastName === record.INSTR_LAST_NAME) === -1)) {

        /**
         * @cougargrades/types will initialize the Instructor.GPA field, 
         * so we have to be careful not to overwrite our running total
         * with the starting values of just one.
         * 
         * If the instructor already exists, we can confidently say that
         * the GPA information inside of instructorData is the 
         * running total and NOT the values of just this record.
         */
        if (instructorSnap.exists) {
          // check if record has missing AVG
          if (record.AVG_GPA !== undefined) {
            // include in GPA
            GPA.include(instructorData.GPA, record.AVG_GPA);

            // stage our updates
            instructorToUpdate = {
              'GPA._average.n': instructorData.GPA._average.n,
              'GPA._average.sum': instructorData.GPA._average.sum,
              'GPA.average': Average.value(instructorData.GPA._average),
              'GPA._standardDeviation.n': instructorData.GPA._standardDeviation.n,
              'GPA._standardDeviation.delta': instructorData.GPA._standardDeviation.delta,
              'GPA._standardDeviation.mean': instructorData.GPA._standardDeviation.mean,
              'GPA._standardDeviation.M2': instructorData.GPA._standardDeviation.M2,
              'GPA._standardDeviation.ddof': instructorData.GPA._standardDeviation.ddof,
              'GPA.standardDeviation': StandardDeviation.value(instructorData.GPA._standardDeviation),
              'GPA.maximum': instructorData.GPA._mmr.maximum,
              'GPA.minimum': instructorData.GPA._mmr.minimum,
              'GPA.range': instructorData.GPA._mmr.range,
              ...instructorToUpdate
            };
          }
        }
      }

      /**
       * ----------------
       * Update Enrollment stuff
       * ----------------
       */

      // if the section doesn't exist, then we want to include this data in our Course calculation
      if (!sectionSnap.exists) {

        /**
         * @cougargrades/types will initialize the Course.Enrollment field, 
         * so we have to be careful not to overwrite our running total
         * with the starting values of just one.
         * 
         * If the course already exists, we can confidently say that
         * the enrollment information inside of courseData is the 
         * running total and NOT the values of just this record.
         */
        if (courseSnap.exists) {

          // get enrollment values for JUST THIS record and NOT the running total
          const { totalA, totalB, totalC, totalD, totalF, totalQ, totalEnrolled } = GDR.toCourse(record).enrollment;

          // stage our updates
          courseToUpdate = {
            'enrollment.totalA': FieldValue.increment(totalA),
            'enrollment.totalB': FieldValue.increment(totalB),
            'enrollment.totalC': FieldValue.increment(totalC),
            'enrollment.totalD': FieldValue.increment(totalD),
            'enrollment.totalF': FieldValue.increment(totalF),
            'enrollment.totalQ': FieldValue.increment(totalQ),
            'enrollment.totalEnrolled': FieldValue.increment(totalEnrolled),
            ...courseToUpdate
          };
        }
      }

      // Instructor
      /**
       * In premise, we want to include the Enrollment calculation if the provided 
       * Instructor ISN'T part of the existing known instructors. We don't
       * want to count a section twice for a specific instructor.
       * 
       * However, @cougargrades/types will initialize the Section.instructorNames field
       * when this Section is first created. That means that checking if the
       * Instructor is included in instructorNames works fine for the >=2nd instructor, 
       * but WON'T work for the first instructor.
       * 
       * However, the first instructor is added when the Section doesn't exist, so we can
       * check against that.
       */

      // If the section doesn't exist (first instructor) OR if the proposed instructor isn't included in Section.instructorNames (2nd and onward instructor)
      if (!sectionSnap.exists || (Array.isArray(sectionData.instructorNames) && sectionData.instructorNames.findIndex(e => e.firstName === record.INSTR_FIRST_NAME && e.lastName === record.INSTR_LAST_NAME) === -1)) {

        /**
         * Now that we've determined that this section hasn't been submitted before with this instructor,
         * we need to verify that this instructor isn't brand new.
         * 
         * If the instructor is brand new, then the enrollment field is already supplied when the instructor
         * was initialized above.
         * 
         * TL;DR Brand new instructors shouldn't be incremented
         * TL;DR Only old instructors should be incremented
         */

        if (instructorSnap.exists) {
          // get enrollment values for JUST THIS record and NOT the running total
          const { totalA, totalB, totalC, totalD, totalF, totalQ, totalEnrolled } = GDR.toInstructor(record).enrollment;

          // stage our updates
          instructorToUpdate = {
            'enrollment.totalA': FieldValue.increment(totalA),
            'enrollment.totalB': FieldValue.increment(totalB),
            'enrollment.totalC': FieldValue.increment(totalC),
            'enrollment.totalD': FieldValue.increment(totalD),
            'enrollment.totalF': FieldValue.increment(totalF),
            'enrollment.totalQ': FieldValue.increment(totalQ),
            'enrollment.totalEnrolled': FieldValue.increment(totalEnrolled),
            ...instructorToUpdate
          };
        }
      }

      /**
       * ----------------
       * Update firstTaught/lastTaught stuff
       * ----------------
       */

      courseToUpdate = {
        firstTaught: Math.min(courseData.firstTaught, Util.termCode(record.TERM)),
        lastTaught: Math.max(courseData.lastTaught, Util.termCode(record.TERM)),
        ...courseToUpdate
      };

      instructorToUpdate = {
        firstTaught: Math.min(instructorData.firstTaught, Util.termCode(record.TERM)),
        lastTaught: Math.max(instructorData.lastTaught, Util.termCode(record.TERM)),
        ...instructorToUpdate
      };

      /**
       * ----------------
       * Update department count stuff
       * ----------------
       */

      // update department count, initialize count if does not exist
      instructorToUpdate[`departments.${record.SUBJECT}`] =
        (instructorData.departments as any)[record.SUBJECT] === undefined
          ? 1
          : FieldValue.increment(1);

      /**
       * ----------------
       * Execute transaction
       * ----------------
       */

      await txn.update(courseRef, courseToUpdate);
      await txn.update(sectionRef, sectionToUpdate);
      await txn.update(instructorRef, instructorToUpdate);
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
        const backlogCount = snapshot.data().__backlogCount || 0;
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
          await db.runTransaction(async (txn) => {
            const backlogRef = db.collection('upload_queue_backlog').doc();
            await txn.delete(selfRef);
            await txn.set(
              backlogRef,
              Object.assign(snapshot.data(), {
                __backlogCount: backlogCount + 1,
              }),
            );
          });
          console.warn(`Re-Queued too many times, adding to backlog: ${snapshot.ref.path}`);
        }
      }
    }
  });