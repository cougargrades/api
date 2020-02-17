const admin = require('firebase-admin');
const functions = require('firebase-functions');

// production environment
if(process.env.GCP_PROJECT) {
    admin.initializeApp(functions.config().firebase);
}
else {
    // development environment
    let serviceAccount = require('./firebaseadminsdk.json');

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

exports.hello = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.json('World!')
})

exports.catalog = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');

    try {
        if(req.query.department && req.query.catalogNumber) {
            // get exact course
            let query = db.collection('catalog')
                .where('department', '==', req.query.department)
                .where('catalogNumber', '==', req.query.catalogNumber);
            let querySnap = await query.get();
            if(querySnap.empty) {
                res.status(460).json({
                    error: 'Course not found',
                    description: 'A course with those arguments could not be found'
                });
            }
            else {
                // save reference to Course
                let courseRef = querySnap.docs[0].ref;
                // Sort object keys
                let courseSnap = querySnap.docs[0].data()
                let results = {};
                Object.keys(courseSnap).sort().forEach(key => {
                    results[key] = courseSnap[key];
                });
                // secondary query for course sections
                let subquery = courseRef.collection('sections')
                    .orderBy('term', 'desc')
                    .orderBy('sectionNumber', 'asc');
                let snapshot = await subquery.get();
                let docs = snapshot.docs
                    // Extract data from snapshot
                    .map(doc => doc.data())
                    // Delete property that contains Firestore References and confidential API keys
                    .map(doc => { delete doc['instructors']; return doc; })
                    // Sort object keys (https://stackoverflow.com/a/31102605)
                    .map(doc => {
                        const ordered = {};
                        Object.keys(doc).sort().forEach(key => {
                            ordered[key] = doc[key];
                        })
                        return ordered;
                    });
                Object.assign(results, { sections: docs })
                res.status(200).json(results);
            }
        }
        else if(req.query.department) {
            // list courses from department
            let query = db.collection('catalog')
                .where('department', '==', req.query.department)
                .orderBy('catalogNumber', 'asc');
            let snapshot = await query.get();
            if(snapshot.empty) {
                res.status(461).json({
                    error: 'Department not found',
                    description: 'A department with those arguments could not be found'
                });
            }
            else {
                let docs = snapshot.docs
                    // Extract data from snapshot
                    .map(doc => doc.data())
                    // Sort object keys (https://stackoverflow.com/a/31102605)
                    .map(doc => {
                        const ordered = {};
                        Object.keys(doc).sort().forEach(key => {
                            ordered[key] = doc[key];
                        })
                        return ordered;
                    });
                res.status(206).json(docs);
            }
        }
        else {
            res.status(462).json({
                error: 'Insufficient arguments',
                description: 'Please include at least a `department` query parameter.'
            })
        }
    }
    catch(err) {
        console.log(err)
        res.status(500).json({
            error: 'Internal Server Error',
            description: 'The server has encountered a situation it doesn\'t know how to handle.'
        })
    }
})

exports.instructors = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');

    try {
        // if accessing an individual instructor
        if(req.query.fullName) {
            // get exact course
            let query = db.collection('instructors')
                .where('fullName', '==', req.query.fullName)
            let querySnap = await query.get();
            if(querySnap.empty) {
                res.status(404).json({
                    error: 'Course not found',
                    description: 'A course with those arguments could not be found'
                });
            }
            else {
                // save reference to Course
                let instructorRef = querySnap.docs[0].ref;
                // Sort object keys
                let instructorSnap = querySnap.docs[0].data();
                let results = {};
                Object.keys(instructorSnap).sort().forEach(key => {
                    results[key] = instructorSnap[key];
                });

                // get data for "courses"
                let courses = [];
                let coursesPromises = [];
                for(let item of results.courses) {
                    coursesPromises.push(item.get());
                }
                courses = Promise.all(coursesPromises);

                // get data for "sections"
                let sections = [];
                let sectionsPromises = [];
                for(let item of results.sections) {
                    sectionsPromises.push(item.get());
                }
                sections = Promise.all(sectionsPromises);

                // await promise and sort object keys
                results.courses = (await courses)
                                    .map(doc => doc.data())
                                    .map(doc => {
                                        const ordered = {};
                                        Object.keys(doc).sort().forEach(key => {
                                            ordered[key] = doc[key];
                                        })
                                        return ordered;
                                    });
                // await promise, delete sensitive properties, and sort object keys
                results.sections = (await sections)
                                    .map(doc => doc.data())
                                    .map(doc => { delete doc['instructors']; return doc; })
                                    .map(doc => {
                                        const ordered = {};
                                        Object.keys(doc).sort().forEach(key => {
                                            ordered[key] = doc[key];
                                        })
                                        return ordered;
                                    });
                // keywords array can be large and bandwidth-heavy
                if(req.query.keywords !== 'true') {
                    delete results['keywords'];
                }
                res.status(200).json(results);
                return;
            }
        }
        else if(req.query.query) {
            let query = db.collection('instructors')
                        .where('keywords', 'array-contains', req.query.query.toLowerCase())
                        .orderBy('lastName')
                        .limit(10);
            let querySnap = await query.get();
            // extracts data from query results, removes sensitive/bulky fields, and sorts keys
            let instructors = querySnap.docs
                            .map(doc => doc.data())
                            .map(doc => { delete doc['courses']; delete doc['sections']; delete doc['keywords']; return doc; })
                            .map(doc => {
                                const ordered = {};
                                Object.keys(doc).sort().forEach(key => {
                                    ordered[key] = doc[key];
                                })
                                return ordered;
                            });
            // HTTP 206 denotes partial content because instructor objects are shallow
            res.status(206).json(instructors);
            return
        }
        else {
            res.status(462).json({
                error: 'Insufficient arguments',
                description: 'Please include at least a `department` query parameter.'
            })
        }
    }
    catch(err) {
        console.log(err)
        res.status(500).json({
            error: 'Internal Server Error',
            description: 'The server has encountered a situation it doesn\'t know how to handle.'
        })
    }
})