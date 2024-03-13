declare global {
    /**
     * {@link https://github.com/microsoft/TypeScript/issues/17002}
     */
    interface ArrayConstructor {
        isArray<T>(arg: ReadonlyArray<T>): arg is ReadonlyArray<T>;
    }
}


export function assignDefinedProperties<T>(target: T, source: Partial<T>): T {
    for (const key in source) {
        const value = source[key];
        if (value !== undefined)
            target[key] = value!;
    }

    return target;
}


enum GroupingBitFlags {
    SINGLE_KEY = 1 << 0,
    MULTI_KEY = 1 << 1,
    SINGLE_VALUE = 1 << 2,
    MULTI_VALUE = 1 << 3,
}

export enum GroupingBehavior {
    SINGLE_KEY_SINGLE_VALUE = GroupingBitFlags.SINGLE_KEY | GroupingBitFlags.SINGLE_VALUE,
    SINGLE_KEY_MULTI_VALUE = GroupingBitFlags.SINGLE_KEY | GroupingBitFlags.MULTI_VALUE,
    MULTI_KEY_SINGLE_VALUE = GroupingBitFlags.MULTI_KEY | GroupingBitFlags.SINGLE_VALUE,
    MULTI_KEY_MULTI_VALUE = GroupingBitFlags.MULTI_KEY | GroupingBitFlags.MULTI_VALUE,
}

export function groupBy<K, T>(
    array: readonly T[],
    keyFunction: (item: T) => K,
): Map<K, T[]>;

export function groupBy<K, T>(
    array: readonly T[],
    keyFunction: (item: T) => K,
    flags: GroupingBehavior.SINGLE_KEY_SINGLE_VALUE,
): Map<K, T>;

export function groupBy<K, T>(
    array: readonly T[],
    keyFunction: (item: T) => K,
    flags: GroupingBehavior.SINGLE_KEY_MULTI_VALUE,
): Map<K, T[]>;

export function groupBy<K, T>(
    array: readonly T[],
    keyFunction: (item: T) => K[],
    flags: GroupingBehavior.MULTI_KEY_SINGLE_VALUE,
): Map<K, T>;

export function groupBy<K, T>(
    array: readonly T[],
    keyFunction: (item: T) => K[],
    flags: GroupingBehavior.MULTI_KEY_MULTI_VALUE,
): Map<K, T[]>;

export function groupBy<K, T>(
    array: readonly T[],
    keyFunction: ((item: T) => K) | ((item: T) => K[]),
    flags: GroupingBehavior = GroupingBitFlags.SINGLE_KEY | GroupingBitFlags.MULTI_VALUE,
): Map<K, T> | Map<K, T[]> {
    const keyFlags = GroupingBitFlags.SINGLE_KEY | GroupingBitFlags.MULTI_KEY;
    if ((flags & keyFlags) === 0)
        throw new Error("flags must contain either SINGLE_KEY or MULTI_KEY");
    if ((flags & keyFlags) == keyFlags)
        throw new Error("flags cannot contain both SINGLE_KEY and MULTI_KEY");
    const valueFlags = GroupingBitFlags.SINGLE_VALUE | GroupingBitFlags.MULTI_VALUE;
    if ((flags & valueFlags) === 0)
        throw new Error("flags must contain either SINGLE_VALUE or MULTI_VALUE");
    if ((flags & valueFlags) == valueFlags)
        throw new Error("flags cannot contain both SINGLE_VALUE and MULTI_VALUE");

    const map = (flags & GroupingBitFlags.SINGLE_VALUE) !== 0
        ? new Map<K, T>()
        : new Map<K, T[]>();

    for (const item of array) {
        const key = keyFunction(item);
        const keys = <K[]>((flags & GroupingBitFlags.MULTI_KEY) !== 0 && Array.isArray(key) ? key : [key]);

        for (const subkey of keys) {
            if ((flags & GroupingBitFlags.SINGLE_VALUE) !== 0) {
                if (!map.has(subkey))
                    (<Map<K, T>>map).set(subkey, item);
            } else if ((flags & GroupingBitFlags.MULTI_VALUE) !== 0) {
                const group = <T[] | undefined>map.get(<K>subkey);
                if (group !== undefined)
                    group.push(item);
                else
                    (<Map<K, T[]>>map).set(subkey, [item]);
            }
        }
    }

    return map;
}
