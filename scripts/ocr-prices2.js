const { createWorker } = require('tesseract.js');
const path = require('path');
const fs = require('fs');

const imgPath = path.resolve('C:/Users/baway/.cursor/projects/c-CLALSTORE-clalmobile/assets/c__Users_baway_AppData_Roaming_Cursor_User_workspaceStorage_d4cd4ed6b03f8cd2b543f6ca73c35e14_images_Price_list_hotmobile1-46154e4f-9d49-4c88-80c7-33e1687c9a28.png');

async function main() {
  console.log('Starting OCR on clearer price list image...');
  const worker = await createWorker('eng+heb', 1, {
    logger: () => {},
  });
  await worker.setParameters({
    tessedit_pageseg_mode: '6',
    tessedit_char_whitelist: '0123456789.,₪ ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+-/()GBTiPShoneamsugnalxyZFlipFoldUltraPluEdgeProMaxAirRedmiNotePocoPixelOpRenoXiaomiGoogleZTE',
  });
  const { data: { text } } = await worker.recognize(imgPath);
  await worker.terminate();
  fs.writeFileSync(path.resolve(__dirname, 'ocr-output2.txt'), text, 'utf8');
  console.log('OCR complete. Saved to scripts/ocr-output2.txt');
  console.log('Lines:', text.split('\n').length);
  console.log('---FULL OUTPUT---');
  console.log(text);
}

main().catch(e => { console.error(e); process.exit(1); });
