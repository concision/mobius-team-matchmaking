export class Exception extends Error {
    public constructor(message: string, error: unknown) {
        super(message);
        if (error)
            this.cause = error;
    }
}
