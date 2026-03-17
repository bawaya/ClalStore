const fs = require('fs');
const path = require('path');

const imgPath = path.resolve('C:/Users/baway/.cursor/projects/c-CLALSTORE-clalmobile/assets/c__Users_baway_AppData_Roaming_Cursor_User_workspaceStorage_d4cd4ed6b03f8cd2b543f6ca73c35e14_images_Price_list_hotmobile-73647e8d-4ac0-4005-b2f5-7346dd26ecff.png');
const imgBuf = fs.readFileSync(imgPath);
const b64 = imgBuf.toString('base64');
const apiKey = process.env.OPENAI_API_KEY_ADMIN;

const prompt = `This is a HOT Mobile Israel dealer price list spreadsheet.

TASK: Extract ALL product rows with their FULL PRICE INCLUDING VAT (the column header should say something like "שלם כולל מעמ" or "מחיר שלם כולל מע"מ" or similar). Also extract the monthly payment for 36 months if available.

OUTPUT FORMAT - one line per product-storage combo, pipe separated:
Product Name | Storage | Full Price Including VAT | Monthly x36

RULES:
- Use the TAX-INCLUSIVE full/cash price column (NOT the installment price, NOT before-VAT price)
- Translate Hebrew names to English (e.g. אייפון = iPhone, גלקסי = Galaxy, שיאומי = Xiaomi)
- Storage: 64GB, 128GB, 256GB, 512GB, 1TB, 2TB
- Prices as integers (round to nearest whole number), no currency symbols
- If no 36-month column, put 0
- Include ALL rows: Apple, Samsung, Xiaomi, Oppo, Google Pixel, ZTE, etc.
- Skip headers, totals, section dividers
- Return ONLY data lines. No markdown, no explanation, no numbering.

Example:
iPhone 17 Pro | 256GB | 5178 | 144
Samsung Galaxy S25 Ultra | 256GB | 4050 | 113`;

const body = JSON.stringify({
  model: 'gpt-4o-mini',
  max_tokens: 10000,
  temperature: 0.1,
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: prompt },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,' + b64, detail: 'high' } }
    ]
  }]
});

async function main() {
  if (!apiKey) {
    console.error('Missing OPENAI_API_KEY_ADMIN in environment.');
    process.exit(1);
  }

  console.log('Sending image to OpenAI Vision...');
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
    body
  });
  const data = await resp.json();
  if (data.error) {
    console.error('API ERROR:', JSON.stringify(data.error));
    process.exit(1);
  }
  const text = data.choices[0].message.content;
  console.log(text);
  console.log('\n---TOKENS:', data.usage?.prompt_tokens, '+', data.usage?.completion_tokens);
  
  // Save to file for later use
  fs.writeFileSync(path.resolve(__dirname, 'extracted-prices.txt'), text, 'utf8');
  console.log('Saved to scripts/extracted-prices.txt');
}

main().catch(e => { console.error(e); process.exit(1); });
