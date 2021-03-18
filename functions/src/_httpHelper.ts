import * as functions from 'firebase-functions';

export const useCors = (response: functions.Response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
};

export const useCache = (response: functions.Response) => {
  response.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
}

// returns 0 if the argument is NaN, otherwise returns parseInt(arg)
export const zeroIfNaN = (x: any) => isNaN(parseInt(`${x}`)) ? 0 : parseInt(`${x}`);