import { Router } from 'express';
import { sql } from '../db';

const router = Router();

interface ClientUpdate {
  rentprog_id: string;
  phone: string;
}

/**
 * POST /bulk-update-clients
 * Массовое обновление external_refs для клиентов
 * Body: { clients: [{rentprog_id, phone}, ...] }
 */
router.post('/bulk-update-clients', async (req, res) => {
  try {
    const { clients } = req.body as { clients: ClientUpdate[] };
    
    if (!Array.isArray(clients) || clients.length === 0) {
      return res.status(400).json({ ok: false, error: 'clients array required' });
    }
    
    console.log(`📦 Bulk update: ${clients.length} clients`);
    
    // Формируем VALUES для CTE
    const values = clients.map(c => {
      const phone = c.phone.replace(/'/g, "''");
      const rentprogId = String(c.rentprog_id).replace(/'/g, "''");
      return `('${phone}', '${rentprogId}')`;
    }).join(',\n');
    
    const result = await sql.unsafe(`
      WITH client_data AS (
        SELECT * FROM (VALUES
          ${values}
        ) AS t(phone, rentprog_id)
      ),
      matched_clients AS (
        SELECT 
          c.id as entity_id,
          cd.rentprog_id
        FROM client_data cd
        JOIN clients c ON c.phone = cd.phone
      )
      INSERT INTO external_refs (
        entity_type,
        entity_id,
        system,
        external_id,
        created_at,
        updated_at
      )
      SELECT
        'client'::text,
        mc.entity_id,
        'rentprog'::text,
        mc.rentprog_id,
        NOW(),
        NOW()
      FROM matched_clients mc
      ON CONFLICT (system, external_id)
      DO UPDATE SET
        entity_id = EXCLUDED.entity_id,
        updated_at = NOW()
      RETURNING external_id
    `);
    
    console.log(`✅ Updated ${result.length} external_refs`);
    
    res.json({
      ok: true,
      updated: result.length,
      requested: clients.length
    });
    
  } catch (error: any) {
    console.error('❌ Bulk update error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;

