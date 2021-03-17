import * as functions from 'firebase-functions';

export const cors = (response: functions.Response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
};