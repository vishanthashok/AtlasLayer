'use client';

import styles from './GoogleMapsBlocked.module.css';

type Props = {
  loadError?: Error;
  authFailure: boolean;
};

export default function GoogleMapsBlocked({ loadError, authFailure }: Props) {
  if (!loadError && !authFailure) return null;

  return (
    <div className={styles.wrap} role="alert">
      <h3 className={styles.title}>Google Maps did not initialize</h3>
      {loadError && (
        <p className={styles.detail}>
          <strong>Loader:</strong> {loadError.message}
        </p>
      )}
      {authFailure && (
        <p className={styles.detail}>
          Google rejected this browser request (invalid key, referrer restriction, billing, or missing{' '}
          <strong>Maps JavaScript API</strong>). Check the browser console for the exact error code.
        </p>
      )}
      <ol className={styles.list}>
        <li>
          Cloud Console → APIs &amp; Services → enable <strong>Maps JavaScript API</strong> and{' '}
          <strong>Geocoding API</strong> (for search / reverse geocode).
        </li>
        <li>
          Credentials → your browser key → Application restriction: <strong>HTTP referrers</strong>. Add{' '}
          <code>http://localhost:3000/*</code> and <code>http://127.0.0.1:3000/*</code> (and production origins).
        </li>
        <li>Billing enabled on the Google Cloud project.</li>
        <li>
          Restart <code>npm run dev</code> after changing <code>.env.local</code> (<code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>
          ).
        </li>
      </ol>
      <p className={styles.docHint}>See <code>docs/google-maps-setup.md</code> for step-by-step setup.</p>
    </div>
  );
}
