import {gray} from "ansi-colors";

let seed = 1;

export function seededRandom() {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}


export function debugLog<T>(action: () => T): T {
    const originalLogger = console.log;
    console.log = (...args: any[]) => originalLogger(...[gray("[DEBUG]")].concat(args.map(arg => gray(arg))));
    try {
        return action();
    } finally {
        console.log = originalLogger;
    }
}

export function groupBy<K, T>(array: readonly T[], keyFunction: ((item: T) => K[]) | ((item: T) => K)): Map<K, T[]> {
    const map = new Map<K, T[]>();
    for (const item of array) {
        const key = keyFunction(item);
        for (const subkey of (Array.isArray(key) ? key : [key])) {
            const group = map.get(subkey) ?? [];
            group.push(item);
            map.set(subkey, group);
        }
    }
    return map;
}
