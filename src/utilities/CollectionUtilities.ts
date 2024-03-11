export function assignDefinedProperties<T>(target: T, source: Partial<T>): T {
    for (const key in source) {
        if (source[key] !== undefined)
            target[key] = source[key]!;
    }
    return target;
}

export enum GroupType {
    MULTI_VALUE = 1,
    SINGLE_VALUE = 1 << 1,
    MULTI_KEY = 1 << 2,
}


export function groupBy<K, T>(array: readonly T[], keyFunction: (item: T) => K, multiKey?: false | undefined): Map<K, T[]>;
export function groupBy<K, T>(array: readonly T[], keyFunction: (item: T) => K[], multiKey: true): Map<K, T[]>;
export function groupBy<K, T>(array: readonly T[], keyFunction: ((item: T) => K) | ((item: T) => K[]), multiKey?: boolean): Map<K, T[]> {
    const map = new Map<K, T[]>();
    for (const item of array) {
        const key = keyFunction(item);

        for (const subkey of <K[]>(multiKey && Array.isArray(key) ? key : [key])) {
            const group = map.get(subkey);
            if (group !== undefined)
                group.push(item);
            else
                map.set(subkey, [item]);
        }
    }
    return map;
}
