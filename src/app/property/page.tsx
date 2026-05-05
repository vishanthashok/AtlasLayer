'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  cadSiteUrl,
  guessedCadSiteUrl,
} from '../../lib/property-intelligence/countyFromAddress';
import styles from './page.module.css';

type PropertySource =
  | 'bexar_cad'
  | 'travis_cad'
  | 'williamson_cad'
  | 'rentcast_estimate';

interface PropertyApiResponse {
  status: 'success' | 'partial' | 'error';
  ownerName: string | null;
  appraisedValue: number | null;
  parcelId: string | null;
  legalDescription: string | null;
  lastUpdated: string | null;
  source: PropertySource | null;
  reason?: string;
}

type SheetState = 'idle' | 'pending' | PropertyApiResponse;

const SOURCE_LABELS: Record<PropertySource, string> = {
  bexar_cad: 'Bexar CAD',
  travis_cad: 'Travis CAD',
  williamson_cad: 'Williamson CAD',
  rentcast_estimate: 'RentCast (estimate)',
};

const EMPTY = '—';

const NEUTRAL_CAD_GUIDE =
  'https://comptroller.texas.gov/taxes/property-tax/appraisal-districts/';

function formatCurrency(n: number | null): string {
  if (n == null) return EMPTY;
  return `$${n.toLocaleString('en-US')}`;
}

function resolveCadHref(address: string, data: PropertyApiResponse | null): string {
  if (!data?.source) {
    return guessedCadSiteUrl(address) ?? NEUTRAL_CAD_GUIDE;
  }
  if (data.source === 'rentcast_estimate') {
    return guessedCadSiteUrl(address) ?? NEUTRAL_CAD_GUIDE;
  }
  return cadSiteUrl(data.source);
}

function sourceLabel(data: PropertyApiResponse | null): string {
  if (!data?.source) return EMPTY;
  return SOURCE_LABELS[data.source];
}

function PropertySkeletonBody({ address }: { address: string }) {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.docTitle}>Official Property Data</div>
        <header className={styles.addressHeader}>{address.trim() || EMPTY}</header>
        <section className={styles.hero}>
          <div className={`${styles.heroOwner} ${styles.empty}`}>{EMPTY}</div>
          <div className={`${styles.heroValue} ${styles.empty}`}>{EMPTY}</div>
        </section>
        <section className={styles.mid}>
          <div className={styles.midGrid}>
            <div className={styles.midCell}>
              <span className={styles.midLabel}>Parcel ID</span>
              <span className={`${styles.midValue} ${styles.empty}`}>{EMPTY}</span>
            </div>
            <div className={styles.midCell}>
              <span className={styles.midLabel}>Last updated</span>
              <span className={`${styles.midValue} ${styles.empty}`}>{EMPTY}</span>
            </div>
            <div className={styles.midCell}>
              <span className={styles.midLabel}>Source</span>
              <span className={`${styles.sourcePill} ${styles.empty}`}>{EMPTY}</span>
            </div>
          </div>
        </section>
        <section className={styles.bottom}>
          <span className={styles.bottomLabel}>Legal description</span>
          <pre className={`${styles.legalBlock} ${styles.empty}`}>{EMPTY}</pre>
          <a
            href={guessedCadSiteUrl(address) ?? NEUTRAL_CAD_GUIDE}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.cadLink}
          >
            Open official CAD site →
          </a>
        </section>
      </div>
    </div>
  );
}

function PropertyBody({ address }: { address: string }) {
  const [sheet, setSheet] = useState<SheetState>(() =>
    address ? 'pending' : 'idle'
  );

  useEffect(() => {
    if (!address) return;

    let cancelled = false;

    fetch(`/api/property?address=${encodeURIComponent(address)}`)
      .then(async (r) => {
        const body = (await r.json()) as PropertyApiResponse;
        if (cancelled) return;
        if (!r.ok && body.status !== 'error') {
          setSheet({
            status: 'error',
            reason: `Request failed (${r.status})`,
            ownerName: null,
            appraisedValue: null,
            parcelId: null,
            legalDescription: null,
            lastUpdated: null,
            source: null,
          });
          return;
        }
        setSheet(body);
      })
      .catch(() => {
        if (cancelled) return;
        setSheet({
          status: 'error',
          ownerName: null,
          appraisedValue: null,
          parcelId: null,
          legalDescription: null,
          lastUpdated: null,
          source: null,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [address]);

  const loading = sheet === 'pending';
  const display: PropertyApiResponse | null =
    sheet === 'idle' || sheet === 'pending' ? null : sheet;

  const ownerText = display?.ownerName ?? EMPTY;
  const valueText =
    display?.appraisedValue != null ? formatCurrency(display.appraisedValue) : EMPTY;
  const parcelText = display?.parcelId ?? EMPTY;
  const lastText = display?.lastUpdated ?? EMPTY;
  const legalText = display?.legalDescription ?? EMPTY;
  const sourceText = loading ? EMPTY : sourceLabel(display);
  const cadHref = resolveCadHref(address, display);

  const emptyClass = (text: string) => (text === EMPTY ? styles.empty : '');

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.docTitle}>Official Property Data</div>
        <header className={styles.addressHeader}>{address || EMPTY}</header>

        {display?.status === 'error' && display.reason ? (
          <div className={styles.errorBanner} role="alert">
            {display.reason}
          </div>
        ) : null}

        <section className={styles.hero}>
          <div className={`${styles.heroOwner} ${emptyClass(ownerText)}`}>{ownerText}</div>
          <div className={`${styles.heroValue} ${emptyClass(valueText)}`}>{valueText}</div>
        </section>

        <section className={styles.mid}>
          <div className={styles.midGrid}>
            <div className={styles.midCell}>
              <span className={styles.midLabel}>Parcel ID</span>
              <span className={`${styles.midValue} ${emptyClass(parcelText)}`}>{parcelText}</span>
            </div>
            <div className={styles.midCell}>
              <span className={styles.midLabel}>Last updated</span>
              <span className={`${styles.midValue} ${emptyClass(lastText)}`}>{lastText}</span>
            </div>
            <div className={styles.midCell}>
              <span className={styles.midLabel}>Source</span>
              {sourceText === EMPTY ? (
                <span className={`${styles.sourcePill} ${styles.empty}`}>{EMPTY}</span>
              ) : (
                <span className={styles.sourcePill}>{sourceText}</span>
              )}
            </div>
          </div>
        </section>

        <section className={styles.bottom}>
          <span className={styles.bottomLabel}>Legal description</span>
          <pre className={`${styles.legalBlock} ${emptyClass(legalText)}`}>{legalText}</pre>
          <a
            href={cadHref}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.cadLink}
          >
            Open official CAD site →
          </a>
        </section>
      </div>
    </div>
  );
}

function PropertyShell() {
  const searchParams = useSearchParams();
  const address = searchParams.get('address')?.trim() || '';

  useEffect(() => {
    document.title = 'Official Property Data';
  }, []);

  return <PropertyBody key={address || '__none__'} address={address} />;
}

export default function PropertyPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.suspenseShell}>
          <PropertySkeletonBody address="" />
        </div>
      }
    >
      <PropertyShell />
    </Suspense>
  );
}
