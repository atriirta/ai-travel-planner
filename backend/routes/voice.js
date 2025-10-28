// backend/routes/voice.js
const express = require('express');
const router = express.Router();
const multer = require('multer'); // 用于接收音频文件
const crypto = require('crypto'); // Node.js 内置
const axios = require('axios');

const upload = multer({ storage: multer.memoryStorage() }); // 将文件保存在内存中

// 讯飞鉴权函数
const getXunfeiAuth = (apiKey, apiSecret) => {
  const host = 'api.xfyun.cn';
  const date = new Date().toUTCString();
  const algorithm = 'hmac-sha256';
  const headers = 'host date request-line';
  const requestLine = 'POST /v1/private/lfasr_1pass HTTP/1.1'; // 短语音识别接口

  const signatureOrigin = `host: ${host}\ndate: ${date}\n${requestLine}`;
  const signatureSha = crypto.createHmac('sha256', apiSecret).update(signatureOrigin).digest('base64');

  const authorization = `api_key="${apiKey}", algorithm="${algorithm}", headers="${headers}", signature="${signatureSha}"`;

  return { authorization, date };
};

router.post('/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '没有提供音频文件' });
  }

  const APPID = process.env.IFLYTEK_APPID;
  const API_KEY = process.env.IFLYTEK_API_KEY;
  const API_SECRET = process.env.IFLYTEK_API_SECRET;

  const { authorization, date } = getXunfeiAuth(API_KEY, API_SECRET);
  const url = `https://api.xfyun.cn/v1/private/lfasr_1pass`;

  const audioBase64 = req.file.buffer.toString('base64');

  const params = {
    "common": { "app_id": APPID },
    "business": {
      "language": "zh_cn", // 中文
      "sample_rate": 16000,
      "domain": "iat",
      "aue": "raw" // 音频编码 (必须是 pcm 或 raw)
    },
    "data": { "audio": audioBase64, "status": 2 }
  };

  try {
    const response = await axios.post(url, params, {
      headers: {
        'Host': 'api.xfyun.cn',
        'Date': date,
        'Authorization': authorization,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.code === 0 && response.data.data) {
      // 讯飞返回的 data.result 是 JSON 字符串，需要再次解析
      const result = JSON.parse(response.data.data);
      // 拼接识别结果
      let transcription = result.ws.map(item => item.cw.map(w => w.w).join('')).join('');
      res.json({ transcription });
    } else {
      res.status(500).json({ error: '语音识别失败', details: response.data });
    }
  } catch (error) {
    console.error('iFlyTek Error:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: '语音识别服务器错误' });
  }
});

module.exports = router;