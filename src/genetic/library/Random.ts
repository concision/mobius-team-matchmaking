export function randomIndex<T>(length: number | readonly T[]): number {
    return Math.floor(Math.random() * (Array.isArray(length) ? length.length : <number>length));
}

export function selectRandomElement<T>(array: readonly T[]): T | undefined {
    if (array.length === 0)
        return undefined;

    return array[randomIndex(array.length)];
}

export function selectUniqueRandomElements<T>(array: readonly T[], length: number): T[] {
    if (array.length < length)
        throw new Error("Cannot choose more elements than the array contains.");

    const numbers = new Set<number>();
    do {
        numbers.add(randomIndex(array));
    } while (numbers.size < length);
    return Array.from(numbers).map(index => array[index]);
}

export function selectRandomWeightedElement<T>(
    array: T[],
    weightFunction: (element: T, index: number) => number,
    defaultValue?: T,
): T | undefined {
    if (array.length === 0)
        return defaultValue;

    const totalWeight = array.reduce((sum, value, index) => sum + weightFunction(value, index), 0);
    let random: number = Math.floor(Math.random() * totalWeight);
    for (let i = 0; i < array.length; i++) {
        const element = array[i];

        random -= weightFunction(element, i);
        if (random <= 0)
            return element;
    }

    throw new Error("Failed to choose a weighted element.");
}
