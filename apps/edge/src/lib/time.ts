/** Unix seconds. All timestamps in D1 and in the API are Unix seconds. */
export const nowSeconds = (): number => Math.floor(Date.now() / 1000);
