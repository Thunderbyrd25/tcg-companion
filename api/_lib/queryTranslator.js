// Translates the small, finite q= grammar that src/utils/api.js actually builds
// (direct field:value / field:"quoted phrase" / field:prefix* terms, space-separated = AND)
// into a parameterized SQL WHERE clause against the `cards` table. Not general Lucene —
// only the fields api.js actually queries are supported; unknown fields are ignored
// rather than erroring, since pokemontcg.io itself was lenient about unrecognized fields.
//
// `select=` is accepted (for API-shape compatibility) but intentionally ignored: every
// row's `data` column already holds the full pokemontcg.io-shaped card, and returning
// extra fields the frontend doesn't ask for is harmless (parseCard() just reads what it needs).

function tokenize(q) {
  const tokens = [];
  const re = /(\S+?):("[^"]*"|\S+)/g;
  let m;
  while ((m = re.exec(q || ''))) tokens.push({ field: m[1], value: m[2] });
  return tokens;
}

export function translateQuery(q) {
  const tokens = tokenize(q);
  const conditions = [];
  const params = [];

  function add(fragment, value) {
    params.push(value);
    conditions.push(fragment.replace('?', `$${params.length}`));
  }

  for (const { field, value } of tokens) {
    const quoted = value.startsWith('"') && value.endsWith('"');
    const raw = quoted ? value.slice(1, -1) : value;

    switch (field) {
      case 'name':
        if (quoted) add('LOWER(name) = LOWER(?)', raw);
        else if (raw.endsWith('*')) add('name ILIKE ?', `${raw.slice(0, -1)}%`);
        else add('name ILIKE ?', `%${raw}%`);
        break;
      case 'set.id':
        add('set_id = ?', raw);
        break;
      case 'set.ptcgoCode':
        add('UPPER(ptcgo_code) = UPPER(?)', raw);
        break;
      case 'number':
        add('number = ?', raw);
        break;
      case 'nationalPokedexNumbers':
        add('? = ANY(national_pokedex_numbers)', Number(raw));
        break;
      case 'supertype':
        add("data->>'supertype' = ?", raw);
        break;
      case 'subtypes':
        add('data->\'subtypes\' @> jsonb_build_array(?::text)', raw);
        break;
      case 'legalities.standard':
        add('LOWER(legalities_standard) = LOWER(?)', raw);
        break;
      case 'legalities.expanded':
        add('LOWER(legalities_expanded) = LOWER(?)', raw);
        break;
      default:
        break;
    }
  }

  return { where: conditions.length ? conditions.join(' AND ') : '1=1', params };
}

// number is TEXT (promo cards can have letter prefixes like "XY126"), so a plain
// ORDER BY number sorts lexicographically -- "245" comes before "4". Strip to
// digits and cast so full-art/secret-rare reprints (usually numbered higher)
// don't sort ahead of the base print.
const ORDER_COLUMNS = {
  'set.releaseDate': 'release_date',
  number: "NULLIF(regexp_replace(number, '[^0-9]', '', 'g'), '')::int",
  name: 'name',
};

export function translateOrderBy(orderBy) {
  if (!orderBy) return '';
  const parts = orderBy.split(',').map(p => {
    const desc = p.startsWith('-');
    const field = desc ? p.slice(1) : p;
    const col = ORDER_COLUMNS[field];
    return col ? `${col} ${desc ? 'DESC NULLS LAST' : 'ASC NULLS LAST'}` : null;
  }).filter(Boolean);
  return parts.length ? `ORDER BY ${parts.join(', ')}` : '';
}

export function paginate(pageSizeRaw, pageRaw) {
  const pageSize = Math.min(Math.max(parseInt(pageSizeRaw, 10) || 20, 1), 250);
  const page = Math.max(parseInt(pageRaw, 10) || 1, 1);
  return { limit: pageSize, offset: (page - 1) * pageSize, pageSize, page };
}
