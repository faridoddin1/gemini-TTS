1. create worker page clouflare
paste worker.js and Deploy

2. set in settings Variables and Secrets: TEXT
GEMINI_API_KEY = your gemini api key here: (https://aistudio.google.com/app/apikey)
TELEGRAM_BOT_TOKEN = your bot token
Deploy.

3. set webhook:
https://api.telegram.org/botYOUR-BOT-TOKEN/setWebhook?url=YOUR-WORKER.workers.dev/


[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/faridoddin1/gemini-TTS)
