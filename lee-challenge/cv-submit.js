const C = window.LEE_CONFIG;
const IMAGES = window.LEE_IMAGES;
const root = document.querySelector('#cvApp');
const expectedIds = IMAGES.map(image => image.id);
const IEA_KEYS = {
  iea_visual_no_lep: 'Visual condition (no LEP)',
  iea_visual_with_lep: 'Visual condition (with LEP)',
  iea_mass_loss: 'Mass loss',
  iea_aerodynamic_performance: 'Aerodynamic performance',
  iea_blade_integrity: 'Blade integrity'
};
const IEA_LABELS = {
  'Visual condition (no LEP)': ['0 — Initial/factory condition','1 — Barely visible erosion or pinholes','2 — Localised pitting','3 — Widespread/coherent pits; some gouges','4 — Topcoat eroded; immediate underlying layer exposed','5 — Notable substrate/laminate damage'],
  'Visual condition (with LEP)': ['0 — Initial/factory condition','1 — Light wear or reduced LEP adhesion','2 — Localised LEP damage / adhesive failure','3 — LEP compromised over a large area','4 — Topcoat delamination; underlying layer exposed','5 — Notable substrate damage'],
  'Mass loss': ['0 — Negligible / none','1 — Coating loss <10%; laminate 0%','2 — Coating 10–50%; laminate 0%','3 — Coating 50–100%; laminate <10%','4 — Coating 100%; laminate 10–100%','5 — Coating 100%; laminate 100%'],
  'Aerodynamic performance': ['0 — Normal surface roughness','1 — Region-2 power loss 0–1%','2 — Region-2 power loss 1–2%','3 — Region-2 power loss 2–3%','4 — Region-2 power loss 3–4%','5 — Region-2 power loss >4%'],
  'Blade integrity': ['0 — No erosion affecting integrity','1 — Initial erosion of topcoat','2 — Erosion through topcoat','3 — Initial exposure of immediate laminate layers','4 — Erosion through immediate laminate layers','5 — Exposure of structural laminate layers']
};

const esc = (value = '') => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const uuid = () => crypto.randomUUID();
const apiHeaders = () => ({ apikey: C.SUPABASE_ANON_KEY, Authorization: `Bearer ${C.SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' });

async function insert(table, rows) {
  if (!C.SUPABASE_URL || !C.SUPABASE_ANON_KEY) throw new Error('Supabase is not configured.');
  const response = await fetch(`${C.SUPABASE_URL}/rest/v1/${table}`, { method: 'POST', headers: apiHeaders(), body: JSON.stringify(rows) });
  if (!response.ok) throw new Error(await response.text());
}

function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = '';
    } else cell += character;
  }
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) throw new Error('The CSV must contain a header and one row per image.');
  const headers = rows[0].map(header => header.toLowerCase());
  return rows.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

function normaliseIea(value, criterion) {
  const cleaned = String(value).trim().toLowerCase().replaceAll(' ', '_');
  if (['cannot_determine', 'cannot-determine', 'na', 'n/a'].includes(cleaned)) return 'Cannot determine from image';
  if (!/^[0-5]$/.test(cleaned)) throw new Error(`${criterion} must be 0–5 or cannot_determine.`);
  return IEA_LABELS[criterion][Number(cleaned)];
}

function parseScheme(text) {
  if (!text.trim()) return [];
  let scheme;
  try { scheme = JSON.parse(text); } catch { throw new Error('The custom scheme is not valid JSON.'); }
  if (!Array.isArray(scheme) || !scheme.length) throw new Error('The custom scheme must be a non-empty JSON array.');
  scheme.forEach(criterion => {
    if (!/^[a-z0-9_-]+$/.test(criterion.id || '') || !criterion.name || !Array.isArray(criterion.levels) || !criterion.levels.length) throw new Error('Every custom criterion needs a simple id, name, and at least one level.');
    criterion.levels.forEach(level => { if (!level.id || !level.label || !level.description) throw new Error(`Every level in ${criterion.id} needs an id, label, and description.`); });
  });
  return scheme;
}

function validate(rows, scheme) {
  const required = ['image_id', 'lercat', ...Object.keys(IEA_KEYS)];
  const errors = [];
  const ids = rows.map(row => row.image_id);
  required.forEach(column => { if (!Object.prototype.hasOwnProperty.call(rows[0] || {}, column)) errors.push(`Missing column: ${column}`); });
  expectedIds.forEach(id => { if (!ids.includes(id)) errors.push(`Missing image: ${id}`); });
  ids.filter((id, index) => ids.indexOf(id) !== index).forEach(id => errors.push(`Duplicate image: ${id}`));
  ids.filter(id => !expectedIds.includes(id)).forEach(id => errors.push(`Unknown image: ${id}`));
  rows.forEach(row => {
    if (!/^[A-E]$/i.test(row.lercat || '')) errors.push(`${row.image_id || 'Row'}: LERCat must be A–E.`);
    Object.entries(IEA_KEYS).forEach(([column, criterion]) => { try { normaliseIea(row[column], criterion); } catch (error) { errors.push(`${row.image_id || 'Row'}: ${error.message}`); } });
    if (row.confidence && (Number(row.confidence) < 0 || Number(row.confidence) > 1 || Number.isNaN(Number(row.confidence)))) errors.push(`${row.image_id}: confidence must be between 0 and 1.`);
    scheme.forEach(criterion => {
      const column = `own__${criterion.id}`; const allowed = criterion.levels.map(level => String(level.id));
      if (!Object.prototype.hasOwnProperty.call(row, column)) errors.push(`Missing custom-scheme column: ${column}`);
      else if (!allowed.includes(String(row[column]))) errors.push(`${row.image_id}: ${column} must use a level id from the scheme definition.`);
    });
  });
  if (rows.length !== expectedIds.length) errors.push(`Expected ${expectedIds.length} result rows; found ${rows.length}.`);
  return [...new Set(errors)];
}

function render() {
  root.innerHTML = `<section class="card"><h1>Submit computer-vision classifications</h1>
    <p class="muted">Use the original image URLs and stable image IDs, run your model locally, then upload one CSV containing predictions for every challenge image.</p>
    <div class="actions"><a class="btn" href="data/image-manifest.csv" download>Download image manifest</a><a class="btn primary" href="data/cv-submission-template.csv" download>Download CSV template</a></div>
    <div class="note"><strong>CSV values:</strong> LERCat must be A–E. Each IEA field must be 0–5 or <code>cannot_determine</code>. Confidence is optional and must be 0–1. Keep the supplied image IDs unchanged.</div>
    <form id="cvForm"><h2>Participant and model details</h2><div class="grid">
      ${[['name','Name (optional)','text'],['organisation','Organisation name (optional)','text'],['email','Email address (optional)','email'],['modelName','Model / team name','text'],['modelVersion','Model version (optional)','text'],['modelUrl','Repository or paper URL (optional)','url']].map(([name,label,type]) => `<div class="field"><label>${label}</label><input name="${name}" type="${type}" ${name === 'modelName' ? 'required' : ''}></div>`).join('')}
      <div class="field"><label>Organisation type</label><select name="orgType" required><option value="" selected disabled>Select organisation type</option><option>University / research institute</option><option>Service provider</option><option>Owner/Operator</option><option>OEM</option><option>Other</option></select></div>
      <div class="field"><label>Country you are based in</label><input name="country" required></div>
    </div><div class="field"><label>Model description (optional)</label><textarea name="modelDescription" rows="3" placeholder="Architecture, training data, preprocessing, or other relevant information"></textarea></div>
    <div class="field"><label>Custom classification scheme JSON (optional)</label><textarea name="customScheme" rows="7" placeholder='[{"id":"overall","name":"Overall severity","levels":[{"id":"low","label":"Low","description":"Minor visible erosion"}]}]'></textarea><span class="small">For each criterion, add a CSV column named <code>own__criterion-id</code> and enter one of its level IDs in every image row.</span></div>
    <label class="small"><input type="checkbox" name="manualCorrection"> Predictions were manually reviewed or corrected</label>
    <div class="field"><label>Completed results CSV</label><input id="csvFile" name="csvFile" type="file" accept=".csv,text/csv" required></div>
    <label class="small"><input type="checkbox" name="consent" required> I consent to my submitted information being used for this research challenge. Results will only be published in anonymised form.</label>
    <div id="validation" class="note" hidden></div><div class="actions"><button class="btn primary" id="submitButton">Validate and submit</button></div></form></section>`;
  document.querySelector('#cvForm').onsubmit = submit;
}

async function submit(event) {
  event.preventDefault();
  const button = document.querySelector('#submitButton'); const output = document.querySelector('#validation');
  button.disabled = true; output.hidden = false; output.className = 'note'; output.textContent = 'Validating…';
  try {
    const form = new FormData(event.target); const file = form.get('csvFile'); const rows = parseCsv(await file.text()); const scheme = parseScheme(form.get('customScheme')); const errors = validate(rows, scheme);
    if (errors.length) throw new Error(errors.join('\n'));
    const participantId = uuid();
    await insert('participants', { id: participantId, name: form.get('name') || null, organisation: form.get('organisation') || null, email: form.get('email') || null, organisation_type: form.get('orgType'), country: form.get('country'), consented: true, submission_method: 'computer_vision', model_name: form.get('modelName'), model_version: form.get('modelVersion') || null, model_description: form.get('modelDescription') || null, model_url: form.get('modelUrl') || null, manual_correction: form.has('manualCorrection') });
    const events = rows.map(row => ({ participant_id: participantId, event_type: 'assessment', image_id: row.image_id, payload: { iea: Object.fromEntries(Object.entries(IEA_KEYS).map(([column, criterion]) => [criterion, normaliseIea(row[column], criterion)])), lercat: row.lercat.toUpperCase(), own: Object.fromEntries(scheme.map(criterion => [criterion.id, row[`own__${criterion.id}`]])), confidence: row.confidence ? Number(row.confidence) : null, submission_method: 'computer_vision' } }));
    if (scheme.length) events.unshift({ participant_id: participantId, event_type: 'scheme', payload: scheme });
    events.push({ participant_id: participantId, event_type: 'submitted', payload: { completed_at: new Date().toISOString(), image_order: expectedIds, submission_method: 'computer_vision' } });
    await insert('events', events);
    root.innerHTML = `<section class="card"><div class="complete">✓</div><h1 style="text-align:center">Model submission complete</h1><p class="muted" style="text-align:center">${rows.length} image predictions were validated and submitted. Results are not displayed to participants.</p></section>`;
  } catch (error) { output.className = 'note error'; output.innerHTML = `<strong>Submission not accepted</strong><pre>${esc(error.message)}</pre>`; button.disabled = false; }
}

render();
