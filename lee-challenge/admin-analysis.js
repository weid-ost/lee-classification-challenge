const C = window.LEE_CONFIG;
const root = document.querySelector('#admin');
let token = '';
let dataset = null;

const esc = (value = '') => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));
const apiHeaders = () => ({ apikey: C.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` });

async function login(email, password) {
  const response = await fetch(`${C.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: C.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!response.ok) throw new Error('Sign-in failed. Check your email, password, and admin_users entry.');
  return response.json();
}

async function getTable(table) {
  const response = await fetch(`${C.SUPABASE_URL}/rest/v1/${table}?select=*&order=created_at.asc`, { headers: apiHeaders() });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function modifyTable(table, query, method, body) {
  const response = await fetch(`${C.SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method,
    headers: { ...apiHeaders(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!response.ok) throw new Error(await response.text());
}

function csvCell(value) {
  const text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(filename, rows) {
  if (!rows.length) return alert('There are no rows to export for the current selection.');
  const columns = Object.keys(rows[0]);
  const text = [columns.map(csvCell).join(','), ...rows.map(row => columns.map(column => csvCell(row[column])).join(','))].join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function latestEvents(events, eventType, keyFunction) {
  const latest = new Map();
  events.filter(event => event.event_type === eventType).forEach(event => latest.set(keyFunction(event), event));
  return [...latest.values()];
}

function prepareData(participants, events) {
  const assessments = latestEvents(events, 'assessment', event => `${event.participant_id}:${event.image_id}`);
  const schemes = new Map(latestEvents(events, 'scheme', event => event.participant_id).map(event => [event.participant_id, event.payload]));
  const submitted = new Set(events.filter(event => event.event_type === 'submitted').map(event => event.participant_id));
  return { participants, events, assessments, schemes, submitted };
}

function filteredParticipants() {
  const organisationType = document.querySelector('#organisationFilter')?.value || 'all';
  const completion = document.querySelector('#completionFilter')?.value || 'all';
  const visibility = document.querySelector('#visibilityFilter')?.value || 'active';
  return dataset.participants.filter(participant => {
    const organisationMatches = organisationType === 'all' || participant.organisation_type === organisationType;
    const isComplete = dataset.submitted.has(participant.id);
    const completionMatches = completion === 'all' || (completion === 'complete' ? isComplete : !isComplete);
    const hidden = participant.excluded_from_dashboard === true;
    const visibilityMatches = visibility === 'all' || (visibility === 'hidden' ? hidden : !hidden);
    return organisationMatches && completionMatches && visibilityMatches;
  });
}

function selectedAssessments() {
  const ids = new Set(filteredParticipants().map(participant => participant.id));
  const image = document.querySelector('#imageFilter')?.value || 'all';
  return dataset.assessments.filter(event => ids.has(event.participant_id) && (image === 'all' || event.image_id === image));
}

function distribution(values, orderedLabels) {
  const counts = Object.fromEntries(orderedLabels.map(label => [label, 0]));
  values.forEach(value => { if (value in counts) counts[value] += 1; });
  return counts;
}

function barChart(counts, className = '') {
  const maximum = Math.max(1, ...Object.values(counts));
  return `<div class="bar-chart ${className}">${Object.entries(counts).map(([label, count]) => `
    <div class="bar-row"><div class="bar-label" title="${esc(label)}">${esc(label)}</div>
    <div class="bar-track"><div class="bar-fill" style="width:${(count / maximum) * 100}%"></div></div><strong>${count}</strong></div>`).join('')}</div>`;
}

const percent = (numerator, denominator) => denominator ? `${Math.round((numerator / denominator) * 100)}%` : '—';

function renderDashboard() {
  const organisationTypes = [...new Set(dataset.participants.map(participant => participant.organisation_type).filter(Boolean))].sort();
  const images = [...new Set(dataset.assessments.map(event => event.image_id).filter(Boolean))].sort();
  root.innerHTML = `
    <section class="card dashboard-heading"><div><h1>Challenge results</h1><p class="muted">Private researcher view · latest saved assessment per participant and image</p></div><button class="btn" id="logout">Sign out</button></section>
    <section class="card filter-card"><div class="filter-grid filter-grid-four">
      <div class="field"><label>Organisation type</label><select id="organisationFilter"><option value="all">All organisation types</option>${organisationTypes.map(value => `<option>${esc(value)}</option>`).join('')}</select></div>
      <div class="field"><label>Completion status</label><select id="completionFilter"><option value="all">All participants</option><option value="complete">Complete</option><option value="incomplete">In progress</option></select></div>
      <div class="field"><label>Image</label><select id="imageFilter"><option value="all">All images</option>${images.map(value => `<option>${esc(value)}</option>`).join('')}</select></div>
      <div class="field"><label>Dashboard visibility</label><select id="visibilityFilter"><option value="active">Active entries</option><option value="hidden">Hidden entries</option><option value="all">All entries</option></select></div>
    </div></section><div id="analysis"></div>`;
  document.querySelectorAll('.filter-card select').forEach(select => select.addEventListener('change', renderAnalysis));
  document.querySelector('#logout').onclick = () => { token = ''; dataset = null; renderLogin(); };
  renderAnalysis();
}

function renderAnalysis() {
  const participants = filteredParticipants();
  const participantIds = new Set(participants.map(participant => participant.id));
  const assessments = selectedAssessments();
  const completeCount = participants.filter(participant => dataset.submitted.has(participant.id)).length;
  const lercatCounts = distribution(assessments.map(event => event.payload?.lercat).filter(Boolean), ['A', 'B', 'C', 'D', 'E']);
  const ieaCriteria = [...new Set(assessments.flatMap(event => Object.keys(event.payload?.iea || {})))];
  const cannotDetermine = assessments.flatMap(event => Object.values(event.payload?.iea || {})).filter(value => value === 'Cannot determine from image').length;
  const ieaAnswers = assessments.reduce((total, event) => total + Object.keys(event.payload?.iea || {}).length, 0);
  const imageCount = new Set(assessments.map(event => event.image_id)).size;
  const schemeOwners = [...participantIds].filter(id => dataset.schemes.has(id));
  const criteriaCount = schemeOwners.reduce((total, id) => total + (dataset.schemes.get(id)?.length || 0), 0);

  document.querySelector('#analysis').innerHTML = `
    <section class="metric-grid">
      <div class="metric card"><span>Participants</span><strong>${participants.length}</strong></div>
      <div class="metric card"><span>Completed</span><strong>${completeCount}</strong><small>${percent(completeCount, participants.length)} of selection</small></div>
      <div class="metric card"><span>Image assessments</span><strong>${assessments.length}</strong><small>${imageCount} image${imageCount === 1 ? '' : 's'}</small></div>
      <div class="metric card"><span>IEA cannot determine</span><strong>${percent(cannotDetermine, ieaAnswers)}</strong><small>${cannotDetermine} of ${ieaAnswers} criterion ratings</small></div>
    </section>
    <section class="analysis-grid">
      <div class="card"><h2>LERCat distribution</h2><p class="muted">Counts for the current participant and image filters.</p>${barChart(lercatCounts, 'lercat-bars')}</div>
      <div class="card"><h2>Participant-defined schemes</h2><p class="muted">Custom schemes are not combined because their criteria and levels are participant-specific.</p>
        <div class="summary-list"><div><span>Participants with a scheme</span><strong>${schemeOwners.length}</strong></div><div><span>Total custom criteria</span><strong>${criteriaCount}</strong></div><div><span>Mean criteria per scheme</span><strong>${schemeOwners.length ? (criteriaCount / schemeOwners.length).toFixed(1) : '—'}</strong></div></div></div>
    </section>
    <section class="card"><h2>IEA Task 46 distributions</h2><p class="muted">Each criterion is analysed separately. The numeric level is extracted from the stored label; “Cannot determine” remains its own category.</p>
      <div class="iea-grid">${ieaCriteria.map(criterion => {
        const values = assessments.map(event => event.payload?.iea?.[criterion]).filter(Boolean);
        const labels = ['0', '1', '2', '3', '4', '5', 'Cannot determine'];
        const normalised = values.map(value => value === 'Cannot determine from image' ? 'Cannot determine' : String(value).match(/^\d/)?.[0]).filter(Boolean);
        return `<div class="criterion-chart"><h3>${esc(criterion)}</h3>${barChart(distribution(normalised, labels))}</div>`;
      }).join('') || '<p>No IEA assessments match the current filters.</p>'}</div>
    </section>
    <section class="card"><div class="section-heading"><div><h2>Participants</h2><p class="muted">Personally identifying fields stay visible only in this admin-only page and the private export.</p></div><div class="actions compact"><button class="btn" id="participantsCsv">Participants CSV</button><button class="btn primary" id="analysisCsv">Analysis CSV</button></div></div>
      <div class="table-wrap"><table class="results-table"><thead><tr><th>Name</th><th>Organisation</th><th>Type</th><th>Country</th><th>Status</th><th>Assessments</th><th>Manage</th></tr></thead><tbody>
      ${participants.map(participant => `<tr><td>${esc(participant.name || 'Anonymous')}</td><td>${esc(participant.organisation || '—')}</td><td>${esc(participant.organisation_type)}</td><td>${esc(participant.country)}</td><td><span class="status ${dataset.submitted.has(participant.id) ? 'complete-status' : ''}">${dataset.submitted.has(participant.id) ? 'Complete' : 'In progress'}</span>${participant.excluded_from_dashboard ? '<span class="status hidden-status">Hidden</span>' : ''}</td><td>${dataset.assessments.filter(event => event.participant_id === participant.id).length}</td><td><div class="row-actions"><button class="btn small-btn toggle-visibility" data-id="${participant.id}">${participant.excluded_from_dashboard ? 'Restore' : 'Hide'}</button><button class="btn danger small-btn delete-entry" data-id="${participant.id}">Delete entirely</button></div></td></tr>`).join('') || '<tr><td colspan="7">No participants match the current filters.</td></tr>'}
      </tbody></table></div></section>`;
  document.querySelector('#participantsCsv').onclick = () => downloadCsv('participants-filtered.csv', participants);
  document.querySelector('#analysisCsv').onclick = () => downloadCsv('challenge-analysis-long.csv', buildLongExport(participants, assessments));
  document.querySelectorAll('.toggle-visibility').forEach(button => button.onclick = () => toggleVisibility(button.dataset.id));
  document.querySelectorAll('.delete-entry').forEach(button => button.onclick = () => deleteEntry(button.dataset.id));
}

async function toggleVisibility(participantId) {
  const participant = dataset.participants.find(item => item.id === participantId);
  if (!participant) return;
  const hidden = participant.excluded_from_dashboard !== true;
  try {
    await modifyTable('participants', `id=eq.${encodeURIComponent(participantId)}`, 'PATCH', { excluded_from_dashboard: hidden });
    participant.excluded_from_dashboard = hidden;
    renderAnalysis();
  } catch (exception) {
    alert(`Could not ${hidden ? 'hide' : 'restore'} this entry: ${exception.message}`);
  }
}

async function deleteEntry(participantId) {
  const participant = dataset.participants.find(item => item.id === participantId);
  if (!participant) return;
  const label = participant.name || participant.email || participantId;
  if (!confirm(`Permanently delete ${label} and all of their saved challenge events? This cannot be undone.`)) return;
  try {
    await modifyTable('events', `participant_id=eq.${encodeURIComponent(participantId)}`, 'DELETE');
    await modifyTable('participants', `id=eq.${encodeURIComponent(participantId)}`, 'DELETE');
    dataset.participants = dataset.participants.filter(item => item.id !== participantId);
    dataset.events = dataset.events.filter(item => item.participant_id !== participantId);
    dataset.assessments = dataset.assessments.filter(item => item.participant_id !== participantId);
    dataset.schemes.delete(participantId);
    dataset.submitted.delete(participantId);
    renderDashboard();
  } catch (exception) {
    alert(`Could not delete this entry: ${exception.message}`);
  }
}

function buildLongExport(participants, assessments) {
  const participantMap = new Map(participants.map(participant => [participant.id, participant]));
  const rows = [];
  assessments.forEach(event => {
    const participant = participantMap.get(event.participant_id);
    if (!participant) return;
    const common = { participant_id: participant.id, name: participant.name, email: participant.email, organisation: participant.organisation, organisation_type: participant.organisation_type, country: participant.country, completed: dataset.submitted.has(participant.id), image_id: event.image_id };
    Object.entries(event.payload?.iea || {}).forEach(([criterion, selected]) => rows.push({ ...common, scheme: 'IEA Task 46', criterion, selected_level: selected, selected_description: '' }));
    if (event.payload?.lercat) rows.push({ ...common, scheme: 'LERCat', criterion: 'Overall category', selected_level: event.payload.lercat, selected_description: '' });
    const scheme = dataset.schemes.get(participant.id) || [];
    Object.entries(event.payload?.own || {}).forEach(([criterionId, levelId]) => {
      const criterion = scheme.find(item => item.id === criterionId);
      const level = criterion?.levels?.find(item => item.id === levelId);
      rows.push({ ...common, scheme: 'Participant-defined', criterion: criterion?.name || criterionId, selected_level: level?.label || levelId, selected_description: level?.description || '' });
    });
  });
  return rows;
}

function renderLogin() {
  root.innerHTML = `<section class="card sign-in-card"><h1>Researcher sign in</h1><p class="muted">Results and analysis are restricted to authorised researchers.</p><form id="loginForm"><div class="grid"><div class="field"><label>Email</label><input name="email" type="email" autocomplete="username" required></div><div class="field"><label>Password</label><input name="password" type="password" autocomplete="current-password" required></div></div><div class="actions"><button class="btn primary">Sign in</button></div></form><p id="loginError" class="error" role="alert"></p></section>`;
  document.querySelector('#loginForm').onsubmit = async event => {
    event.preventDefault();
    const button = event.target.querySelector('button');
    const error = document.querySelector('#loginError');
    button.disabled = true; error.textContent = '';
    try {
      const fields = Object.fromEntries(new FormData(event.target));
      const session = await login(fields.email, fields.password);
      token = session.access_token;
      const [participants, events] = await Promise.all([getTable('participants'), getTable('events')]);
      dataset = prepareData(participants, events);
      renderDashboard();
    } catch (exception) { error.textContent = exception.message; button.disabled = false; }
  };
}

renderLogin();
