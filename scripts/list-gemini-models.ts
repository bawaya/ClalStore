const apiKey = "AIzaSyCnQjDfKoCdcmjdxcgFpwC2-REXXsS0zpQ";

async function run() {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
}

run();
