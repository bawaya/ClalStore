const { createWorker } = require('tesseract.js');
const path = require('path');

const imgPath = path.resolve('C:/Users/baway/.cursor/projects/c-CLALSTORE-clalmobile/assets/c__Users_baway_AppData_Roaming_Cursor_User_workspaceStorage_d4cd4ed6b03f8cd2b543f6ca73c35e14_images_Price_list_hotmobile-73647e8d-4ac0-4005-b2f5-7346dd26ecff.png');

async function main() {
  console.log('Starting OCR on price list image...');
  const worker = await createWorker('heb+eng', 1, { logger: () => {} });
  const { data: { text } } = await worker.recognize(imgPath);
  await worker.terminate();

  const fs = require('fs');
  fs.writeFileSync(path.resolve(__dirname, 'ocr-output.txt'), text, 'utf8');
  console.log('OCR complete. Output saved to scripts/ocr-output.txt');
  console.log('---PREVIEW---');
  console.log(text.substring(0, 5000));
}

main().catch(e => { console.error(e); process.exit(1); });
