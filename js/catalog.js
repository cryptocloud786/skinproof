// SkinProof demo catalog: ingredient-led products (generic, unbranded) with what they target
// and how long their actives typically need before a visible change.
// `weeks` = typical time-to-visible-results window used to judge "too early" vs "not working".

export const CONCERNS = {
  acne:           { label: 'Acne & breakouts', sim: 'acne' },
  redness:        { label: 'Redness',          sim: 'redness' },
  oiliness:       { label: 'Oil & shine',      sim: 'oiliness' },
  pore:           { label: 'Pores',            sim: 'pores' },
  texture:        { label: 'Texture',          sim: 'texture' },
  moisture:       { label: 'Hydration',        sim: null },
  radiance:       { label: 'Radiance',         sim: 'radiance' },
  dark_circle_v2: { label: 'Dark circles',     sim: 'dark_circle' },
  eye_bag:        { label: 'Eye bags',         sim: 'eye_bags' },
  wrinkle:        { label: 'Fine lines',       sim: 'wrinkle' },
  age_spot:       { label: 'Spots & pigment',  sim: 'spots' },
  firmness:       { label: 'Firmness',         sim: null },
};

export const PRODUCTS = [
  { id: 'sal-gel', name: '2% Salicylic Acid Gel Cleanser', type: 'Cleanser', price: 449,
    actives: ['Salicylic acid 2%', 'Zinc PCA'], targets: ['acne', 'oiliness', 'pore'], weeks: 6,
    goodFor: ['Oily', 'Combination'], caution: 'Can dry out cheeks if your U-zone is dry - use once a day.' },
  { id: 'niacin-10', name: 'Niacinamide 10% + Zinc Serum', type: 'Serum', price: 599,
    actives: ['Niacinamide 10%', 'Zinc 1%'], targets: ['oiliness', 'pore', 'acne', 'redness'], weeks: 8,
    goodFor: ['Oily', 'Combination', 'Normal'], caution: null },
  { id: 'aze-10', name: 'Azelaic Acid 10% Cream', type: 'Treatment', price: 799,
    actives: ['Azelaic acid 10%'], targets: ['acne', 'redness', 'age_spot'], weeks: 8,
    goodFor: ['Combination', 'Dry', 'Normal', 'Oily'], caution: 'Mild tingling in week 1 is common.' },
  { id: 'cica-gel', name: 'Cica + Panthenol Barrier Gel-Cream', type: 'Moisturiser', price: 549,
    actives: ['Centella asiatica', 'Panthenol 5%', 'Ceramides'], targets: ['redness', 'moisture', 'texture'], weeks: 4,
    goodFor: ['Combination', 'Dry', 'Normal', 'Oily'], caution: null },
  { id: 'ha-b5', name: 'Hyaluronic Acid 2% + B5 Serum', type: 'Serum', price: 499,
    actives: ['Hyaluronic acid', 'Vitamin B5'], targets: ['moisture', 'texture'], weeks: 3,
    goodFor: ['Dry', 'Combination', 'Normal'], caution: null },
  { id: 'vitc-15', name: 'Vitamin C 15% Brightening Serum', type: 'Serum', price: 899,
    actives: ['Ethyl ascorbic acid 15%', 'Ferulic acid'], targets: ['radiance', 'age_spot', 'dark_circle_v2'], weeks: 8,
    goodFor: ['Normal', 'Combination', 'Oily'], caution: 'Patch-test if you have active redness.' },
  { id: 'retinal', name: 'Encapsulated Retinal 0.1% Night Serum', type: 'Treatment', price: 1199,
    actives: ['Retinaldehyde 0.1%'], targets: ['wrinkle', 'texture', 'firmness', 'acne'], weeks: 12,
    goodFor: ['Normal', 'Oily', 'Combination'], caution: 'Start 2 nights a week; skip if skin is very red or dry.' },
  { id: 'caff-eye', name: 'Caffeine 5% + Peptide Eye Serum', type: 'Eye care', price: 649,
    actives: ['Caffeine 5%', 'Matrixyl peptides'], targets: ['eye_bag', 'dark_circle_v2'], weeks: 6,
    goodFor: ['Dry', 'Combination', 'Normal', 'Oily'], caution: null },
  { id: 'oat-cream', name: 'Colloidal Oat Rich Repair Cream', type: 'Moisturiser', price: 699,
    actives: ['Colloidal oatmeal', 'Shea butter', 'Ceramides'], targets: ['moisture', 'redness', 'firmness'], weeks: 4,
    goodFor: ['Dry'], caution: 'Rich texture - can feel heavy on an oily T-zone.' },
  { id: 'spf50-gel', name: 'Ultra-light Gel Sunscreen SPF 50 PA++++', type: 'Sunscreen', price: 549,
    actives: ['Broad-spectrum UV filters', 'Niacinamide 2%'], targets: ['age_spot', 'radiance', 'redness'], weeks: 8,
    goodFor: ['Oily', 'Combination', 'Normal', 'Dry'], caution: 'Daily use is what makes every other product work.' },
  { id: 'aha-toner', name: 'Lactic Acid 5% Glow Toner', type: 'Exfoliant', price: 499,
    actives: ['Lactic acid 5%', 'Glycerin'], targets: ['texture', 'radiance', 'pore'], weeks: 4,
    goodFor: ['Normal', 'Dry', 'Combination'], caution: 'Don\'t layer with retinal on the same night.' },
  { id: 'clay-mask', name: 'Kaolin Clay Oil-Control Mask', type: 'Mask', price: 399,
    actives: ['Kaolin', 'Bentonite'], targets: ['oiliness', 'pore'], weeks: 2,
    goodFor: ['Oily', 'Combination'], caution: 'T-zone only if your cheeks are dry.' },
];

// Rank products for one analysis. Need = 100 - ui_score for each targeted concern,
// weighted toward the user's 3 weakest concerns, with skin-type fit and zone-aware cautions.
export const GOALS = {
  breakouts: { label: 'Breakouts', concerns: ['acne', 'pore', 'oiliness'] },
  redness:   { label: 'Redness',   concerns: ['redness'] },
  oil:       { label: 'Oily shine', concerns: ['oiliness', 'pore'] },
  dull:      { label: 'Dullness & spots', concerns: ['radiance', 'age_spot'] },
  dry:       { label: 'Dryness',   concerns: ['moisture', 'texture'] },
  eyes:      { label: 'Tired eyes', concerns: ['dark_circle_v2', 'eye_bag'] },
  ageing:    { label: 'Fine lines', concerns: ['wrinkle', 'firmness', 'texture'] },
};

export function rankProducts(analysis, goals = []) {
  const s = analysis.scores;
  const goalConcerns = new Set(goals.flatMap((g) => GOALS[g]?.concerns || []));
  const weakest = Object.entries(s).sort((a, b) => a[1].ui - b[1].ui).slice(0, 3).map(([k]) => k);
  const whole = analysis.skinType.whole || 'Normal';
  const tz = analysis.skinType.t_zone, uz = analysis.skinType.u_zone;

  return PRODUCTS.map((p) => {
    let score = 0; const why = [];
    for (const c of p.targets) {
      if (!s[c]) continue;
      const need = Math.max(0, 100 - s[c].ui);
      const w = (weakest.includes(c) ? 1.6 : 1) * (goalConcerns.has(c) ? 2 : 1);
      score += need * w;
      if (goalConcerns.has(c)) why.push(`Targets your goal: ${CONCERNS[c].label.toLowerCase()} (AI score ${s[c].ui})`);
      else if (weakest.includes(c)) why.push(`${CONCERNS[c].label} is one of your lowest scores (${s[c].ui})`);
    }
    score /= Math.sqrt(p.targets.length); // don't reward "does everything" claims
    const fits = p.goodFor.some((t) => whole.includes(t));
    if (fits) { score *= 1.15; why.push(`Suits ${whole.toLowerCase()} skin`); }
    else score *= 0.7;
    const warnings = [];
    if (p.id === 'oat-cream' && tz && tz.includes('Oily')) { score *= 0.6; warnings.push('Your T-zone reads oily - keep this to cheeks only.'); }
    if (p.id === 'sal-gel' && uz && uz.includes('Dry')) warnings.push('Your U-zone reads dry - use once daily, follow with moisturiser.');
    if (p.id === 'retinal' && s.redness && s.redness.ui < 70) { score *= 0.7; warnings.push('Your redness score is low - calm skin first.'); }
    if (p.caution && !warnings.length) warnings.push(p.caution);
    return { ...p, fit: Math.round(score), why, warnings };
  }).sort((a, b) => b.fit - a.fit);
}

// Simulation intensities for a product's goal preview (only concerns the simulation supports)
export function simIntensities(product) {
  const out = {};
  for (const c of product.targets) { const k = CONCERNS[c].sim; if (k) out[k] = 1.0; }
  if (!Object.keys(out).length) out.texture = 0.6;
  return out;
}

// Verdict for a check-in vs baseline on the product's target concerns.
// Uses raw_score (more sensitive than ui_score). Changes under 2 points are treated as photo noise.
export function verdict(product, baseline, current, days) {
  const rows = product.targets.filter((c) => baseline.scores[c] && current.scores[c]).map((c) => {
    const d = +(current.scores[c].raw - baseline.scores[c].raw).toFixed(1);
    return { concern: c, before: baseline.scores[c].raw, after: current.scores[c].raw, delta: d };
  });
  const avg = rows.length ? rows.reduce((a, r) => a + r.delta, 0) / rows.length : 0;
  const weeks = days / 7;
  const progress = Math.min(1, weeks / product.weeks);
  const irritation = baseline.scores.redness && current.scores.redness &&
    current.scores.redness.raw - baseline.scores.redness.raw <= -4;

  let status, title, advice;
  if (irritation) {
    status = 'bad'; title = 'Possible irritation';
    advice = 'Redness rose noticeably since you started. Pause this product for a week, keep a gentle moisturiser and sunscreen, then re-scan.';
  } else if (avg >= 2) {
    status = 'good'; title = 'It\'s working';
    advice = `Your target concerns improved by ${avg.toFixed(1)} points on average after ${weeks.toFixed(1)} weeks. Keep going - reorder before you run out.`;
  } else if (avg <= -2) {
    status = 'bad'; title = 'Getting worse';
    advice = 'Your target concerns have slipped. Stop re-buying this one and try the next-best match below.';
  } else if (progress < 0.6) {
    status = 'wait'; title = 'Too early to tell';
    advice = `${product.actives[0]} usually needs about ${product.weeks} weeks. You are ${weeks.toFixed(1)} weeks in - scan again in ${Math.ceil(product.weeks * 0.6 - weeks)} week(s).`;
  } else {
    status = 'meh'; title = 'Not doing much';
    advice = `After ${weeks.toFixed(1)} of ~${product.weeks} weeks the change is within photo noise. Consider switching before you buy another bottle.`;
  }
  return { status, title, advice, rows, avg: +avg.toFixed(1), weeks: +weeks.toFixed(1),
    overallDelta: (current.overall ?? 0) - (baseline.overall ?? 0) };
}
