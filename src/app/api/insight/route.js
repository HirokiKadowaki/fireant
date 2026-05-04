import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const SYSTEM_PROMPT = `You write a short monthly summary for a personal FIRE (Financial Independence) tracking app for a user in Japan.

Your job: given the user's data for the most recent month and their recent history, write 2-3 sentences comparing this month to baseline.

Constraints:
- Concrete numbers, not vague adjectives. "Savings rate of 38%, up from 33% baseline" not "savings improved nicely."
- No advice or suggestions. Just observation. The user does their own thinking; you describe what happened.
- Mention one specific category if it stands out. Don't list every category.
- Note FIRE date impact only if it moved meaningfully (>3 months).
- Use ¥ for amounts, Japanese category names where given.
- Plain prose. No bullets, no headers, no markdown, in English.
- Maximum 3 sentences.`

export async function POST(request) {
  try {
    const data = await request.json()

    if (!data || !data.thisMonth) {
      return Response.json(
        { error: 'Missing required data' },
        { status: 400 }
      )
    }

    const userMessage = `Here is the user's data:

${JSON.stringify(data, null, 2)}

Write the monthly summary.`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: userMessage }
      ],
    })

    return Response.json({
      reply: message.content[0].text,
      usage: message.usage,
    })
  } catch (error) {
    console.error('Anthropic API error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}