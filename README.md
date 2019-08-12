# @cougargrades/api
Serverless public developer HTTP API server for cougargrades.io

## Indev ⚠
cougar-grades is in private early development and the master branch will get very dirty as a result. This means commits probably won't work if cloned and tried building because undocumented changes could've been made.

## Building: API Server (Firebase Cloud Functions + Express.js)
- `npm install`
- `firebase serve --only functions`

## Documentation
Instructions and usage of the routes offered by the public API are documented in [openapi.yaml](openapi.yaml) and can be viewed for reading on [Github pages](https://cougargrades.github.io/api/).

## Live API Server
The configured baseurl is: `cougargrades.io/api`. However, the website located at `/` is a [progressive web app](https://developers.google.com/web/progressive-web-apps/) that will treat requests to `/api` as unknown when opened in a browser ([see configuration file](https://github.com/cougargrades/web/blob/master/firebase.json)). This is only a browser limitation when trying to browse a page. The actual API can still be reached like so:

_With an HTTP request:_
```bash
curl https://cougargrades.io/api/hello
# "World!"
```

_With code:_
```javascript
res = await fetch('/api/hello') // Fetch Response()
data = await res.json() // "World!"
```

_List of courses offered by `COSC` (Computer Science) department:_
```javascript
res = await fetch('https://cougargrades.io/api/catalog?department=COSC')
data = await res.json()
console.log(data)
/*
[
  {
    "department": "string",
    "catalogNumber": "string",
    "description": "string"
  }
]
*/
```

_List of past sections for `COSC 1304` ("C Programming"):_
```javascript
res = await fetch('https://cougargrades.io/api/catalog?department=COSC&catalogNumber=1304')
data = await res.json()
console.log(data)
/*
[
  {
    "department": "string",
    "catalogNumber": "string",
    "description": "string",
    "sections": [
      {
        "A": 0,
        "B": 0,
        "C": 0,
        "D": 0,
        "F": 0,
        "Q": 0,
        "sectionNumber": 0,
        "semesterGPA": 0,
        "term": 0,
        "termString": "string",
        "instructorNames": [
          {
            "lastName": "string",
            "firstName": "string",
            "termSectionsTaught": 0,
            "termGPA": 0,
            "termGPAmax": 0,
            "termGPAmin": 0
          }
        ]
      }
    ]
  }
]
*/
```