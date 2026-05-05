/**
 * CLI entry point for seeding the public.countries table.
 *
 * Run:
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npx tsx scripts/seedCountries.ts
 *
 * The data + Supabase logic lives in src/lib/conflict/seedCountries.ts so the
 * same code can run inside /api/conflict/refresh?step=bootstrap.
 */
import { seedAllCountries } from '../src/lib/conflict/seedCountries';

async function main() {
  if (!process.env.SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL');
    process.exit(1);
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const result = await seedAllCountries();
  if (result.schemaMissing) {
    console.error('Schema missing: run supabase/schema.sql in the Supabase SQL editor first.');
    process.exit(2);
  }
  console.log(`Done. Upserted ${result.upserted}/${result.total} countries.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
