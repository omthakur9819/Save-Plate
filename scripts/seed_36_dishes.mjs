import fs from 'fs';
import path from 'path';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5433/surplus_saver',
});

async function run() {
  const filePath = path.resolve('artifacts/food-rescue-marketplace/context/MarketplaceContext.tsx');
  const source = fs.readFileSync(filePath, 'utf8');

  // Extract DEFAULT_LISTINGS array definition
  const startMarker = 'const DEFAULT_LISTINGS: FoodListing[] = [';
  const endMarker = 'export const VENDOR_METADATA';

  const startIndex = source.indexOf(startMarker);
  const endIndex = source.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1) {
    throw new Error('Could not find DEFAULT_LISTINGS block');
  }

  const arrayCode = source.slice(startIndex + startMarker.length - 1, endIndex).trim();
  // Strip trailing semicolon
  const cleanArrayCode = arrayCode.replace(/;\s*$/, '');

  // Safely evaluate array literal
  const listings = new Function(`return ${cleanArrayCode}`)();
  console.log(`Parsed ${listings.length} dishes from MarketplaceContext.tsx`);

  // Group by vendor
  const vendorMap = new Map();
  for (const item of listings) {
    const vName = item.vendor.trim();
    if (!vendorMap.has(vName)) {
      vendorMap.set(vName, {
        name: vName,
        area: item.area,
        latitude: item.latitude,
        longitude: item.longitude,
      });
    }
  }

  console.log(`Found ${vendorMap.size} unique vendors:`, Array.from(vendorMap.keys()));

  // 1. Ensure owner users and vendors exist
  for (const [vName, vData] of vendorMap.entries()) {
    const ownerUserId = `owner-${vName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    await pool.query(
      `INSERT INTO marketplace_users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
      [ownerUserId]
    );

    const latE6 = vData.latitude ? Math.round(vData.latitude * 1000000) : null;
    const lngE6 = vData.longitude ? Math.round(vData.longitude * 1000000) : null;

    // Check if vendor already exists by name
    const existing = await pool.query(
      `SELECT id FROM marketplace_vendors WHERE name = $1`,
      [vName]
    );

    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO marketplace_vendors (owner_user_id, name, city, area, latitude_e6, longitude_e6)
         VALUES ($1, $2, 'Mumbai', $3, $4, $5)`,
        [ownerUserId, vName, vData.area, latE6, lngE6]
      );
    }
  }

  // 2. Insert all listings
  let inserted = 0;
  for (const dish of listings) {
    const vRes = await pool.query(
      `SELECT id FROM marketplace_vendors WHERE name = $1`,
      [dish.vendor.trim()]
    );

    if (vRes.rows.length === 0) continue;
    const vendorId = vRes.rows[0].id;

    const latE6 = dish.latitude ? Math.round(dish.latitude * 1000000) : null;
    const lngE6 = dish.longitude ? Math.round(dish.longitude * 1000000) : null;

    // Check if listing already exists by name and vendor
    const existingListing = await pool.query(
      `SELECT id FROM marketplace_listings WHERE name = $1 AND vendor_id = $2`,
      [dish.name.trim(), vendorId]
    );

    if (existingListing.rows.length === 0) {
      await pool.query(
        `INSERT INTO marketplace_listings (
          vendor_id, name, description, category, photo, price_inr, original_price_inr,
          quantity, pickup_window, area, latitude_e6, longitude_e6, dietary_tags,
          diet_tags, allergens, may_contain, allergen_info_confirmed, expires_at, active
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
          NOW() + INTERVAL '24 hours', true
        )`,
        [
          vendorId,
          dish.name.trim(),
          dish.description || '',
          dish.category,
          dish.photo === 'bakery' ? 'bakery' : 'lunch',
          Math.round(dish.price),
          Math.round(dish.originalPrice),
          Math.max(1, Math.round(dish.quantity)),
          dish.pickupWindow,
          dish.area,
          latE6,
          lngE6,
          dish.dietaryTags || [],
          dish.dietTags || [],
          dish.allergens || [],
          dish.mayContain || [],
          Boolean(dish.allergenInfoConfirmed),
        ]
      );
      inserted++;
    } else {
      // Update expiry and active status
      await pool.query(
        `UPDATE marketplace_listings 
         SET expires_at = NOW() + INTERVAL '24 hours', active = true, quantity = $1
         WHERE id = $2`,
        [Math.max(1, Math.round(dish.quantity)), existingListing.rows[0].id]
      );
    }
  }

  const vCount = await pool.query('SELECT count(*) FROM marketplace_vendors');
  const lCount = await pool.query('SELECT count(*) FROM marketplace_listings');

  console.log(`\n========================================`);
  console.log(`Database sync complete:`);
  console.log(`Total Vendors in Drizzle: ${vCount.rows[0].count}`);
  console.log(`Total Dishes/Listings in Drizzle: ${lCount.rows[0].count}`);
  console.log(`========================================\n`);

  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
