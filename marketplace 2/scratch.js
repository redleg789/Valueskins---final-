const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://valueskins_user:FXZ0OcB2zyVkGLQUEIq8uGjAVigm2T9x@dpg-d864uujtqb8s73c5abfg-a.singapore-postgres.render.com/valueskins?sslmode=require' });

async function clear() {
  try {
    await pool.query('DELETE FROM events');
    console.log('Cleared all events to fix duplicates');
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
clear();
