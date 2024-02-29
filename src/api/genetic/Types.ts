export type ReplaceReturnType<T extends (...args: any) => any, TNewReturn> = (...args: Parameters<T>) => TNewReturn;
