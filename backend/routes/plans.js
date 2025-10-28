// backend/routes/plans.js
const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
// TODO: 添加一个中间件来验证 JWT，从而获取 user_id
// (为简化作业，我们暂时从请求体中获取 user_id)

// 保存计划
router.post('/save', async (req, res) => {
  const { user_id, title, plan_data } = req.body;
  if (!user_id || !plan_data) {
    return res.status(400).json({ error: '缺少 user_id 或 plan_data' });
  }

  const { data, error } = await supabase
    .from('itineraries')
    .insert([{ user_id, title, plan_data }]);

  if (error) {
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json(data);
});

// 获取某个用户的所有计划
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;

  const { data, error } = await supabase
    .from('itineraries')
    .select('*')
    .eq('user_id', userId); // 筛选

  if (error) {
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

module.exports = router;