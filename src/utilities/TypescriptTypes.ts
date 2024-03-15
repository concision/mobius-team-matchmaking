export type Type<T = unknown> = abstract new (...args: any[]) => T;

export type ReplaceReturnType<T extends (...args: any) => any, TNewReturn> = (...args: Parameters<T>) => TNewReturn;


export type Writeable<T> = {
    -readonly [K in keyof T]: T[K];
};

export type UndefinedValues<T> = {
    [K in keyof T]?: undefined;
};

export type KeysOfType<O, T> = {
    [K in keyof O]: O[K] extends T ? K : never;
}[keyof O];
