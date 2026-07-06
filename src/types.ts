/** Parsed SOAP / ONVIF payload after linerase() */
export type SoapRecord = Record<string, unknown>;

export type ErrorCallback = (err: Error | null, ...args: unknown[]) => void;

export type ServiceUriMap = Record<string, URL>;
