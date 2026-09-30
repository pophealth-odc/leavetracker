/* ============================================================
   supabase.js — Supabase client + all DB helper functions

   Credentials are loaded from js/config.js (gitignored).
   Copy js/config.example.js → js/config.js and fill in your
   Supabase Project URL and anon key.
   ============================================================ */

// -- Configuration (set via js/config.js, loaded before this file) --
const SUPABASE_URL      = 'https://vawcsvpvwepkogkfluda.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhd2NzdnB2d2Vwa29na2ZsdWRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3MzQ0OTUsImV4cCI6MjEwNjMxMDQ5NX0.eNrehZgJB_2FSn4sFi5PtS9YpKkw9LKfbqraYC6c_6k';

// Load the Supabase JS client (CDN, loaded in index.html)
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Profiles ────────────────────────────────────────────────
async function getTeamMembers({ activeOnly = false } = {}) {
  let q = db.from('profiles').select('*').order('full_name');
  if (activeOnly) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

async function getTeamMember(id) {
  const { data, error } = await db.from('profiles').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

async function addTeamMember({ full_name, email, department, is_active = true }) {
  const { data, error } = await db
    .from('profiles')
    .insert([{ full_name, email: email || null, department: department || null, is_active }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateTeamMember(id, fields) {
  const { data, error } = await db
    .from('profiles')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deactivateTeamMember(id) {
  return updateTeamMember(id, { is_active: false });
}

async function activateTeamMember(id) {
  return updateTeamMember(id, { is_active: true });
}

// ── Leave Types ─────────────────────────────────────────────
async function getLeaveTypes({ activeOnly = false } = {}) {
  let q = db.from('leave_types').select('*').order('name');
  if (activeOnly) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

async function addLeaveType({ name, description = '', color = '#3b82f6', is_active = true }) {
  const { data, error } = await db
    .from('leave_types')
    .insert([{ name, description, color, is_active }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateLeaveType(id, fields) {
  const { data, error } = await db
    .from('leave_types')
    .update(fields)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Leave Records ────────────────────────────────────────────
async function getLeaveRecords({
  employeeId, leaveTypeId, department,
  year, startDate, endDate, search
} = {}) {
  let q = db
    .from('leave_records')
    .select(`
      *,
      profiles!employee_id (id, full_name, email, department, is_active),
      leave_types!leave_type_id (id, name, color, description)
    `)
    .order('start_date', { ascending: false });

  if (employeeId)    q = q.eq('employee_id', employeeId);
  if (leaveTypeId)   q = q.eq('leave_type_id', leaveTypeId);
  if (year)          q = q.gte('start_date', `${year}-01-01`).lte('start_date', `${year}-12-31`);
  if (startDate)     q = q.gte('start_date', startDate);
  if (endDate)       q = q.lte('end_date', endDate);

  const { data, error } = await q;
  if (error) throw error;

  let result = data || [];

  // Filter by department (needs profile data)
  if (department) {
    result = result.filter(r => r.profiles?.department === department);
  }

  // Free-text search: name, reason, leave type
  if (search) {
    const s = search.toLowerCase();
    result = result.filter(r =>
      r.profiles?.full_name?.toLowerCase().includes(s) ||
      r.reason?.toLowerCase().includes(s) ||
      r.leave_types?.name?.toLowerCase().includes(s)
    );
  }

  return result;
}

async function getLeaveRecord(id) {
  const { data, error } = await db
    .from('leave_records')
    .select(`
      *,
      profiles!employee_id (id, full_name, email, department),
      leave_types!leave_type_id (id, name, color)
    `)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

async function addLeave({ employee_id, leave_type_id, start_date, end_date, number_of_days, reason = '' }) {
  const { data, error } = await db
    .from('leave_records')
    .insert([{ employee_id, leave_type_id, start_date, end_date, number_of_days, reason }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateLeave(id, fields) {
  const { data, error } = await db
    .from('leave_records')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteLeave(id) {
  const { error } = await db.from('leave_records').delete().eq('id', id);
  if (error) throw error;
}

// ── Public Holidays ──────────────────────────────────────────
async function getPublicHolidays({ year } = {}) {
  let q = db.from('public_holidays').select('*').order('date');
  if (year) q = q.eq('year', year);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

async function getAllPublicHolidays() {
  const { data, error } = await db.from('public_holidays').select('*').order('date');
  if (error) throw error;
  return data;
}

async function addPublicHoliday({ name, date }) {
  const { data, error } = await db
    .from('public_holidays')
    .insert([{ name, date }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updatePublicHoliday(id, fields) {
  const { data, error } = await db
    .from('public_holidays')
    .update(fields)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deletePublicHoliday(id) {
  const { error } = await db.from('public_holidays').delete().eq('id', id);
  if (error) throw error;
}

// ── Dashboard Aggregates ─────────────────────────────────────
async function getDashboardStats() {
  const today = fmtDate(new Date());
  const month1 = today.slice(0, 7) + '-01';
  const month2 = today.slice(0, 7) + '-31';
  const future = fmtDate(addDays(new Date(), 30));

  const [members, onLeaveToday, upcomingLeave, monthLeave] = await Promise.all([
    db.from('profiles').select('id', { count: 'exact', head: true }).eq('is_active', true),
    db.from('leave_records')
      .select('*, profiles!employee_id(full_name,department), leave_types!leave_type_id(name,color)')
      .lte('start_date', today).gte('end_date', today),
    db.from('leave_records')
      .select('*, profiles!employee_id(full_name,department), leave_types!leave_type_id(name,color)')
      .gt('start_date', today).lte('start_date', future)
      .order('start_date'),
    db.from('leave_records')
      .select('id', { count: 'exact', head: true })
      .gte('start_date', month1).lte('start_date', month2)
  ]);

  if (members.error)     throw members.error;
  if (onLeaveToday.error) throw onLeaveToday.error;
  if (upcomingLeave.error) throw upcomingLeave.error;
  if (monthLeave.error)  throw monthLeave.error;

  return {
    totalMembers:  members.count || 0,
    onLeaveToday:  onLeaveToday.data || [],
    upcomingLeave: upcomingLeave.data || [],
    leaveThisMonth: monthLeave.count || 0
  };
}

// ── Helper: format date as YYYY-MM-DD ────────────────────────
function fmtDate(d) {
  const dt = typeof d === 'string' ? new Date(d + 'T00:00:00') : d;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
