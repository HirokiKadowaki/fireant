export async function POST(request) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio')

    if (!audioFile) {
      return Response.json({ error: 'No audio file provided' }, { status: 400 })
    }

    // Use fetch directly — more reliable than SDK for multipart/form-data
    const elevenFormData = new FormData()
    elevenFormData.append('file', audioFile, 'recording.webm')
    elevenFormData.append('model_id', 'scribe_v1')

    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
      },
      body: elevenFormData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('ElevenLabs STT error:', errorText)
      return Response.json(
        { error: `ElevenLabs error: ${response.status} ${errorText}` },
        { status: 500 }
      )
    }

    const result = await response.json()
    return Response.json({ text: result.text })
  } catch (error) {
    console.error('STT error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}