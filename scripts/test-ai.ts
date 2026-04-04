import { getAIResponse } from "../lib/bot/ai";

async function testAI() {
  console.log("Testing AI Response...");
  const res = await getAIResponse("test-conv-123", "أهلاً، هل عندكم آيفون 15 بروماكس؟", {
    language: "ar",
  });
  
  if (res) {
    console.log("SUCCESS! Response received:");
    console.log(res.text);
  } else {
    console.error("FAILED! No response received. Check API keys.");
  }
}

testAI().catch(console.error);
