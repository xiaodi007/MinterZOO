export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { prompt } = req.body;
  const apiKey = process.env.API_KEY;
  const dashRes = await fetch(`https://dashscope.aliyuncs.com/api/v1/apps/4b81c7c6f4b242479151e1049fd7cde3/completion`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      "input": {
        "prompt": prompt
    },
    }),
  });

  const data = await dashRes.json();

  if (!dashRes.ok) {
    return res.status(500).json({ error: data });
  }

  // 示例解析逻辑（你可以自定义）
  const text = data.output?.text || '';
  const result = JSON.parse(text)

  return res.status(200).json(result);
}
