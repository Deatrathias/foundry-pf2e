declare function waitDialog<T extends any>({ title, content, yes, no, classes, data, render, }: BaseOptions & {
    yes: Omit<DialogV2Button, "action">;
    no: Omit<DialogV2Button, "action">;
}, { id, width, animation }?: DialogExtraOptions): Promise<T | null | false>;
declare function confirmDialog({ title, content, classes, data }: BaseOptions, { animation }?: {
    animation?: boolean;
}): Promise<boolean | null>;
declare function promptDialog<T extends Record<string, unknown>>({ title, content, classes, data, label, render, callback, }: BaseOptions & {
    label?: string;
    callback?: DialogV2ButtonCallback;
}, { width, id, animation }?: DialogExtraOptions): Promise<T | null>;
declare function createDialogData(html: HTMLElement): {
    [x: string]: unknown;
} | null;
type DialogExtraOptions = {
    id?: string;
    width?: number | "auto";
    animation?: false;
};
type BaseOptions = {
    title: string;
    content: string;
    classes?: string[];
    data?: Record<string, any>;
    render?: DialogV2RenderCallback;
};
export type { DialogExtraOptions };
export { confirmDialog, createDialogData, promptDialog, waitDialog };
