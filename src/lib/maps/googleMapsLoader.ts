import type { Library } from '@googlemaps/js-api-loader';

/** One script tag for the whole app — @googlemaps/js-api-loader is a singleton and throws if options differ between Parcelis vs Fieldstone. */
export const PROPERTYVISION_GOOGLE_MAPS_SCRIPT_ID = 'propertyvision-google-maps-script';

/**
 * Shared library list (stable reference). Includes `drawing` for Fieldstone and `maps`
 * for parity with @react-google-maps/api defaults used on Parcelis.
 */
export const PROPERTYVISION_GOOGLE_MAPS_LIBRARIES: Library[] = ['maps', 'drawing'];

export const PROPERTYVISION_GOOGLE_MAPS_VERSION = 'weekly' as const;

/** Google calls this when the key is invalid, referrer-blocked, or billing/API restrictions fail after the script loads. */
export function subscribeGoogleMapsAuthFailure(onFail: () => void): () => void {
  const w = window as Window & { gm_authFailure?: () => void };
  w.gm_authFailure = () => {
    onFail();
  };
  return () => {
    delete w.gm_authFailure;
  };
}
