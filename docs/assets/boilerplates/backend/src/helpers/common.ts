export const promiseTimeout = (ms, cb?: any): Promise<null> => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return new Promise((resolve, _) => {
    setTimeout(() => {
      if (cb) cb();
      resolve(null);
    }, ms);
  });
};
