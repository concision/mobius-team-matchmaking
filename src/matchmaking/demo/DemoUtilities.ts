import {cyan, gray, yellowBright} from "ansi-colors";
import {ITeam} from "../api/ITeam";

export function seededRandom(seed: number) {
    return () => {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    }
}

export function rangedRandom(random: () => number, min: number, max: number) {
    return min + random() * (max - min);
}


export function formatTeam(team: ITeam, color?: (text: string) => string) {
    color ??= cyan;
    return `[${yellowBright(team.elo.toString())}]${color(team.name)}`;
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
