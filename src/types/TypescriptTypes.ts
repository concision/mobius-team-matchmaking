export type ReplaceReturnType<T extends (...args: any) => any, TNewReturn> = (...args: Parameters<T>) => TNewReturn;

export type Writeable<T> = { -readonly [K in keyof T]: T[K] };
