// backend/routes/llm.js
const express = require('express');
const router = express.Router();
const axios = require('axios');

// [新] 步骤 1：添加实体提取 Prompt
// [新] 【最终增强版 v3】实体提取 Prompt
const createExtractPrompt = (text) => {
  // (我们不再需要前端的简单清理了，让 AI 自己处理)
  return `
  你是一个信息提取助理。你的任务是分析一段可能包含停顿、重复、口误或语气词的原始语音转录文本，然后提取出关键的旅行信息。

  请按照以下两步执行：

  **第一步：分析与总结**
  请先在脑中分析以下原始文本，并总结出用户的核心需求。
  原始文本: "${text}"

  **第二步：提取信息**
  根据你的分析总结，严格按照以下 JSON 格式返回提取的信息。
  * **所有键都必须存在。**
  * 如果未提及，**必须**返回 null。
  * **请进行合理的单位转换** (例如 "一周" -> 7, "2万" -> 20000, "五天" -> 5)。

  {
    "destination": "...", // (string | null) 目的地
    "days": ...,        // (number | null) 天数 (仅数字)
    "budget": ...,      // (number | null) 预算 (仅数字)
    "companions": "...",  // (string | null) 同行描述
    "preferences": "..." // (string | null) 除去以上信息的其他偏好
  }

  **示例 1:**
  原始文本: "嗯...我想去...我想去美国吧...大概...玩...一个星期...预算...一...两万...都行...就我一个人...然后...喜欢...嗯...自然风光..."
  (你的内心分析：用户想去美国，玩7天，预算10000-20000，一个人，喜欢自然风光。)
  返回 JSON:
  {
    "destination": "美国",
    "days": 7,
    "budget": 20000,
    "companions": "一个人",
    "preferences": "喜欢自然风光"
  }

  **示例 2:**
  原始文本: "那个...去成都...对...成都...玩五天...想吃火锅...看熊猫"
  (你的内心分析：用户想去成都，玩5天，偏好是吃火锅和看熊猫。未提预算和同伴。)
  返回 JSON:
  {
    "destination": "成都",
    "days": 5,
    "budget": null,
    "companions": null,
    "preferences": "想吃火锅看熊猫"
  }

  **示例 3:**
  原始文本: "喜欢看自然风光，喜欢吃美食"
  (你的内心分析：用户只提了偏好。未提其他。)
  返回 JSON:
  {
    "destination": null,
    "days": null,
    "budget": null,
    "companions": null,
    "preferences": "喜欢看自然风光，喜欢吃美食"
  }

  请只返回最终的 JSON 对象，不要包含任何解释性文字、markdown 标记或你的内心分析过程。
  `;
};

// 我们将在这里定义一个非常重要的 "Prompt"
const createTravelPrompt = (inputs) => {
  const { destination, days, budget, companions, preferences } = inputs;

  // 这是一个强大的 Prompt Engineering 技巧：要求 LLM 按指定 JSON 格式输出
  return `
  请你扮演一个专业的旅行规划师。根据以下需求，为我生成一份详细的旅行计划。

  需求：
  - 目的地: ${destination}
  - 天数: ${days}
  - 预算 (人民币): ${budget}
  - 同行人数: ${companions}
  - 偏好: ${preferences}

  请严格按照以下 JSON 格式返回你的规划，不要包含任何 JSON 格式之外的解释性文字：
  {
    "title": "关于[目的地]的[天数]日游",
    "budget_analysis": {
      "total_estimate": "约 XXXX 元",
      "breakdown": [
        {"category": "机票/交通", "cost": "XXXX 元", "notes": "..."},
        {"category": "住宿", "cost": "XXXX 元", "notes": "..."},
        {"category": "餐饮", "cost": "XXXX 元", "notes": "..."},
        {"category": "景点门票", "cost": "XXXX 元", "notes": "..."},
        {"category": "其他", "cost": "XXXX 元", "notes": "..."}
      ]
    },
    "daily_plan": [
      {
        "day": 1,
        "theme": "抵达与城市初探",
        "activities": [
          {"time": "下午", "activity": "抵达[机场/车站]", "description": "...", "location": {"name": "地点名称", "lat": 0.0, "lng": 0.0}},
          {"time": "傍晚", "activity": "酒店入住", "description": "...", "location": {"name": "酒店名称", "lat": 0.0, "lng": 0.0}},
          {"time": "晚上", "activity": "晚餐：[餐厅名]", "description": "推荐菜：...", "location": {"name": "餐厅名称", "lat": 0.0, "lng": 0.0}}
        ]
      },
      // ... 更多天的计划
    ]
  }
  `;
};

router.post('/plan', async (req, res) => {
  try {
    const prompt = createTravelPrompt(req.body);

    const response = await axios.post(
      'https://api.deepseek.com/chat/completions',
      {
        model: 'deepseek-chat', // 使用 DeepSeek 的 Chat 模型
        messages: [
          { role: 'system', content: 'You are a helpful travel planner.' },
          { role: 'user', content: prompt }
        ],
        stream: false // 我们需要完整的 JSON，所以关闭流式
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
        }
      }
    );

    // 尝试解析 LLM 返回的 JSON 字符串
    const llmResponse = response.data.choices[0].message.content;
    const planJson = JSON.parse(llmResponse);

    res.json(planJson);

  } catch (error) {
    console.error('LLM API Error:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: '生成计划失败' });
  }
});

// [新] 步骤 2：添加 /extract API 路由
router.post('/extract', async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: '缺少文本' });
  }

  try {
    const prompt = createExtractPrompt(text);
    const url = 'https://api.deepseek.com/chat/completions';

    const response = await axios.post(
      url,
      {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are a helpful entity extraction assistant.' },
          { role: 'user', content: prompt }
        ],
        stream: false
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
        }
      }
    );

    const llmResponse = response.data.choices[0].message.content;

    // --- [!! 核心修复 !!] ---

    let partialData = {};
    try {
        // 1. 尝试解析 AI 返回的（可能不完整的）JSON
        partialData = JSON.parse(llmResponse);
    } catch (e) {
        // 2. 如果 AI 返回的不是 JSON (例如错误信息或纯文本)
        // 我们就做一个降级处理：把用户的整句话都当作“偏好”
        console.error('LLM /extract JSON 解析失败, 降级为仅填充 preferences:', llmResponse, e);
        partialData = { preferences: text };
    }

    // 3. 【后处理】
    // 无论 partialData 是什么样子，我们都用它来填充一个“完整”的模板。
    // 这保证了所有 5 个键一定存在。
    // 如果 AI 没有返回某个键 (例如 destination)，它在这里会变成 null。
    const guaranteedData = {
      destination: partialData.destination || null,
      days: partialData.days || null,
      budget: partialData.budget || null,
      companions: partialData.companions || null,
      preferences: partialData.preferences || null,
    };

    // 4. 将这个“干净且完整”的 JSON 返回给前端
    res.json(guaranteedData);
    // --- [修复结束] ---

  } catch (error) {
    console.error('LLM /extract API Error:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: '提取信息失败' });
  }
});


module.exports = router;