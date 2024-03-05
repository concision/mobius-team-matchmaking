export type ReplaceReturnType<T extends (...args: any) => any, TNewReturn> = (...args: Parameters<T>) => TNewReturn;

export type Writeable<T> = { -readonly [P in keyof T]: T[P] };
