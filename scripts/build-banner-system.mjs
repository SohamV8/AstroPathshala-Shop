/**
 * Banner build pipeline — normalize /assets/Banner, sync flat assets, generate resolver.
 *
 * Output: snippets/product-banner-resolve.liquid
 * Format:  file-a.webp|file-b.webp~~~source
 *          (paths deduped at build; source = product | collection | default)
 *
 * Usage: node scripts/build-banner-system.mjs [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BANNER_DIR = path.join(ROOT, 'assets', 'Banner');
const ASSETS_DIR = path.join(ROOT, 'assets');
const RESOLVE_PATH = path.join(ROOT, 'snippets', 'product-banner-resolve.liquid');
const MANIFEST_PATH = path.join(ROOT, 'snippets', 'product-banner-manifest.liquid');

const DRY_RUN = process.argv.includes('--dry-run');
const DEFAULT_FLAT = 'product-banner-default.webp';
const PATH_META_SEP = '~~~';

function normalizeBase(filename) {
  let base = path.parse(filename).name.toLowerCase().trim();
  base = base.replace(/\s+/g, '-');
  base = base.replace(/\((\d+)\)/g, '-$1');
  base = base.replace(/[()]/g, '');
  base = base.replace(/_(\d+)$/g, '-$1');
  base = base.replace(/[^a-z0-9-]/g, '');
  base = base.replace(/-+/g, '-').replace(/^-|-$/g, '');
  return base;
}

function classify(base) {
  if (base.startsWith('collections-page-banner-')) {
    return { type: 'collection', key: base.replace('collections-page-banner-', '') };
  }
  if (base.startsWith('home-page-banner')) {
    return { type: 'home', key: 'home' };
  }
  const slotMatch = base.match(/^(.*)-(\d+)$/);
  if (slotMatch) {
    return { type: 'product', key: slotMatch[1], slot: Number(slotMatch[2]) };
  }
  return { type: 'product', key: base, slot: 0 };
}

function escapeLiquid(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function flatProductAsset(key, index) {
  return `product-banner-${key}-${index}.webp`;
}

function flatCollectionAsset(collKey) {
  return `product-banner-collection-${collKey}.webp`;
}

function copyAsset(srcRel, destName) {
  const src = path.join(ASSETS_DIR, srcRel.replace(/\//g, path.sep));
  const dest = path.join(ASSETS_DIR, destName);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    return true;
  }
  return false;
}

function dedupePaths(paths) {
  const seen = new Set();
  const out = [];
  for (const p of paths) {
    const n = p.trim();
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

function main() {
  if (!fs.existsSync(BANNER_DIR)) {
    console.error('Banner directory not found:', BANNER_DIR);
    process.exit(1);
  }

  const entries = fs.readdirSync(BANNER_DIR).filter((f) => /\.(webp|png|jpe?g)$/i.test(f));
  const productFiles = {};
  const collections = {};
  const home = [];

  for (const file of entries) {
    const normalized = normalizeBase(file);
    const ext = path.extname(file).toLowerCase() || '.webp';
    const newName = `${normalized}${ext === '.jpeg' ? '.jpg' : ext}`;
    const info = classify(normalized);
    const bannerRel = `Banner/${newName}`;

    if (info.type === 'collection') {
      collections[info.key] = bannerRel;
    } else if (info.type === 'home') {
      home.push(bannerRel);
    } else {
      if (!productFiles[info.key]) productFiles[info.key] = [];
      productFiles[info.key].push({ slot: info.slot, bannerRel, normalized });
    }
  }

  const products = {};
  for (const [key, items] of Object.entries(productFiles)) {
    items.sort((a, b) => {
      if (a.slot !== b.slot) return a.slot - b.slot;
      return a.normalized.localeCompare(b.normalized);
    });
    const flats = [];
    items.forEach((item, index) => {
      flats.push(flatProductAsset(key, index + 1));
    });
    products[key] = dedupePaths(flats);
  }

  const flatCollections = {};
  for (const [collKey, bannerRel] of Object.entries(collections)) {
    flatCollections[collKey] = flatCollectionAsset(collKey);
  }

  home.sort();
  const defaultSource = home[0] || 'Banner/home-page-banner.webp';

  console.log(`Found ${entries.length} banner files`);
  console.log(`Products: ${Object.keys(products).length}, Collections: ${Object.keys(collections).length}`);

  if (!DRY_RUN) {
    const tempMoves = [];
    entries.forEach((file, index) => {
      const normalized = normalizeBase(file);
      const ext = path.extname(file).toLowerCase() || '.webp';
      const newName = `${normalized}${ext === '.jpeg' ? '.jpg' : ext}`;
      if (file === newName) return;
      const src = path.join(BANNER_DIR, file);
      const temp = path.join(BANNER_DIR, `__rename-tmp-${index}.webp`);
      if (fs.existsSync(src)) {
        fs.renameSync(src, temp);
        tempMoves.push({ temp, to: path.join(BANNER_DIR, newName) });
      }
    });
    for (const { temp, to } of tempMoves) {
      if (fs.existsSync(to)) fs.unlinkSync(to);
      fs.renameSync(temp, to);
    }

    for (const [key, flatPaths] of Object.entries(products)) {
      const items = productFiles[key];
      items.forEach((item, index) => {
        copyAsset(item.bannerRel, flatPaths[index]);
      });
    }

    for (const [collKey, bannerRel] of Object.entries(collections)) {
      copyAsset(bannerRel, flatCollections[collKey]);
    }

    if (!copyAsset(defaultSource, DEFAULT_FLAT) && home.length > 1) {
      copyAsset(home[1], DEFAULT_FLAT);
    }
  }

  const handleAliases = {
    '7-chakra-karungali': '7-chakra-karungali-bracelet',
    '7-chakra-karungali-bracelet': '7-chakra-karungali-bracelet',
    'tiger-eye-bracelet': 'tiger-eye-bracelet',
    'tiger-eye': 'tiger-eye',
    tourmaline: 'tourmaline-stone',
    'tourmaline-stone': 'tourmaline-stone',
    zircon: 'zircon-stone',
    'zircon-stone': 'zircon-stone',
    feroza: 'feroza',
    firoza: 'feroza',
    turquoise: 'feroza',
    'kaka-neeli': 'kaka-geeli-gemstone',
    'kaka-geeli': 'kaka-geeli-gemstone',
    iolite: 'kaka-geeli-gemstone',
    citrine: 'sunela-stone',
    sunela: 'sunela-stone',
    'sulemani-hakik': 'sulemani-hakik-gemstone',
    hakik: 'sulemani-hakik-gemstone',
    'rudraksha-japa': 'rudraksha-japa-mala-108',
    'rudraksha-japa-mala': 'rudraksha-japa-mala-108',
    'tulsi-japa-mala': 'original-tulsi-japa-mala-108-beads',
    'moti-mala': 'original-moti-mala-108-beads',
    'sphatik-mala': 'original-sphatik-mala',
    'chandan-mala': 'chandan-mala',
    'dhan-yog': 'original-dhan-yog-bracelet',
    'crystal-rudraksha': 'crystal-rudraksha-bracelet',
    pyrite: 'natural-pyrite-stone-energy-bracelet',
    amethyst: 'amethyst-gemstone',
    'lapis-lazuli': 'lapis-lazuli-stone',
    'mahe-mariam': 'mahe-mariam-stone',
    moonstone: 'moonstone-gemstone',
    peridot: 'peridot-gemstone',
  };

  const collectionMap = {
    gemstone: 'gemstone-collection',
    gems: 'gemstone-collection',
    gemstones: 'gemstone-collection',
    rudraksha: 'rudraksha-collection',
    'rudraksha-collection': 'rudraksha-collection',
    'lal-kitaab-remedies': 'lal-kitab',
    'lal-kitab': 'lal-kitab',
    'e-books': 'book',
    books: 'book',
    courses: 'book',
  };

  const productKeys = Object.keys(products).sort();
  const aliasEntries = Object.entries(handleAliases).sort((a, b) => b[0].length - a[0].length);

  let liquid = `{%- comment -%}
  Auto-generated — scripts/build-banner-system.mjs
  Output: unique_asset_paths${PATH_META_SEP}source
  Capture once: {% capture bundle %}{% render 'product-banner-resolve' %}{% endcapture %}
{%- endcomment -%}
{%- liquid
  assign banner_paths = ''
  assign banner_source = ''
  assign banner_match_key = ''
  assign h = product.handle | downcase | strip
  assign t = product.title | downcase | strip

  # Resolve product key (aliases longest-first, single pass)
`;

  for (const [alias, target] of aliasEntries) {
    const phrase = alias.replace(/-/g, ' ');
    liquid += `  if banner_match_key == blank\n`;
    liquid += `    if h == '${escapeLiquid(alias)}' or h contains '${escapeLiquid(alias)}' or t contains '${escapeLiquid(phrase)}'\n`;
    liquid += `      assign banner_match_key = '${escapeLiquid(target)}'\n`;
    liquid += `    endif\n`;
    liquid += `  endif\n`;
  }

  for (const key of productKeys) {
    const phrase = key.replace(/-/g, ' ');
    liquid += `  if banner_match_key == blank\n`;
    liquid += `    if h == '${escapeLiquid(key)}' or h contains '${escapeLiquid(key)}' or t contains '${escapeLiquid(phrase)}'\n`;
    liquid += `      assign banner_match_key = '${escapeLiquid(key)}'\n`;
    liquid += `    endif\n`;
    liquid += `  endif\n`;
  }

  liquid += `\n  # Product banners — all slots, no fallback if matched\n`;
  liquid += `  case banner_match_key\n`;
  for (const key of productKeys) {
    const paths = products[key].join('|');
    liquid += `    when '${escapeLiquid(key)}'\n`;
    liquid += `      assign banner_paths = '${escapeLiquid(paths)}'\n`;
    liquid += `      assign banner_source = 'product'\n`;
  }
  liquid += `  endcase\n\n`;

  liquid += `  # Collection fallback — only when no product banners\n`;
  liquid += `  if banner_source == blank\n`;
  liquid += `    for coll in product.collections\n`;
  liquid += `      if banner_source != blank\n`;
  liquid += `        break\n`;
  liquid += `      endif\n`;
  liquid += `      assign ch = coll.handle | downcase\n`;
  for (const [handle, collKey] of Object.entries(collectionMap)) {
    if (flatCollections[collKey]) {
      liquid += `      if ch == '${escapeLiquid(handle)}' or ch contains '${escapeLiquid(handle)}'\n`;
      liquid += `        assign banner_paths = '${escapeLiquid(flatCollections[collKey])}'\n`;
      liquid += `        assign banner_source = 'collection'\n`;
      liquid += `        break\n`;
      liquid += `      endif\n`;
    }
  }
  liquid += `    endfor\n`;
  liquid += `  endif\n\n`;

  liquid += `  # Default — only when nothing else matched\n`;
  liquid += `  if banner_source == blank\n`;
  liquid += `    assign banner_paths = '${DEFAULT_FLAT}'\n`;
  liquid += `    assign banner_source = 'default'\n`;
  liquid += `  endif\n`;
  liquid += `-%}\n{{- banner_paths -}}${PATH_META_SEP}{{- banner_source -}}\n`;

  const manifestStub = `{%- comment -%}Deprecated — use product-banner-resolve.liquid{%- endcomment -%}\n{%- render 'product-banner-resolve' -%}\n`;

  if (!DRY_RUN) {
    fs.writeFileSync(RESOLVE_PATH, liquid, 'utf8');
    fs.writeFileSync(MANIFEST_PATH, manifestStub, 'utf8');
    fs.writeFileSync(
      path.join(ROOT, 'assets', 'banner-registry.json'),
      JSON.stringify({ products, collections: flatCollections, default: DEFAULT_FLAT }, null, 2),
      'utf8'
    );
  }

  console.log(DRY_RUN ? 'Dry run complete.' : `Wrote ${RESOLVE_PATH}`);
}

main();
