// Telegram TTS Bot using Gemini API - Cloudflare Worker
export default {
  async fetch(request, env) {
    try {
      // Handle webhook verification
      if (request.method === 'GET') {
        return new Response('Bot is running!', { status: 200 });
      }

      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }

      const update = await request.json();
      
      // Handle incoming message
      if (update.message) {
        await handleMessage(update.message, env);
      }

      return new Response('OK', { status: 200 });
    } catch (error) {
      console.error('Error:', error);
      return new Response('Error processing request', { status: 500 });
    }
  }
};

async function handleMessage(message, env) {
  const chatId = message.chat.id;
  const text = message.text;

  try {
    // Handle /start command
    if (text === '/start') {
      await sendMessage(chatId, 'Send me any text and I\'ll convert it to speech using Gemini AI!', env.TELEGRAM_BOT_TOKEN);
      return;
    }

    // If no text provided
    if (!text || text.trim() === '') {
      await sendMessage(chatId, 'Please send me some text to convert to speech.', env.TELEGRAM_BOT_TOKEN);
      return;
    }

    // Send "processing" message
    await sendMessage(chatId, '🎵 Converting text to speech...', env.TELEGRAM_BOT_TOKEN);

    // Generate speech using Gemini API
    const audioData = await generateSpeech(text, env.GEMINI_API_KEY);
    
    if (!audioData) {
      await sendMessage(chatId, '❌ Sorry, failed to generate speech. Please try again.', env.TELEGRAM_BOT_TOKEN);
      return;
    }

    // Send voice message to Telegram
    await sendVoiceMessage(chatId, audioData, env.TELEGRAM_BOT_TOKEN);

  } catch (error) {
    console.error('Error handling message:', error);
    await sendMessage(chatId, '❌ An error occurred while processing your request.', env.TELEGRAM_BOT_TOKEN);
  }
}

async function generateSpeech(text, geminiApiKey) {
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent', {
      method: 'POST',
      headers: {
        'x-goog-api-key': geminiApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: text
          }]
        }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Kore'
              }
            }
          }
        },
        model: 'gemini-2.5-flash-preview-tts'
      })
    });

    if (!response.ok) {
      console.error('Gemini API error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    
    // Extract base64 audio data
    const audioBase64 = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!audioBase64) {
      console.error('No audio data in response');
      return null;
    }

    // Convert base64 to binary
    const audioBuffer = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
    
    // Convert PCM to WAV format
    const wavBuffer = pcmToWav(audioBuffer, 24000, 1);
    
    return wavBuffer;

  } catch (error) {
    console.error('Error generating speech:', error);
    return null;
  }
}

function pcmToWav(pcmData, sampleRate, channels) {
  const bytesPerSample = 2; // 16-bit
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmData.length;
  const fileSize = 36 + dataSize;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, fileSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // AudioFormat (PCM)
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitsPerSample
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Copy PCM data
  const wavData = new Uint8Array(buffer);
  wavData.set(pcmData, 44);

  return wavData;
}

async function sendMessage(chatId, text, botToken) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: text
    })
  });
}

async function sendVoiceMessage(chatId, audioBuffer, botToken) {
  const url = `https://api.telegram.org/bot${botToken}/sendVoice`;
  
  // Create FormData for multipart upload
  const formData = new FormData();
  formData.append('chat_id', chatId.toString());
  formData.append('voice', new Blob([audioBuffer], { type: 'audio/wav' }), 'voice.wav');
  
  const response = await fetch(url, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Telegram API error:', response.status, errorText);
    throw new Error(`Telegram API error: ${response.status}`);
  }

  return await response.json();
}

// Environment variables needed:
// - TELEGRAM_BOT_TOKEN: Your Telegram bot token from @BotFather
// - GEMINI_API_KEY: Your Google AI API key

// To deploy:
// 1. Create a new Cloudflare Worker
// 2. Set environment variables in the dashboard
// 3. Set webhook URL: https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_WORKER_URL>
