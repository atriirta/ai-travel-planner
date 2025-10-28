// backend/routes/plans.js
const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
// (未来：这里应该有 JWT 中间件来验证用户身份)

// POST /api/plans/save (升级：保存后返回新数据)
router.post('/save', async (req, res) => {
  const { user_id, title, plan_data } = req.body;
  if (!user_id || !plan_data) {
    return res.status(400).json({ error: '缺少 user_id 或 plan_data' });
  }

  // insert 默认只返回一个空对象
  // 使用 .select() 可以让它返回新插入的行
  const { data, error } = await supabase
    .from('itineraries')
    .insert([{ user_id, title, plan_data }])
    .select(); // <-- 关键修改

  if (error) {
    console.error('Supabase save error:', error);
    return res.status(500).json({ error: error.message });
  }
  // data 是一个数组，我们返回第一个元素
  res.status(201).json(data[0]);
});

// GET /api/plans/:userId (无变化)
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  const { data, error } = await supabase
    .from('itineraries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false }); // 按时间倒序

  if (error) {
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

// DELETE /api/plans/:planId (新增)
router.delete('/:planId', async (req, res) => {
  const { planId } = req.params;
  // (安全提示：真实项目中，你还应该验证 user_id，确保用户只能删自己的)

  const { error } = await supabase
    .from('itineraries')
    .delete()
    .eq('id', planId);

  if (error) {
    console.error('Supabase delete error:', error);
    return res.status(500).json({ error: error.message });
  }
  res.status(200).json({ message: '计划已删除' });
});

module.exports = router;