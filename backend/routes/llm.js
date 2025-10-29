// backend/routes/llm.js
const express = require('express');
const router = express.Router();
const axios = require('axios');

// [新] 步骤 1：添加实体提取 Prompt
const createExtractPrompt = (text) => {
  return `
  你是一个信息提取助理。请从以下文本中提取关键旅行信息。
  文本: "${text}"

  请严格按照以下 JSON 格式返回，所有键都必须存在。
  1. 'destination' (string): 目的地，如果未提及，返回 null。
  2. 'days' (number): 天数，只返回数字，如果未提及，返回 null。
  3. 'budget' (number): 预算，只返回数字（例如 "1万" 提取为 10000, "两千" 提取为 2000），如果未提及，返回 null。
  4. 'companions' (string): 同行人数，例如 "2人" 或 "带孩子"，如果未提及，返回 null。
  5. 'preferences' (string): 用户的旅行偏好、兴趣点或必须要做的事，例如 "喜欢美食" 或 "想看长城"。如果未提及，返回 null。

  请确保在提取后，所有键都存在于 JSON 中（值为 null 或提取到的值）。

  示例 1:
  - 文本: "我想去美国，7天，预算 2 万，一个人, 喜欢自然风光。"
  - JSON: {"destination": "美国", "days": 7, "budget": 20000, "companions": "1人", "preferences": "喜欢自然风光"}

  示例 2:
  - 文本: "我想去上海玩，带孩子。"
  - JSON: {"destination": "上海", "days": null, "budget": null, "companions": "带孩子", "preferences": null}

  示例 3:
  - 文本: "去北京 5 天，想看长城和故宫。"
  - JSON: {"destination": "北京", "days": 5, "budget": null, "companions": null, "preferences": "想看长城和故宫"}

  请只返回 JSON 对象，不要包含任何解释性文字或 markdown 标记。
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
    const url = 'https://api.deepseek.com/chat/completions';;

    const response = await axios.post(
      url,
      {
        model: 'deepseek-chat', // 使用 qwen-plus 进行精确提取
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

    // 尝试解析 LLM 返回的 JSON 字符串
    try {
      const extractedData = JSON.parse(llmResponse);

      // 过滤掉值为 null 的键，防止它们覆盖表单中的默认值
      const filteredData = {};
      for (const key in extractedData) {
        if (extractedData[key] !== null) {
          // @ts-ignore
          filteredData[key] = extractedData[key];
        }
      }

      res.json(filteredData);
    } catch (e) {
      console.error('LLM /extract JSON 解析失败:', llmResponse, e);
      throw new Error("Failed to parse LLM JSON response");
    }

  } catch (error) {
    console.error('LLM /extract API Error:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: '提取信息失败' });
  }
});


module.exports = router;