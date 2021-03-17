import * as functions from 'firebase-functions';

export const cors = (response: functions.Response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
};

// returns 0 if the argument is NaN, otherwise returns parseInt(arg)
export const zeroIfNaN = (x: any) => isNaN(parseInt(`${x}`)) ? 0 : parseInt(`${x}`);