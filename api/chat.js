export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, system, model, max_tokens } = req.body;

    // Allow caller to pick a model (e.g. "claude-sonnet-4-5" for vision tasks).
    // Default stays on Haiku so existing Q&A code keeps working unchanged.
    const chosenModel = (typeof model === 'string' && model.trim().length > 0)
      ? model.trim()
      : 'claude-haiku-4-5';

    // Allow caller to lift the token ceiling for longer responses (vision reasoning).
    const tokenCap = Number.isInteger(max_tokens) && max_tokens > 0 && max_tokens <= 4096
      ? max_tokens
      : 1000;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: chosenModel,
        max_tokens: tokenCap,
        system: system,
        messages: messages
      })
    });

    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({ error: 'Internal server error', detail: error.message });
  }
}
