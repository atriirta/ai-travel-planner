// backend/routes/expenses.js
const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');

// POST /api/expenses - 添加一条新开销
router.post('/', async (req, res) => {
  const { user_id, itinerary_id, category, description, amount } = req.body;
  if (!user_id || !itinerary_id || !amount) {
    return res.status(400).json({ error: '缺少必要字段' });
  }

  const { data, error } = await supabase
    .from('expenses')
    .insert([{ user_id, itinerary_id, category, description, amount }])
    .select();

  if (error) {
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json(data[0]);
});

// GET /api/expenses/:itineraryId - 获取一个计划的所有开销
router.get('/:itineraryId', async (req, res) => {
  const { itineraryId } = req.params;

  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('itinerary_id', itineraryId)
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

module.exports = router;