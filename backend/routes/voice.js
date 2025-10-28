// backend/routes/voice.js
// --- 真实的讯飞 WebSocket API 实现 (v2) ---

const express = require('express');
const router = express.Router();
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const WebSocket = require('ws'); // 1. 导入 ws 库
const url = require('url'); // 用于构建鉴权 URL

// 1. Multer 和 temp 目录配置 (无变化)
const upload = multer({ storage: multer.memoryStorage() });
const tempDir = path.join(__dirname, '../temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// 2. [新] 构建 WebSocket 鉴权 URL (严格按照文档)
const buildAuthUrl = (apiKey, apiSecret) => {
  const host = 'iat-api.xfyun.cn';
  const pathname = '/v2/iat';
  const requestLine = `GET ${pathname} HTTP/1.1`;
  const date = new Date().toUTCString();

  // 1. 拼接 signature_origin
  const signatureOrigin = `host: ${host}\ndate: ${date}\n${requestLine}`;

  // 2. Hmac-sha256 签名
  const signatureSha = crypto
    .createHmac('sha256', apiSecret)
    .update(signatureOrigin)
    .digest('base64');

  // 3. 拼接 authorization_origin
  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`;

  // 4. Base64 编码 authorization
  const authorization = Buffer.from(authorizationOrigin).toString('base64');

  // 5. 构建最终 URL
  const params = {
    authorization: authorization,
    date: date,
    host: host,
  };

  const
   authUrl = new URL(`wss://${host}${pathname}`);
  authUrl.search = new url.URLSearchParams(params).toString();
  return authUrl.href;
};

// 3. POST /api/voice/transcribe 路由 (已重构)
router.post('/transcribe', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '没有提供音频文件' });
  }

  // 临时文件路径 (无变化)
  const uniqueId = crypto.randomUUID();
  const inputPath = path.join(tempDir, `${uniqueId}.webm`);
  const outputPath = path.join(tempDir, `${uniqueId}.pcm`);

  const cleanup = () => {
    fs.unlink(inputPath, (err) => err && console.error('清理 inputPath 失败:', err));
    fs.unlink(outputPath, (err) => err && console.error('清理 outputPath 失败:', err));
  };

  try {
    // 步骤 1: 将 Buffer 写入临时 webm 文件 (无变化)
    fs.writeFileSync(inputPath, req.file.buffer);

    // 步骤 2: FFmpeg 转码 (无变化)
    ffmpeg(inputPath)
      .outputOptions(['-f', 's16le', '-ar', '16000', '-ac', '1'])
      .save(outputPath)
      .on('error', (err) => {
        console.error('FFmpeg 转码失败:', err);
        cleanup();
        return res.status(500).json({ error: '音频转码失败', details: err.message });
      })
      .on('end', () => {

        // 步骤 3: [新] 转码成功，开始 WebSocket 流程
        const APPID = process.env.IFLYTEK_APPID;
        const API_KEY = process.env.IFLYTEK_API_KEY;
        const API_SECRET = process.env.IFLYTEK_API_SECRET;

        if (!APPID || !API_KEY || !API_SECRET) {
          console.error('讯飞 .env 密钥配置不全');
          cleanup();
          return res.status(500).json({ error: '服务器密钥配置不全' });
        }

        const authUrl = buildAuthUrl(API_KEY, API_SECRET);
        const ws = new WebSocket(authUrl);

        let finalTranscription = ''; // 用于拼接所有识别片段

        // WebSocket 事件 1: 连接出错
        ws.on('error', (err) => {
          console.error('WebSocket 错误:', err.message);
          cleanup();
          // 确保只发送一次错误响应
          if (!res.headersSent) {
            res.status(500).json({ error: 'WebSocket 连接失败', details: err.message });
          }
        });

        // WebSocket 事件 2: 连接关闭
        ws.on('close', () => {
          console.log('WebSocket 连接关闭');
          cleanup(); // 最终清理
          // 如果连接已关闭，但响应还未发送 (例如在 'message' 中 status 2 之前就关了)
          if (!res.headersSent) {
            res.status(200).json({ transcription: finalTranscription || '(未识别到语音)' });
          }
        });

        // WebSocket 事件 3: 收到服务器消息
        ws.on('message', (data) => {
          try {
            const json = JSON.parse(data.toString());

            // A. 握手成功后，服务器会返回 code 0 和 sid
            if (json.code === 0 && json.data && json.data.result) {
              // B. 解析听写结果
              const wsResult = json.data.result.ws;
              let segment = '';
              wsResult.forEach((item) => {
                segment += item.cw.map((w) => w.w).join('');
              });

              // C. 根据 'pgs' 字段处理（动态修正）
              // 'apd' = 追加, 'rpl' = 替换
              if (json.data.result.pgs === 'rpl') {
                // 如果是替换，我们需要更复杂的逻辑来替换之前的片段
                // 为简化作业，我们暂时只做追加 (apd)
                // 完整的动态修正请参考讯飞 demo
                finalTranscription = segment; // 简化处理：用新的覆盖旧的
              } else {
                finalTranscription += segment; // 追加
              }

              // D. 识别结束
              if (json.data.status === 2) { // 2 = 识别最后一块
                console.log('讯飞识别结束');
                if (!res.headersSent) {
                  res.status(200).json({ transcription: finalTranscription || '(未识别到语音)' });
                }
                ws.close(1000); // 正常关闭
              }
            } else if (json.code !== 0) {
              // E. 讯飞返回了错误码
              console.error('讯飞 API 返回错误:', json);
              if (!res.headersSent) {
                res.status(500).json({ error: '语音识别失败', details: json.message });
              }
              ws.close(1005); // 异常关闭
            }

          } catch (e) {
            console.error('解析讯飞消息失败:', e);
          }
        });

        // WebSocket 事件 4: 连接建立成功
        ws.on('open', () => {
          console.log('WebSocket 连接已打开，开始发送音频');

          // 1. 发送第一帧 (业务参数)
          ws.send(JSON.stringify({
            common: { app_id: APPID },
            business: {
              language: 'zh_cn',
              domain: 'iat',
              accent: 'mandarin',
              // vad_eos: 2000, // 后端点静默
              dwa: 'wpgs' // 开启动态修正
            },
            data: {
              status: 0, // 0 = 第一帧
              format: 'audio/L16;rate=16000',
              encoding: 'raw',
              audio: '' // 第一帧不带音频
            }
          }));

          // 2. 读取转码后的 PCM 文件
          const pcmBuffer = fs.readFileSync(outputPath);
          const frameSize = 1280; // 文档建议的帧大小
          let cursor = 0;

          // 3. 创建定时器，每 40ms 发送一帧
          const interval = setInterval(() => {
            if (cursor >= pcmBuffer.length) {
              // 音频已发完
              clearInterval(interval);
              // 4. 发送结束帧
              ws.send(JSON.stringify({
                data: { status: 2 } // 2 = 最后一帧
              }));
              console.log('音频发送完毕');
              return;
            }

            // 5. 发送中间帧
            const chunk = pcmBuffer.slice(cursor, cursor + frameSize);
            const audioBase64 = chunk.toString('base64');
            ws.send(JSON.stringify({
              data: {
                status: 1, // 1 = 中间帧
                format: 'audio/L16;rate=16000',
                encoding: 'raw',
                audio: audioBase64
              }
            }));
            cursor += frameSize;

          }, 40); // 每 40ms 发送一次
        });
      });
  } catch (writeError) {
    console.error('写入临时文件失败:', writeError);
    cleanup();
    return res.status(500).json({ error: '服务器写入文件失败' });
  }
});

module.exports = router;