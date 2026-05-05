export type ConnectorSource = 'census' | 'osm' | 'usgs' | 'rentcast' | 'cad' | 'fema';

export type ConnectorOk<T> = { ok: true; source: ConnectorSource; data: T };
export type ConnectorErr = { ok: false; source: ConnectorSource; error: string };
export type ConnectorResult<T> = ConnectorOk<T> | ConnectorErr;

export function ok<T>(source: ConnectorSource, data: T): ConnectorOk<T> {
  return { ok: true, source, data };
}

export function fail(source: ConnectorSource, error: unknown): ConnectorErr {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false, source, error: msg };
}
